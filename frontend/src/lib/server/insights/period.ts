import 'server-only';

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
