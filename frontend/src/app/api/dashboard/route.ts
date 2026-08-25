// GET /api/dashboard — aggregate summary consumed by /dashboard: remaining
// budget for the current period, top envelopes, and recent transactions.
// One route rather than composing 3 client fetches because "spent this
// period" needs the same period-boundary logic as /api/envelopes and is
// wasteful to duplicate client-side.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { currentBudgetPeriod } from '@/lib/server/budget-period';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const TOP_ENVELOPES = 4;
const RECENT_TRANSACTIONS = 4;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // `envelopes` and `recentTransactions` don't depend on the budget
    // period, so they run alongside the user lookup instead of waiting for
    // it — only the two period-scoped spend queries need to wait for
    // `budgetFrequency` to compute `period.start`/`period.end` first.
    const [user, envelopes, recentTransactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.user.sub },
        select: { totalBudget: true, budgetFrequency: true },
      }),
      prisma.envelope.findMany({
        where: { userId: auth.user.sub },
        orderBy: { createdAt: 'asc' },
        take: TOP_ENVELOPES,
      }),
      prisma.transaction.findMany({
        where: { userId: auth.user.sub },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RECENT_TRANSACTIONS,
        include: { envelope: { select: { name: true, icon: true } } },
      }),
    ]);
    const period = currentBudgetPeriod(user?.budgetFrequency);

    const [spentByEnvelope, totalSpentAgg] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['envelopeId'],
        where: {
          userId: auth.user.sub,
          envelopeId: { not: null },
          amount: { lt: 0 },
          occurredAt: { gte: period.start, lte: period.end },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId: auth.user.sub,
          amount: { lt: 0 },
          occurredAt: { gte: period.start, lte: period.end },
        },
        _sum: { amount: true },
      }),
    ]);

    const spentMap = new Map(
      spentByEnvelope.map((row) => [row.envelopeId, Math.abs(row._sum.amount ?? 0)]),
    );

    return NextResponse.json(
      {
        totalBudget: user?.totalBudget ?? null,
        budgetFrequency: user?.budgetFrequency ?? null,
        spent: Math.abs(totalSpentAgg._sum.amount ?? 0),
        daysLeft: period.daysLeft,
        envelopes: envelopes.map((e) => ({
          id: e.id,
          name: e.name,
          icon: e.icon,
          color: e.color,
          monthlyLimit: e.monthlyLimit,
          spent: spentMap.get(e.id) ?? 0,
        })),
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          label: t.label,
          occurredAt: t.occurredAt.toISOString(),
          envelope: t.envelope ? { name: t.envelope.name, icon: t.envelope.icon } : null,
        })),
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
