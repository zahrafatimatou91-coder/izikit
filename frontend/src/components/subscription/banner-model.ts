// Pure decision logic for the dashboard SubscriptionBanner — no React, no
// next, so it's unit-testable on its own. The component (SubscriptionBanner.tsx)
// just renders whatever this returns.
//
// This banner is the ONLY surface for "your trial ends soon" / "renew before
// you lapse" — the equivalent one-off notifications were retired (see
// lib/server/subscriptions/expire.ts). A persistent, self-clearing banner
// beats a ping that gets buried: it reflects live state (gone the moment you
// renew), sits where people already look, and carries its own CTA.
import { TRIAL_BANNER_URGENT_DAYS, RENEWAL_BANNER_URGENT_DAYS } from '@/lib/subscription-plans';

export interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  status: string;
  currentPeriodEnd: string | null;
  isTrial: boolean;
}

export type BannerModel =
  | { kind: 'trial-calm'; days: number; dismissKey: string }
  | { kind: 'trial-urgent'; days: number }
  | { kind: 'renewal-urgent'; days: number }
  | { kind: 'free-lapsed'; dismissKey: string }
  | { kind: 'free-upsell'; dismissKey: string }
  | null;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between now and `iso`, rounded up (0.1 day left still reads
 * "1 jour"). Negative once the date has passed. */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

export function computeModel(sub: SubscriptionStatus): BannerModel {
  const end = sub.currentPeriodEnd;

  if (sub.plan === 'PRO' && end) {
    const days = Math.max(0, daysUntil(end));
    if (sub.isTrial) {
      if (days <= TRIAL_BANNER_URGENT_DAYS) return { kind: 'trial-urgent', days };
      return { kind: 'trial-calm', days, dismissKey: `cf:subBanner:${end}` };
    }
    // Paid Pro — only nag in the final stretch; a healthy subscriber sees nothing.
    if (days <= RENEWAL_BANNER_URGENT_DAYS) return { kind: 'renewal-urgent', days };
    return null;
  }

  if (sub.plan === 'FREE') {
    // A period end still on record = a trial or paid period that lapsed.
    if (end) return { kind: 'free-lapsed', dismissKey: `cf:subBanner:lapsed:${end}` };
    // No history at all (e.g. an account older than the subscription
    // feature) — a plain, dismissible upsell.
    return { kind: 'free-upsell', dismissKey: 'cf:subBanner:upsell' };
  }

  return null;
}

export function dayLabel(days: number): string {
  return days <= 1 ? "aujourd'hui" : `dans ${days} jours`;
}
