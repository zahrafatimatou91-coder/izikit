// GET /api/insights?range=this_week|this_month|last_month|last_3_months
// Backs /insights — everything Notifications and the Dashboard don't
// already show: period-over-period spend comparison, per-envelope
// breakdown for an arbitrary (not just "current") period, and a
// velocity-based completion-date projection per active savings goal.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { withDbRetry } from '@/lib/server/db-retry';
import {
  resolveInsightsPeriod,
  resolveCustomInsightsPeriod,
  parseDateOnly,
  isInsightsRange,
  type InsightsRange,
  type InsightsPeriod,
} from '@/lib/server/insights/period';
import { projectGoalCompletion } from '@/lib/server/insights/projection';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { getEffectivePlan } from '@/lib/server/subscriptions/tier';

const DEFAULT_RANGE: InsightsRange = 'this_month';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: auth.user.sub },
    });
    if (getEffectivePlan(subscription) === 'FREE') {
      return NextResponse.json(
        {
          error: 'INSIGHTS_REQUIRES_PRO',
          message: 'Les tendances sont réservées à Pro — passe à Pro pour y accéder.',
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // The calendar picker always resolves to concrete dates (presets
    // included) and sends `from`/`to`; `range` is the fallback used only
    // for the initial load before the user has touched the picker, and
    // for any pre-existing bookmarked/shared links.
    const fromParam = req.nextUrl.searchParams.get('from');
    const toParam = req.nextUrl.searchParams.get('to');
    let range: InsightsRange | 'custom';
    let period: InsightsPeriod;
    if (fromParam && toParam) {
      const from = parseDateOnly(fromParam);
      const to = parseDateOnly(toParam);
      const custom = from && to ? resolveCustomInsightsPeriod(from, to) : null;
      if (!custom) {
        return NextResponse.json(
          { error: 'VALIDATION_FAILED', message: 'Plage de dates invalide' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
      range = 'custom';
      period = custom;
    } else {
      const rangeParam = req.nextUrl.searchParams.get('range') ?? DEFAULT_RANGE;
      range = isInsightsRange(rangeParam) ? rangeParam : DEFAULT_RANGE;
      period = resolveInsightsPeriod(range);
    }

    const [user, envelopes, currentTxns, previousTxns, goals] = await withDbRetry(() =>
      Promise.all([
        prisma.user.findUnique({ where: { id: auth.user.sub }, select: { totalBudget: true } }),
        prisma.envelope.findMany({
          where: { userId: auth.user.sub },
          select: { id: true, name: true, icon: true, color: true, monthlyLimit: true },
        }),
        prisma.transaction.findMany({
          where: { userId: auth.user.sub, occurredAt: { gte: period.start, lte: period.end } },
          select: { amount: true, envelopeId: true },
        }),
        prisma.transaction.findMany({
          where: {
            userId: auth.user.sub,
            occurredAt: { gte: period.previousStart, lte: period.previousEnd },
          },
          select: { amount: true },
        }),
        prisma.savingsGoal.findMany({
          where: { userId: auth.user.sub },
          select: {
            id: true,
            name: true,
            icon: true,
            targetAmount: true,
            currentAmount: true,
            entries: { select: { amount: true, createdAt: true } },
          },
        }),
      ]),
    );

    const sumSpent = (txns: { amount: number }[]) =>
      Math.abs(txns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const sumIncome = (txns: { amount: number }[]) =>
      txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    const totalSpent = sumSpent(currentTxns);
    const totalIncome = sumIncome(currentTxns);
    const previousSpent = sumSpent(previousTxns);
    const previousIncome = sumIncome(previousTxns);

    const spentByEnvelope = new Map<string, number>();
    for (const t of currentTxns) {
      if (t.amount >= 0 || !t.envelopeId) continue;
      spentByEnvelope.set(
        t.envelopeId,
        (spentByEnvelope.get(t.envelopeId) ?? 0) + Math.abs(t.amount),
      );
    }

    const byEnvelope = envelopes
      .map((e) => ({
        id: e.id,
        name: e.name,
        icon: e.icon,
        color: e.color,
        spent: spentByEnvelope.get(e.id) ?? 0,
        monthlyLimit: e.monthlyLimit,
        pctOfLimit:
          e.monthlyLimit > 0
            ? Math.round(((spentByEnvelope.get(e.id) ?? 0) / e.monthlyLimit) * 100)
            : 0,
      }))
      .sort((a, b) => b.spent - a.spent);

    // Savings entries within the selected period back "épargné cette
    // période"; the projection itself deliberately looks at ALL entries
    // (a goal's pace is a property of the goal, not of whichever window
    // you're currently browsing in the selector).
    const savedInPeriod = goals.reduce(
      (sum, g) =>
        sum +
        g.entries
          .filter((e) => e.createdAt >= period.start && e.createdAt <= period.end)
          .reduce((s, e) => s + e.amount, 0),
      0,
    );

    const goalProjections = goals.map((g) => {
      const { ratePerDay, projectedDate } = projectGoalCompletion(
        g.entries,
        g.targetAmount,
        g.currentAmount,
      );
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        completed: g.currentAmount >= g.targetAmount,
        ratePerDay: ratePerDay !== null ? Math.round(ratePerDay) : null,
        projectedDate: projectedDate ? projectedDate.toISOString() : null,
      };
    });

    return NextResponse.json(
      {
        range,
        period: {
          label: period.label,
          start: period.start.toISOString(),
          end: period.end.toISOString(),
        },
        totalBudget: user?.totalBudget ?? null,
        totalSpent,
        totalIncome,
        previousSpent,
        previousIncome,
        savedInPeriod,
        byEnvelope,
        goalProjections,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
