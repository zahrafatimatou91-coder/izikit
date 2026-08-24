// GET /api/savings-goals/[id] — one goal + its 5 most recent entries. Backs
// the AddEconomy progress card and the EconomyConfirmed recent-entries list.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const goal = await prisma.savingsGoal.findFirst({
      where: { id, userId: auth.user.sub },
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!goal) {
      return NextResponse.json(
        { error: 'SAVINGS_GOAL_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      {
        goal: {
          id: goal.id,
          name: goal.name,
          icon: goal.icon,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          period: goal.period,
          completed: goal.currentAmount >= goal.targetAmount,
        },
        recentEntries: goal.entries.map((e) => ({
          id: e.id,
          amount: e.amount,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
        })),
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
