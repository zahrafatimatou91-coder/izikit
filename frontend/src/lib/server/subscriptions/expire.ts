// frontend/src/lib/server/subscriptions/expire.ts
//
// One responsibility for the daily subscription-expiration cron:
//   expireLapsedSubscriptions — flip PRO subscriptions whose
//   currentPeriodEnd has passed back to FREE, archiving any surplus
//   envelopes/savings-goals (subscriptions/archive.ts). Covers both a
//   paid subscription that wasn't renewed and a trial that wasn't
//   converted — same mechanism, per the spec ("Fin d'essai non converti").
//
// The "your trial/subscription ends soon" *reminders* that used to live
// here were removed: they duplicated the always-visible dashboard
// SubscriptionBanner (components/subscription/SubscriptionBanner.tsx),
// which is a strictly better surface for a live, self-clearing state.
// Only the post-lapse SUBSCRIPTION_EXPIRED notification stays — that one
// records a fait accompli (plan flipped, surplus archived) worth a
// timestamped entry in the bell.
//
// The notification is created directly via createNotification(prisma, ...),
// never via the outbox — this cron isn't running inside a webhook's
// Serializable transaction, so there's no protected dispatcher.ts to touch
// (same posture as the existing savings-goal-reminders cron).
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '../notifications';
import { subscriptionExpiredNotification } from '../notifications/templates';
import { archiveSurplusForFreeDowngrade } from './archive';

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
