import 'server-only';
import { differenceInCalendarDays, subDays } from 'date-fns';

export type InsightsRange = 'this_week' | 'this_month' | 'last_month' | 'last_3_months';

export interface InsightsPeriod {
  label: string;
  start: Date;
  end: Date;
  /** The immediately preceding period of the same length — used to compute
   * "+12% vs période précédente" style deltas. */
  previousStart: Date;
  previousEnd: Date;
}

function startOfIsoWeek(now: Date): Date {
  const day = now.getDay(); // 0=Sun..6=Sat
  const isoWeekday = day === 0 ? 7 : day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoWeekday - 1));
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

const RANGE_LABELS: Record<InsightsRange, string> = {
  this_week: 'Cette semaine',
  this_month: 'Ce mois-ci',
  last_month: 'Le mois dernier',
  last_3_months: 'Les 3 derniers mois',
};

/** Resolves a date-selector preset into concrete [start, end] bounds plus
 * the equivalent preceding period, so /insights can show both "this
 * period's numbers" and "vs last time" deltas from one query. Presets
 * (not a free date-range picker) match the app's existing budget-period /
 * savings-pace convention — a full calendar range picker would be a much
 * bigger, inconsistent UI lift for the same information. */
export function resolveInsightsPeriod(
  range: InsightsRange,
  now: Date = new Date(),
): InsightsPeriod {
  const label = RANGE_LABELS[range];

  if (range === 'this_week') {
    const start = startOfIsoWeek(now);
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    const previousStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    const previousEnd = endOfDay(
      new Date(previousStart.getFullYear(), previousStart.getMonth(), previousStart.getDate() + 6),
    );
    return { label, start, end, previousStart, previousEnd };
  }

  if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return { label, start, end, previousStart, previousEnd };
  }

  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const previousEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 0));
    return { label, start, end, previousStart, previousEnd };
  }

  // last_3_months
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const previousEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() - 2, 0));
  return { label, start, end, previousStart, previousEnd };
}

export function isInsightsRange(value: string): value is InsightsRange {
  return (
    value === 'this_week' ||
    value === 'this_month' ||
    value === 'last_month' ||
    value === 'last_3_months'
  );
}

// ───────────────────────────────────────────────────────────────────────
// Custom date-range support (calendar picker) — additive to the preset
// path above, which stays untouched for backward compatibility (existing
// bookmarks/links using ?range=this_month keep working). The picker
// always resolves to concrete dates client-side (presets included), so it
// sends `from`/`to` for every selection; ?range= remains the fallback for
// the initial page load before the user has touched the picker.

/** Parses a `YYYY-MM-DD` date-only string into a local midnight Date.
 * Returns null on malformed input or a calendar overflow (e.g.
 * "2026-02-30" silently rolling into March) rather than producing a
 * date that doesn't match what was typed. */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, yStr, moStr, dStr] = m as unknown as [string, string, string, string];
  const year = Number(yStr);
  const month = Number(moStr) - 1;
  const day = Number(dStr);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function formatFrenchDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// Defensive cap against a pathological query (e.g. a 50-year window) —
// generous enough that no legitimate use case hits it.
const MAX_CUSTOM_RANGE_DAYS = 366 * 3;

/** Resolves an explicit [from, to] calendar-picker range into concrete
 * bounds plus the immediately preceding period of equal length, mirroring
 * resolveInsightsPeriod's preset logic so /insights can show the same
 * "vs période précédente" deltas for a custom range. `to` is inclusive
 * (resolved to end-of-day). Returns null when the range is invalid: `to`
 * before `from`, or wider than MAX_CUSTOM_RANGE_DAYS. */
export function resolveCustomInsightsPeriod(from: Date, to: Date): InsightsPeriod | null {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (endDay.getTime() < start.getTime()) return null;

  const spanDays = differenceInCalendarDays(endDay, start); // 0 for a single day
  if (spanDays > MAX_CUSTOM_RANGE_DAYS) return null;

  const end = endOfDay(endDay);
  const previousEndDay = subDays(start, 1);
  const previousStart = subDays(previousEndDay, spanDays);
  const previousEnd = endOfDay(previousEndDay);

  return {
    label: `${formatFrenchDate(start)} – ${formatFrenchDate(endDay)}`,
    start,
    end,
    previousStart,
    previousEnd,
  };
}
