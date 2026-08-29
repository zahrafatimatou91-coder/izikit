// POST /api/cron/savings-goal-reminders — checks every SavingsGoal that has
// a pace set (paceAmount != null) against its most recently completed pace
// period (yesterday for daily, last ISO week for weekly, last calendar
// month for monthly) and notifies the user once if they saved less than
// their stated pace amount during it. isPaceCheckDay() gates weekly/monthly
// goals to only be evaluated on the day their period actually closed, so a
// weekly-pace user isn't checked (and potentially reminded) 7 times for the
// same week. Runs once daily.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // D-10

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { createNotification } from '@/lib/server/notifications';
import { savingsGoalPaceMissedNotification } from '@/lib/server/notifications/templates';
import { isChannelEnabled, type NotificationPrefs } from '@/lib/server/notifications/prefs-merge';
import {
  previousPacePeriod,
  isPaceCheckDay,
  type SavingsGoalPace,
} from '@/lib/server/savings-goals/pace';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();
const LEASE_TTL_MS = 60_000; // ~2 × maxDuration (Pitfall 3)
const PACES: SavingsGoalPace[] = ['daily', 'weekly', 'monthly'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let checked = 0;
    let reminded = 0;

    await withLease(redis ?? undefined, 'savings-goal-reminders', LEASE_TTL_MS, async () => {
      const now = new Date();
      const duePaces = PACES.filter((p) => isPaceCheckDay(p, now));
      if (duePaces.length === 0) return;

      const goals = await prisma.savingsGoal.findMany({
        where: { period: { in: duePaces }, paceAmount: { not: null } },
        select: {
          id: true,
          userId: true,
          name: true,
          period: true,
          paceAmount: true,
          targetAmount: true,
          currentAmount: true,
        },
      });
      checked = goals.length;

      // Per-user opt-out (Settings → "Objectifs en retard"). Missing row /
      // missing channel ⇒ enabled (D-10 opt-out), same as inactivity-nudges.
      const userIds = [...new Set(goals.map((g) => g.userId))];
      const prefsRows = userIds.length
        ? await prisma.notificationPreferences.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, prefs: true },
          })
        : [];
      const prefsByUser = new Map(
        prefsRows.map((row) => [row.userId, row.prefs as NotificationPrefs | null]),
      );

      for (const goal of goals) {
        if (goal.currentAmount >= goal.targetAmount) continue; // already completed
        if (!isChannelEnabled(prefsByUser.get(goal.userId), 'SAVINGS_GOAL_PACE_MISSED', 'inApp')) {
          continue;
        }
        const pace = goal.period as SavingsGoalPace;
        const { start, end } = previousPacePeriod(pace, now);
        const saved = await prisma.savingsEntry.aggregate({
          where: { savingsGoalId: goal.id, createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        });
        const savedAmount = saved._sum.amount ?? 0;
        if (savedAmount >= (goal.paceAmount ?? 0)) continue;

        try {
          const created = await createNotification(
            prisma,
            savingsGoalPaceMissedNotification(
              goal.userId,
              { id: goal.id, name: goal.name, pace, paceAmount: goal.paceAmount ?? 0 },
              savedAmount,
              start.toISOString(),
            ),
          );
          if (created) reminded += 1;
        } catch (err) {
          // Swallow — one goal's notification hiccup shouldn't stop the
          // batch (same posture as withdrawals/route.ts).
          log.warn('savings-goal-reminders: notification failed', {
            goalId: goal.id,
            requestId: ctx.requestId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      log.info('savings-goal-reminders tick', { checked, reminded, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, checked, reminded },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
