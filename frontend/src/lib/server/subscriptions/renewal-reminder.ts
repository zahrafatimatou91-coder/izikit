// frontend/src/lib/server/subscriptions/renewal-reminder.ts
//
// One responsibility for the daily subscription-renewal-reminders cron:
// email a user once when their PAID Pro subscription is about to lapse.
//
// Why an email, when subscription-expiration/expire.ts already documents
// dropping pre-lapse reminders in favor of the dashboard SubscriptionBanner?
// The banner only reaches a user who opens the app. This app's payment
// providers (Bictorys, Moneroo) are Mobile Money hosted-checkout — there is
// no card-on-file, so renewal is always a manual action the user takes
// through a fresh checkout. A user who doesn't happen to open the app before
// `currentPeriodEnd` gets no signal at all and silently drops back to Free.
// The email is a genuinely different channel for a genuinely different
// failure mode, not a restatement of what the banner already shows in-app —
// see the project's "no notification/UI repetition" rule.
//
// Scope: PAID subscriptions only (`lastOrderId !== null`). A trial ending
// isn't a "renewal" (nothing was ever charged) and has its own conversion
// framing; the trial-ending case stays covered by the banner alone, per the
// existing design. Sent once per `currentPeriodEnd` via
// `Subscription.renewalReminderSentForPeriodEnd` — a renewal that extends
// `currentPeriodEnd` naturally re-arms the reminder for the new period.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../logger';
import { isChannelEnabled, type NotificationPrefs } from '../notifications/prefs-merge';
import { RENEWAL_BANNER_URGENT_DAYS, SUBSCRIPTION_PRICES } from '@/lib/subscription-plans';
import { renewalReminderEmail } from './renewal-email';
import type { SubscriptionOrderMetadata } from './tier';
import { parseSubscriptionOrderMetadata } from './tier';

const log = createLogger();

/** The event-type key gating this reminder via NotificationPreferences —
 * same opt-out mechanism as every other cron-driven reminder in this app. */
export const RENEWAL_REMINDER_EVENT_TYPE = 'SUBSCRIPTION_RENEWAL';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal shape this module needs from EmailQueue — kept structural rather
 * than importing the concrete class, so a test double doesn't need Redis. */
export interface RenewalReminderEmailQueue {
  enqueue(input: { to: string; subject: string; html: string; text?: string }): Promise<string>;
}

export interface SendUpcomingRenewalRemindersOptions {
  prisma: PrismaClient;
  /** `null` when Resend/Upstash aren't configured — skips every candidate,
   * same posture as every other emailQueue-consuming cron in this app. */
  emailQueue: RenewalReminderEmailQueue | null;
  batchSize?: number; // default 200
  now?: Date;
  /** Days-before-expiry threshold at which the reminder fires. Defaults to
   * RENEWAL_BANNER_URGENT_DAYS (7) — the same day the dashboard banner
   * itself switches to its urgent tone, so the email and the in-app state
   * change together. */
  urgentDays?: number;
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

export async function sendUpcomingRenewalReminders(
  opts: SendUpcomingRenewalRemindersOptions,
): Promise<{ checked: number; reminded: number }> {
  const batchSize = opts.batchSize ?? 200;
  const now = opts.now ?? new Date();
  const urgentDays = opts.urgentDays ?? RENEWAL_BANNER_URGENT_DAYS;

  if (!opts.emailQueue) {
    log.warn('subscription-renewal-reminders: email queue not configured — skipping tick');
    return { checked: 0, reminded: 0 };
  }

  // Paid Pro only (lastOrderId set) — see module doc. currentPeriodEnd is
  // guaranteed set for every real PRO row this app creates (defensive
  // `not: null` matches getEffectivePlan's own comment on that invariant).
  const candidates = await opts.prisma.subscription.findMany({
    where: {
      plan: 'PRO',
      status: 'ACTIVE',
      lastOrderId: { not: null },
      currentPeriodEnd: { not: null, gt: now },
    },
    select: {
      id: true,
      userId: true,
      currentPeriodEnd: true,
      renewalReminderSentForPeriodEnd: true,
      lastOrderId: true,
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
  const [users, prefsRows, orders] = await Promise.all([
    opts.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    }),
    opts.prisma.notificationPreferences.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, prefs: true },
    }),
    opts.prisma.order.findMany({
      where: {
        id: { in: due.map((s) => s.lastOrderId).filter((id): id is string => id !== null) },
      },
      select: { id: true, metadata: true },
    }),
  ]);
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));
  const prefsByUser = new Map(
    prefsRows.map((row) => [row.userId, row.prefs as NotificationPrefs | null]),
  );
  const orderMetaById = new Map(
    orders.map((o) => [o.id, parseSubscriptionOrderMetadata(o.metadata)]),
  );

  let reminded = 0;
  for (const sub of due) {
    if (!sub.currentPeriodEnd) continue;
    if (!isChannelEnabled(prefsByUser.get(sub.userId), RENEWAL_REMINDER_EVENT_TYPE, 'email')) {
      continue;
    }
    const email = emailByUser.get(sub.userId);
    if (!email) continue;

    const orderMeta: SubscriptionOrderMetadata | null = sub.lastOrderId
      ? (orderMetaById.get(sub.lastOrderId) ?? null)
      : null;
    const period = orderMeta?.period ?? 'monthly';
    const daysLeft = daysUntil(sub.currentPeriodEnd, now);

    try {
      const tpl = renewalReminderEmail({
        daysLeft,
        periodEnd: sub.currentPeriodEnd.toISOString(),
        amount: SUBSCRIPTION_PRICES[period],
        period,
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
      // posture as savings-goal-reminders / expire.ts).
      log.warn('subscription-renewal-reminders: send failed', {
        subscriptionId: sub.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked: candidates.length, reminded };
}
