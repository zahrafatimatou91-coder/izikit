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

/** Trial length granted once at signup — see isTrial() above and the
 * signup route. */
export const SUBSCRIPTION_TRIAL_DAYS = 7;

/** Paid period lengths in days, keyed by the `period` value a subscription
 * checkout is created with (`POST /api/orders` body's
 * `metadata: { purpose: 'subscription', period }`). 13 500 FCFA/an buys 365
 * days flat — no leap-year adjustment, matches the "3 mois offerts" pricing
 * framing in the spec rather than a precise 9×30-day count. */
export const SUBSCRIPTION_PERIOD_DAYS: Record<'monthly' | 'annual', number> = {
  monthly: 30,
  annual: 365,
};

/** Reminder windows before `currentPeriodEnd`, in days — consumed by the
 * subscription-expiration cron. A trial (never billed) and a paid renewal
 * get distinct copy and distinct windows (spec: -2j essai, -3j payant). */
export const SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS = 2;
export const SUBSCRIPTION_RENEWAL_REMINDER_DAYS = 3;

export interface SubscriptionOrderMetadata {
  purpose: 'subscription';
  period: 'monthly' | 'annual';
}

/**
 * Reads `Order.metadata` (an opaque `Prisma.JsonValue`) and returns a typed
 * subscription-purchase descriptor, or `null` if this order isn't a
 * subscription purchase (any other Order shape — e.g. a future non-
 * subscription use of the same generic checkout — is left untouched by the
 * webhook's subscription-activation branch).
 */
export function parseSubscriptionOrderMetadata(
  metadata: unknown,
): SubscriptionOrderMetadata | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const m = metadata as Record<string, unknown>;
  if (m.purpose !== 'subscription') return null;
  if (m.period !== 'monthly' && m.period !== 'annual') return null;
  return { purpose: 'subscription', period: m.period };
}
