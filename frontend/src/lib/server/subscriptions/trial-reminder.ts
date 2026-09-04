// frontend/src/lib/server/subscriptions/trial-reminder.ts
//
// One responsibility for the daily subscription-renewal-reminders cron:
// email a user once when their Pro TRIAL (never paid — lastOrderId: null)
// is about to lapse back to Free.
//
// Companion to renewal-reminder.ts's paid-subscription email — same gap it
// closes: the dashboard SubscriptionBanner shows "Tu profites de 7 jours
// d'essai Pro..." but only reaches a user who actually opens the app. A
// trial user who never comes back before `currentPeriodEnd` got no signal
// at all and silently dropped to Free. Previously ONLY paid subscriptions
// got an email reminder (see renewal-reminder.ts's original module doc,
// "the trial-ending case stays covered by the banner alone, per the
// existing design") — this closes that gap for trials too.
//
// Dedup reuses the SAME Subscription.renewalReminderSentForPeriodEnd column
// as the paid reminder: a subscription is either in trial (lastOrderId ===
// null) or paid (lastOrderId !== null) at any given time, never both, so
// "have we already emailed about this exact currentPeriodEnd" means the
// same thing regardless of which email type fired.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../logger';
import { isChannelEnabled, type NotificationPrefs } from '../notifications/prefs-merge';
import { TRIAL_BANNER_URGENT_DAYS } from '@/lib/subscription-plans';
import { trialEndingEmail } from './trial-email';

const log = createLogger();

/** The event-type key gating this reminder via NotificationPreferences —
 * same opt-out mechanism as every other cron-driven reminder in this app. */
export const TRIAL_ENDING_EVENT_TYPE = 'SUBSCRIPTION_TRIAL_ENDING';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal shape this module needs from EmailQueue — kept structural rather
 * than importing the concrete class, so a test double doesn't need Redis. */
export interface TrialReminderEmailQueue {
  enqueue(input: { to: string; subject: string; html: string; text?: string }): Promise<string>;
}

export interface SendTrialEndingRemindersOptions {
  prisma: PrismaClient;
  /** `null` when Resend/Upstash aren't configured — skips every candidate,
   * same posture as every other emailQueue-consuming cron in this app. */
  emailQueue: TrialReminderEmailQueue | null;
  batchSize?: number; // default 200
  now?: Date;
  /** Days-before-expiry threshold at which the reminder fires. Defaults to
   * TRIAL_BANNER_URGENT_DAYS (3) — the same day the dashboard banner itself
   * switches to its urgent tone, so the email and the in-app state change
   * together (mirrors renewal-reminder.ts's own urgentDays convention). */
  urgentDays?: number;
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

export async function sendTrialEndingReminders(
  opts: SendTrialEndingRemindersOptions,
): Promise<{ checked: number; reminded: number }> {
  const batchSize = opts.batchSize ?? 200;
  const now = opts.now ?? new Date();
  const urgentDays = opts.urgentDays ?? TRIAL_BANNER_URGENT_DAYS;

  if (!opts.emailQueue) {
    log.warn('subscription-renewal-reminders: trial email queue not configured — skipping tick');
    return { checked: 0, reminded: 0 };
  }

  // Trial Pro only (lastOrderId null) — see module doc. currentPeriodEnd is
  // guaranteed set for every real PRO row this app creates.
  const candidates = await opts.prisma.subscription.findMany({
    where: {
      plan: 'PRO',
      status: 'ACTIVE',
      lastOrderId: null,
      currentPeriodEnd: { not: null, gt: now },
    },
    select: {
      id: true,
      userId: true,
      currentPeriodEnd: true,
      renewalReminderSentForPeriodEnd: true,
    },
    take: batchSize,
  });
  if (candidates.length === 0) return { checked: 0, reminded: 0 };

  const due = candidates.filter((sub) => {
    if (!sub.currentPeriodEnd) return false; // can't happen given the WHERE above
    const daysLeft = daysUntil(sub.currentPeriodEnd, now);
    if (daysLeft > urgentDays || daysLeft <= 0) return false;
    if (
      sub.renewalReminderSentForPeriodEnd &&
      sub.renewalReminderSentForPeriodEnd.getTime() === sub.currentPeriodEnd.getTime()
    ) {
      return false; // already reminded for this exact period
    }
    return true;
  });
  if (due.length === 0) return { checked: candidates.length, reminded: 0 };

  const userIds = due.map((s) => s.userId);
  const [users, prefsRows] = await Promise.all([
    opts.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    }),
    opts.prisma.notificationPreferences.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, prefs: true },
    }),
  ]);
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));
  const prefsByUser = new Map(
    prefsRows.map((row) => [row.userId, row.prefs as NotificationPrefs | null]),
  );

  let reminded = 0;
  for (const sub of due) {
    if (!sub.currentPeriodEnd) continue;
    if (!isChannelEnabled(prefsByUser.get(sub.userId), TRIAL_ENDING_EVENT_TYPE, 'email')) {
      continue;
    }
    const email = emailByUser.get(sub.userId);
    if (!email) continue;

    const daysLeft = daysUntil(sub.currentPeriodEnd, now);

    try {
      // Small, bounded (only "due" candidates, typically a handful/day) —
      // two per-user counts are simpler and easier to test than a groupBy.
      const [envelopeCount, savingsGoalCount] = await Promise.all([
        opts.prisma.envelope.count({ where: { userId: sub.userId, archivedAt: null } }),
        opts.prisma.savingsGoal.count({ where: { userId: sub.userId, archivedAt: null } }),
      ]);

      const tpl = trialEndingEmail({
        daysLeft,
        periodEnd: sub.currentPeriodEnd.toISOString(),
        envelopeCount,
        savingsGoalCount,
      });
      await opts.emailQueue.enqueue({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      await opts.prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalReminderSentForPeriodEnd: sub.currentPeriodEnd },
      });
      reminded++;
    } catch (err) {
      // Swallow — one user's email hiccup shouldn't stop the batch (same
      // posture as renewal-reminder.ts / expire.ts).
      log.warn('subscription-renewal-reminders: trial reminder send failed', {
        subscriptionId: sub.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked: candidates.length, reminded };
}
