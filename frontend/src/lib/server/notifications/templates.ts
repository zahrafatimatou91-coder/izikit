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
