// Pure decision logic for the dashboard SubscriptionBanner — no React, no
// next, so it's unit-testable on its own. The component (SubscriptionBanner.tsx)
// just renders whatever this returns.
//
// This banner is the ONLY surface for "your trial ends soon" / "renew before
// you lapse" — the equivalent one-off notifications were retired (see
// lib/server/subscriptions/expire.ts). A persistent, self-clearing banner
// beats a ping that gets buried: it reflects live state (gone the moment you
// renew), sits where people already look, and carries its own CTA.
//
// Dismiss semantics (see `Dismissible` below):
//   - The two *conversion* banners (free-upsell, free-lapsed) can be closed,
//     but the close is a SNOOZE, not a permanent hide: it comes back after
//     `snoozeHours`. A Free user should keep seeing the offer every time they
//     come back — just not on every interaction within one sitting. It
//     disappears for good only when they actually go Pro (state-driven).
//   - trial-calm is closable and the dismissal sticks, because its key is
//     scoped to the current trial period and it turns into the
//     non-dismissible trial-urgent within a few days anyway.
//   - trial-urgent / renewal-urgent are never closable — they're
//     time-critical.
import { TRIAL_BANNER_URGENT_DAYS, RENEWAL_BANNER_URGENT_DAYS } from '@/lib/subscription-plans';

export interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  status: string;
  currentPeriodEnd: string | null;
  isTrial: boolean;
}

export interface Dismissible {
  /** localStorage key the component reads/writes. */
  key: string;
  /** When set, closing the banner only hides it for this many hours, then it
   * returns. When absent, the dismissal sticks for as long as the key is
   * valid (the key itself carries the scope — e.g. the trial period). */
  snoozeHours?: number;
}

export type BannerModel =
  | { kind: 'trial-calm'; days: number; dismiss: Dismissible }
  | { kind: 'trial-urgent'; days: number }
  | { kind: 'renewal-urgent'; days: number }
  | { kind: 'free-lapsed'; dismiss: Dismissible }
  | { kind: 'free-upsell'; dismiss: Dismissible }
  | null;

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long "close" hides a conversion banner before it comes back. One day:
 * a user who checks their budget daily gets one fresh nudge per day, a user
 * who opens the app five times in an afternoon isn't nagged five times. */
export const CONVERSION_SNOOZE_HOURS = 24;

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
      // Sticks for this trial period; becomes trial-urgent (non-dismissible) soon.
      return { kind: 'trial-calm', days, dismiss: { key: `cf:subBanner:${end}` } };
    }
    // Paid Pro — only nag in the final stretch; a healthy subscriber sees nothing.
    if (days <= RENEWAL_BANNER_URGENT_DAYS) return { kind: 'renewal-urgent', days };
    return null;
  }

  if (sub.plan === 'FREE') {
    // A period end still on record = a trial or paid period that lapsed.
    if (end) {
      return {
        kind: 'free-lapsed',
        dismiss: { key: 'cf:subBanner:lapsed', snoozeHours: CONVERSION_SNOOZE_HOURS },
      };
    }
    // No history at all (e.g. an account older than the subscription feature).
    return {
      kind: 'free-upsell',
      dismiss: { key: 'cf:subBanner:upsell', snoozeHours: CONVERSION_SNOOZE_HOURS },
    };
  }

  return null;
}

export function dayLabel(days: number): string {
  return days <= 1 ? "aujourd'hui" : `dans ${days} jours`;
}

/**
 * Is this banner currently dismissed? `raw` is whatever the component read
 * from localStorage for `d.key` (or null). Pure so it's testable without a
 * DOM. `now` is injectable for tests.
 */
export function isDismissed(d: Dismissible, raw: string | null, now: number = Date.now()): boolean {
  if (!raw) return false;
  if (!d.snoozeHours) return raw === '1';
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return now - ts < d.snoozeHours * 60 * 60 * 1000;
}

/** The value to persist when the user closes the banner. */
export function dismissValue(d: Dismissible, now: number = Date.now()): string {
  return d.snoozeHours ? String(now) : '1';
}
