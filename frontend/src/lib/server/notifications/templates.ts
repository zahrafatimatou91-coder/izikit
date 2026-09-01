/**
 * Notification templates.
 *
 * Each project defines its own typed wrappers around `createNotification`.
 * The example below ships with the template — adapt it, replace it, or add
 * more (e.g. `firePaymentReceived`, `fireExportReady`). The pattern:
 *
 *   1. Build a `CreateNotificationInput` with a *deterministic* dedupeKey
 *      so the unique constraint enforces at-most-once delivery for that
 *      logical event (e.g. `payment-received:${orderId}` — never include
 *      a timestamp or random suffix).
 *   2. Pass the input + your PrismaClient to `createNotification`.
 *   3. Optionally enqueue an email via `EmailQueue.enqueue` — but ONLY
 *      after the notification row is created, so a duplicate event never
 *      sends a duplicate email.
 *
 * Keep these helpers free of side effects beyond the row insert; the
 * email enqueue belongs at the call site so each project can pick the
 * right channel (no email vs. transactional vs. marketing).
 */

import type { CreateNotificationInput } from './index';

export function welcomeNotification(userId: string, email: string): CreateNotificationInput {
  return {
    userId,
    type: 'WELCOME',
    title: 'Welcome!',
    body: `Glad to have you on board, ${email}.`,
    dedupeKey: `welcome:${userId}`,
  };
}

/**
 * Example: notification dispatched after a successful payment.
 * Called from the Bictorys webhook handler's `onPaid` post-commit hook.
 */
export function paymentReceived(
  userId: string,
  orderId: string,
  amount: number,
  currency: string,
): CreateNotificationInput {
  return {
    userId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    body: `Order ${orderId} for ${amount} ${currency} confirmed.`,
    data: { orderId, amount, currency },
    dedupeKey: `payment-received:${orderId}`,
  };
}

/**
 * Fired from POST /api/transactions when an expense pushes an envelope's
 * period-scoped spend past 50%, 80% (`isOverLimit=false` for both), or
 * 100% (`isOverLimit=true`) of its monthlyLimit. `periodStartIso` scopes
 * the dedupeKey so the same threshold can fire again next period.
 */
export function envelopeThresholdNotification(
  userId: string,
  envelope: { id: string; name: string },
  spentFcfa: number,
  limitFcfa: number,
  pct: number,
  periodStartIso: string,
  isOverLimit: boolean,
): CreateNotificationInput {
  return {
    userId,
    type: 'ENVELOPE_THRESHOLD',
    title: isOverLimit
      ? `Catégorie ${envelope.name} dépassée`
      : `Catégorie ${envelope.name} à ${pct}%`,
    body: isOverLimit
      ? `Tu as dépensé ${spentFcfa} F sur ${limitFcfa} F. Ajuste tes dépenses !`
      : `Tu as dépensé ${spentFcfa} F sur ${limitFcfa} F. Modère tes dépenses !`,
    data: { envelopeId: envelope.id, spentFcfa, limitFcfa, pct },
    dedupeKey: `envelope-threshold:${envelope.id}:${pct}:${periodStartIso}`,
  };
}

/** Fired from POST /api/tips/[id]/apply, only on real goal creation (never
 * on the idempotent replay branch). */
export function tipAppliedNotification(
  userId: string,
  goal: { id: string; name: string },
): CreateNotificationInput {
  return {
    userId,
    type: 'TIP_APPLIED',
    title: 'Conseil appliqué',
    body: `« ${goal.name} » a été ajouté à tes objectifs d'économie.`,
    data: { goalId: goal.id },
    dedupeKey: `tip-applied:${goal.id}`,
  };
}

/** Fired from POST /api/savings-goals/[id]/entries when an entry pushes
 * currentAmount from below targetAmount to at/above it — the goal just
 * completed. Fires at most once per goal (dedupeKey has no period/amount
 * component), even if later entries push currentAmount further past
 * targetAmount. */
export function goalMilestoneNotification(
  userId: string,
  goal: { id: string; name: string; targetAmount: number },
): CreateNotificationInput {
  return {
    userId,
    type: 'GOAL_MILESTONE',
    title: `Objectif atteint : ${goal.name}`,
    body: `Bravo ! Tu as économisé ${goal.targetAmount} F. Objectif atteint !`,
    data: { goalId: goal.id },
    dedupeKey: `goal-completed:${goal.id}`,
  };
}

const PACE_NOUN: Record<'daily' | 'weekly' | 'monthly', string> = {
  daily: 'hier',
  weekly: 'la semaine dernière',
  monthly: 'le mois dernier',
};

