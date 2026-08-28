// GET /api/savings-goals — list the user's goals + weekly aggregate (backs
// /progress: "Objectifs actifs" / "Économisé cette semaine" / "Jours actifs"
// stats and the 7-day breakdown strip).
// POST /api/savings-goals — create a goal (no Banani screen designs this —
// AddEconomy assumes one already exists — same posture as /transactions/new).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { withDbRetry } from '@/lib/server/db-retry';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().min(1).max(40),
  targetAmount: z.number().int().positive(),
  // "Rythme" (pace) is real: paceAmount is how much the user intends to
  // save per period. The savings-goal-reminders cron checks the most
  // recently completed period's entries against it and notifies once if it
  // fell short — see lib/server/savings-goals/pace.ts.
  period: z.enum(['daily', 'weekly', 'monthly']),
  paceAmount: z.number().int().positive(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfIsoWeek(now: Date): Date {
  const day = now.getDay(); // 0=Sun..6=Sat
  const isoWeekday = day === 0 ? 7 : day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoWeekday - 1));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const weekStart = startOfIsoWeek(new Date());
    // Independent queries — `entries` filters by userId through the
    // relation, not by the `goals` result — so they run in parallel.
    const [goals, entries] = await withDbRetry(() =>
      Promise.all([
        prisma.savingsGoal.findMany({
          where: { userId: auth.user.sub },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.savingsEntry.findMany({
          where: {
            savingsGoal: { userId: auth.user.sub },
            createdAt: { gte: weekStart },
          },
          select: { amount: true, createdAt: true },
        }),
      ]),
    );

    const breakdown = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart.getTime() + i * DAY_MS);
      const total = entries
        .filter((e) => {
          const d = e.createdAt;
          return (
            d.getFullYear() === date.getFullYear() &&
            d.getMonth() === date.getMonth() &&
            d.getDate() === date.getDate()
          );
        })
        .reduce((sum, e) => sum + e.amount, 0);
      return { date: date.toISOString(), total };
    });

    return NextResponse.json(
      {
        goals: goals.map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          period: g.period,
          paceAmount: g.paceAmount,
          completed: g.currentAmount >= g.targetAmount,
          createdAt: g.createdAt.toISOString(),
        })),
        summary: {
          activeGoals: goals.length,
          savedThisWeek: entries.reduce((sum, e) => sum + e.amount, 0),
          activeDays: breakdown.filter((b) => b.total > 0).length,
        },
        weeklyBreakdown: breakdown,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: auth.user.sub,
        name: parsed.data.name,
        icon: parsed.data.icon,
        targetAmount: parsed.data.targetAmount,
        period: parsed.data.period,
        paceAmount: parsed.data.paceAmount,
      },
    });

    return NextResponse.json(
      {
        goal: {
          id: goal.id,
          name: goal.name,
          icon: goal.icon,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          period: goal.period,
          paceAmount: goal.paceAmount,
          completed: false,
          createdAt: goal.createdAt.toISOString(),
        },
      },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
