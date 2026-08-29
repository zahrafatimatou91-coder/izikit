// frontend/src/lib/server/subscriptions/expire.ts
//
// Two responsibilities for the daily subscription-expiration cron:
//   1. expireLapsedSubscriptions — flip PRO subscriptions whose
//      currentPeriodEnd has passed back to FREE, archiving any surplus
//      envelopes/savings-goals (subscriptions/archive.ts). Covers both a
//      paid subscription that wasn't renewed and a trial that wasn't
//      converted — same mechanism, per the spec ("Fin d'essai non converti").
//   2. sendUpcomingSubscriptionReminders — notify users whose PRO
//      subscription is about to lapse: -2 days for a trial
//      (lastOrderId === null), -3 days for a paid subscription.
//
// Notifications are created directly via createNotification(prisma, ...),
// never via the outbox — this cron isn't running inside a webhook's
// Serializable transaction, so there's no protected dispatcher.ts to touch
// (same posture as the existing savings-goal-reminders cron).
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '../notifications';
import {
  subscriptionTrialEndingNotification,
  subscriptionRenewalReminderNotification,
  subscriptionExpiredNotification,
} from '../notifications/templates';
import {
  SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS,
  SUBSCRIPTION_RENEWAL_REMINDER_DAYS,
} from './tier';
import { archiveSurplusForFreeDowngrade } from './archive';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExpireLapsedSubscriptionsOptions {
  prisma: PrismaClient;
  batchSize?: number; // default 100
  now?: Date;
}

export async function expireLapsedSubscriptions(
  opts: ExpireLapsedSubscriptionsOptions,
): Promise<{ expired: number }> {
  const batchSize = opts.batchSize ?? 100;
  const now = opts.now ?? new Date();

  const candidates = await opts.prisma.subscription.findMany({
    where: { plan: 'PRO', currentPeriodEnd: { lt: now } },
    orderBy: { currentPeriodEnd: 'asc' },
    take: batchSize,
    select: { id: true, userId: true, lastOrderId: true, currentPeriodEnd: true },
  });

  if (candidates.length === 0) return { expired: 0 };

  let expired = 0;
  for (const sub of candidates) {
    if (!sub.currentPeriodEnd) continue; // can't happen given the WHERE above; keeps TS happy
    const wasTrial = sub.lastOrderId === null;

    // plan='PRO' WHERE-guard prevents racing with a webhook that just
    // renewed this subscription (mirrors orders/expire.ts's WR-01 pattern).
    // The notification is issued OUTSIDE this transaction, using the plain
    // `prisma` client — createNotification's signature takes a full
    // PrismaClient, not a transaction client, and there's no correctness
    // requirement that the flip and the notification commit atomically.
    const flipped = await opts.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.updateMany({
        where: { id: sub.id, plan: 'PRO' },
        data: { plan: 'FREE' },
      });
      if (updated.count === 0) return false;
      await archiveSurplusForFreeDowngrade(tx, sub.userId);
      return true;
    });
    if (!flipped) continue;
    expired++;

    try {
      await createNotification(
        opts.prisma,
        subscriptionExpiredNotification(sub.userId, {
          wasTrial,
          currentPeriodEnd: sub.currentPeriodEnd,
        }),
      );
    } catch {
      // Swallow — one user's notification hiccup shouldn't stop the batch
      // (same posture as savings-goal-reminders / withdrawals routes).
    }
  }
  return { expired };
}

export interface SendUpcomingSubscriptionRemindersOptions {
  prisma: PrismaClient;
  now?: Date;
}

export async function sendUpcomingSubscriptionReminders(
  opts: SendUpcomingSubscriptionRemindersOptions,
): Promise<{ trialReminded: number; renewalReminded: number }> {
  const now = opts.now ?? new Date();
  const maxWindowDays = Math.max(
    SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS,
    SUBSCRIPTION_RENEWAL_REMINDER_DAYS,
  );
  const horizon = new Date(now.getTime() + maxWindowDays * DAY_MS);

  const upcoming = await opts.prisma.subscription.findMany({
    where: { plan: 'PRO', currentPeriodEnd: { gt: now, lte: horizon } },
    select: { userId: true, lastOrderId: true, currentPeriodEnd: true },
  });

  let trialReminded = 0;
  let renewalReminded = 0;

  for (const sub of upcoming) {
    if (!sub.currentPeriodEnd) continue;
    const daysLeft = (sub.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS;
    const isTrialSub = sub.lastOrderId === null;

    try {
      if (isTrialSub) {
        if (daysLeft > SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS) continue;
        const [envelopeCount, goalCount] = await Promise.all([
          opts.prisma.envelope.count({ where: { userId: sub.userId, archivedAt: null } }),
          opts.prisma.savingsGoal.count({ where: { userId: sub.userId, archivedAt: null } }),
        ]);
        const created = await createNotification(
          opts.prisma,
          subscriptionTrialEndingNotification(sub.userId, {
            currentPeriodEnd: sub.currentPeriodEnd,
            envelopeCount,
            goalCount,
          }),
        );
        if (created) trialReminded++;
      } else {
        if (daysLeft > SUBSCRIPTION_RENEWAL_REMINDER_DAYS) continue;
        const created = await createNotification(
          opts.prisma,
          subscriptionRenewalReminderNotification(sub.userId, {
            currentPeriodEnd: sub.currentPeriodEnd,
          }),
        );
        if (created) renewalReminded++;
      }
    } catch {
      // Swallow — same posture as expireLapsedSubscriptions above.
    }
  }

  return { trialReminded, renewalReminded };
}