/** Fired from the savings-goal-reminders cron when a goal's most recently
 * completed pace period (yesterday/last week/last month) closed with less
 * saved than the user's stated `paceAmount`. `periodStartIso` scopes the
 * dedupeKey so the same goal can be reminded again next period, but only
 * once per period even if the cron runs more than once that day. */
export function savingsGoalPaceMissedNotification(
  userId: string,
  goal: { id: string; name: string; pace: 'daily' | 'weekly' | 'monthly'; paceAmount: number },
  savedFcfa: number,
  periodStartIso: string,
): CreateNotificationInput {
  return {
    userId,
    type: 'SAVINGS_GOAL_PACE_MISSED',
    title: `Objectif « ${goal.name} » en retard`,
    body:
      savedFcfa > 0
        ? `Tu as économisé ${savedFcfa} F sur ${goal.paceAmount} F prévus ${PACE_NOUN[goal.pace]}. Rattrape-toi !`
        : `Tu n'as rien économisé pour « ${goal.name} » ${PACE_NOUN[goal.pace]} (objectif : ${goal.paceAmount} F). Ajoute une économie !`,
    data: { goalId: goal.id, paceAmount: goal.paceAmount, savedFcfa },
    dedupeKey: `savings-goal-pace-missed:${goal.id}:${periodStartIso}`,
  };
}

export type InactivitySlot = 'midday' | 'evening';

// Two distinct copies rather than one reused string — a midday nudge and
// an end-of-day nudge read differently ("still time" vs "last chance"),
// same way Duolingo's reminder copy varies by time of day.
const INACTIVITY_COPY: Record<InactivitySlot, { title: string; body: string }> = {
  midday: {
    title: 'On n’a encore rien noté aujourd’hui 👀',
    body: 'Chaque franc compte, même celui du matin. Prends 10 secondes pour l’enregistrer — ton futur toi te dira merci. 🔥',
  },
  evening: {
    title: 'La journée se termine, pas ton objectif 🌙',
    body: 'Un champion ne remet jamais à demain ce qu’il peut noter ce soir. 10 secondes, et c’est fait. ✨',
  },
};

/** Fired from the inactivity-nudges cron (twice daily) when a user has
 * logged neither a Transaction nor a SavingsEntry since local midnight.
 * `dateIso` (the day being checked, not the fire time) + `slot` scope the
 * dedupeKey so each slot fires at most once per calendar day. */
export function inactivityNudgeNotification(
  userId: string,
  slot: InactivitySlot,
  dateIso: string,
): CreateNotificationInput {
  const copy = INACTIVITY_COPY[slot];
  return {
    userId,
    type: 'INACTIVITY_NUDGE',
    title: copy.title,
    body: copy.body,
    data: { slot },
    dedupeKey: `inactivity-nudge:${userId}:${dateIso}:${slot}`,
  };
}

// The "your trial ends soon" / "renew before you lapse" reminder
// notifications were removed — they duplicated the always-visible dashboard
// SubscriptionBanner. Forward-looking nudges live there now; the bell keeps
// only the fait-accompli SUBSCRIPTION_EXPIRED entry below.

/** Fired from the subscription-expiration cron right after a Pro period
 * (trial or paid) lapses without renewal and the account is flipped back to
 * Free. Nothing was deleted — the surplus enveloppes/objectifs were
 * archived, not removed (see subscriptions/archive.ts) — so the copy never
 * implies a data loss. Same mechanism/template for a non-converted trial
 * and a non-renewed paid subscription, only the wording differs
 * (`wasTrial`). `currentPeriodEnd` scopes the dedupeKey to the period that
 * just lapsed, so a later resubscribe-then-lapse-again cycle gets its own
 * notification. */
export function subscriptionExpiredNotification(
  userId: string,
  info: { wasTrial: boolean; currentPeriodEnd: Date },
): CreateNotificationInput {
  return {
    userId,
    type: 'SUBSCRIPTION_EXPIRED',
    title: info.wasTrial ? 'Ton essai Pro est terminé' : 'Ton abonnement Pro a expiré',
    body: info.wasTrial
      ? "Tu es repassé sur le plan Free. Rien n'est perdu : passe à Pro quand tu veux pour tout réactiver."
      : "Tu es repassé sur le plan Free faute de renouvellement. Rien n'est perdu : repasse à Pro quand tu veux pour tout réactiver.",
    data: { wasTrial: info.wasTrial },
    dedupeKey: `subscription-expired:${userId}:${info.currentPeriodEnd.toISOString()}`,
  };
}
