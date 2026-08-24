import 'server-only';

export interface BudgetPeriod {
  start: Date;
  end: Date;
  daysLeft: number;
}

/** Computes the current budget period's bounds + remaining days, based on
 * the user's `budgetFrequency` (set during onboarding). Defaults to
 * monthly when unset (pre-onboarding users). Used by /api/dashboard and
 * /api/envelopes to scope "spent this period" aggregates. */
export function currentBudgetPeriod(
  frequency: string | null | undefined,
  now: Date = new Date(),
): BudgetPeriod {
  if (frequency === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end, daysLeft: 1 };
  }

  if (frequency === 'weekly') {
    // ISO week: Monday..Sunday.
    const day = now.getDay(); // 0=Sun..6=Sat
    const isoWeekday = day === 0 ? 7 : day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoWeekday - 1));
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
      23,
      59,
      59,
      999,
    );
    return { start, end, daysLeft: 7 - isoWeekday + 1 };
  }

  // monthly (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const daysInMonth = end.getDate();
  return { start, end, daysLeft: daysInMonth - now.getDate() + 1 };
}
