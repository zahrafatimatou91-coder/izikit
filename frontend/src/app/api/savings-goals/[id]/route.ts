// GET /api/savings-goals/[id] — one goal + its 5 most recent entries. Backs
// the AddEconomy progress card and the EconomyConfirmed recent-entries list.
// DELETE /api/savings-goals/[id] — removes a goal the user no longer wants
// to track. Its SavingsEntry rows cascade-delete with it (see schema).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
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
          paceAmount: goal.paceAmount,
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const result = await prisma.savingsGoal.deleteMany({ where: { id, userId: auth.user.sub } });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
