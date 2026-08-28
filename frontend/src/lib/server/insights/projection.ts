import 'server-only';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GoalProjection {
  /** F saved per day, based on the real spread between the first and most
   * recent entry — null when there isn't enough history to compute a rate. */
  ratePerDay: number | null;
  /** Estimated date the goal hits its target at the current rate — null
   * when already completed, no rate, or the rate is 0. */
  projectedDate: Date | null;
}

/**
 * Velocity-based completion estimate for a savings goal: takes every entry
 * ever logged (not scoped to the /insights date-selector — a goal's pace is
 * a property of the goal itself, not of whichever period you're currently
 * browsing), needs at least 2 entries to have a time span to compute a rate
 * from (mirrors the "≥2 data points" rule already used on the
 * economy-confirmed page's own projection).
 */
export function projectGoalCompletion(
  entries: Array<{ amount: number; createdAt: Date }>,
  targetAmount: number,
  currentAmount: number,
  now: Date = new Date(),
): GoalProjection {
  const remaining = targetAmount - currentAmount;
  if (remaining <= 0 || entries.length < 2) {
    return { ratePerDay: null, projectedDate: null };
  }

  const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const daySpan = Math.max(1, (last.createdAt.getTime() - first.createdAt.getTime()) / DAY_MS);
  const totalInSpan = sorted.reduce((sum, e) => sum + e.amount, 0);
  const ratePerDay = totalInSpan / daySpan;

  if (ratePerDay <= 0) {
    return { ratePerDay, projectedDate: null };
  }

  const daysToGo = Math.ceil(remaining / ratePerDay);
  const projectedDate = new Date(now.getTime() + daysToGo * DAY_MS);
  return { ratePerDay, projectedDate };
}
