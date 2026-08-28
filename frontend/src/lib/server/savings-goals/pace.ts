import 'server-only';

export type SavingsGoalPace = 'daily' | 'weekly' | 'monthly';

export interface PacePeriod {
  start: Date;
  end: Date;
}

/** The most recently *completed* pace period before `now` — yesterday for
 * a daily pace, last ISO week (Mon–Sun) for weekly, last calendar month for
 * monthly. Deliberately the previous period, not the still-in-progress
 * current one: the reminders cron asks "did they hit their pace during the
 * period that just closed?", not "are they behind on today's". */
export function previousPacePeriod(pace: SavingsGoalPace, now: Date = new Date()): PacePeriod {
  if (pace === 'daily') {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return { start: y, end: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999) };
  }

  if (pace === 'weekly') {
    const day = now.getDay(); // 0=Sun..6=Sat
    const isoWeekday = day === 0 ? 7 : day;
    const thisWeekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (isoWeekday - 1),
    );
    const start = new Date(
      thisWeekStart.getFullYear(),
      thisWeekStart.getMonth(),
      thisWeekStart.getDate() - 7,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  // monthly
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

/** Whether `now` is the day a just-closed period for this pace should be
 * checked — daily pace goals are checked every day (yesterday just always
 * closed); weekly only the day an ISO week rolls over (Monday), so a
 * weekly-pace user isn't reminded 7 times for the same missed week; monthly
 * only on the 1st of the month. */
export function isPaceCheckDay(pace: SavingsGoalPace, now: Date = new Date()): boolean {
  if (pace === 'daily') return true;
  if (pace === 'weekly') return now.getDay() === 1; // Monday
  return now.getDate() === 1;
}
