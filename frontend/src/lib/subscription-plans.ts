// frontend/src/lib/subscription-plans.ts
//
// Client-safe subscription display constants — NOT under lib/server/, no
// `server-only` import, so it can be used from 'use client' pages. Deliber-
// ately duplicates the two numbers also declared in
// lib/server/subscriptions/tier.ts's SUBSCRIPTION_PRICE_FCFA (a server-only
// file this can't import). That table is what the webhook actually
// enforces (see its price-check in onPaid) — a drift here would at worst
// display the wrong price, never charge the wrong one.
export const SUBSCRIPTION_PRICES: Record<'monthly' | 'annual', number> = {
  monthly: 1500,
  annual: 13500,
};

/** Daily-equivalent framing for the annual price ("~37 FCFA/jour") — makes
 * the total look more affordable without changing the real price. Rounded
 * to the nearest franc (FCFA has no sub-unit). */
export function getDailyEquivalentFcfa(annualPriceFcfa: number): number {
  return Math.round(annualPriceFcfa / 365);
}
