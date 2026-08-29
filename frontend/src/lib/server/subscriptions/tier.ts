// frontend/src/lib/server/subscriptions/tier.ts
//
// Effective-plan computation and Free-tier limits. Every route that gates
// a feature imports from here — never re-derive this logic inline.
//
// IMPORTANT: never gate on the raw `Subscription.plan` column alone. A
// lapsed Pro period still reads `plan: 'PRO'` in the DB until the daily
// `subscription-expiration` cron catches up (up to ~24h lag) — see the
// follow-up plan for that cron. `getEffectivePlan` always computes the
// LIVE state by also checking `currentPeriodEnd`, so gating is correct
// regardless of cron timing. The cron is only responsible for the
// *side effects* of a lapse (archiving over-limit rows, sending the
// "your Pro ended" notification) — not for access control.
import 'server-only';

export type EffectivePlan = 'FREE' | 'PRO';

export interface SubscriptionLike {
  plan: string;
  currentPeriodEnd: Date | null;
}

/** Free tier: 2 envelopes max (spec "Chantier 1"). */
export const FREE_MAX_ENVELOPES = 2;
/** Free tier: savings goals are 100% Pro-exclusive. */
export const FREE_MAX_SAVINGS_GOALS = 0;
/** Free tier: history visible = current month + this many months back. */
export const FREE_HISTORY_MONTHS_BACK = 1;

export function getEffectivePlan(sub: SubscriptionLike | null): EffectivePlan {
  if (!sub) return 'FREE';
  if (sub.plan !== 'PRO') return 'FREE'; // covers FREE and the unused PLUS reservation
  if (sub.currentPeriodEnd === null) return 'PRO'; // defensive: every PRO row this app creates sets an expiry
  return sub.currentPeriodEnd.getTime() > Date.now() ? 'PRO' : 'FREE';
}

/**
 * A subscription is "trial" iff it's currently effective PRO and no real
 * order has ever paid for it (`lastOrderId` stays null for the entire
 * 7-day trial window — see the checkout plan). Once a payment lands,
 * `lastOrderId` is set and it becomes a paid subscription even if the
 * plan/currentPeriodEnd values look identical in shape.
 */
export function isTrial(sub: SubscriptionLike & { lastOrderId: string | null }): boolean {
  return sub.lastOrderId === null && getEffectivePlan(sub) === 'PRO';
}

/**
 * First instant (UTC) of the earliest month a Free account may see in its
 * transaction history. `null` means no floor — show everything (Pro).
 */
export function getHistoryFloor(plan: EffectivePlan, now: Date = new Date()): Date | null {
  if (plan === 'PRO') return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - FREE_HISTORY_MONTHS_BACK, 1));
}
