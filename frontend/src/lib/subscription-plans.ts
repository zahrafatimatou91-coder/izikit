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

/** Days-left thresholds at which the dashboard SubscriptionBanner switches
 * from its calm "info" tone to the urgent, non-dismissible "act now" tone.
 * These replaced the old -2j / -3j reminder *notifications* (retired in
 * favour of the always-visible banner): a persistent banner can afford a
 * wider warning window than a one-off ping. */
export const TRIAL_BANNER_URGENT_DAYS = 3;
export const RENEWAL_BANNER_URGENT_DAYS = 7;

/** Free/Pro comparison rows — shared between `/subscription` (the full
 * comparison table) and the landing page's Tarifs section (a condensed
 * pricing-card list), so the two never drift out of sync. */
export interface FeatureRow {
  label: string;
  free: string;
  pro: string;
}

export const FEATURE_ROWS: FeatureRow[] = [
  { label: 'Enveloppes', free: '2 max', pro: 'Illimitées' },
  { label: "Objectifs d'épargne", free: '—', pro: 'Illimités' },
  { label: 'Historique', free: '2 derniers mois', pro: 'Complet' },
  { label: 'Tendances', free: '—', pro: '✓' },
  { label: 'Conseils personnalisés', free: '—', pro: '✓' },
  { label: 'Notifications', free: 'Dépassement uniquement', pro: 'Toutes' },
];
