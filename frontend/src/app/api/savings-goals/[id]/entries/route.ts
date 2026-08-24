// POST /api/savings-goals/[id]/entries — "Ajouter une économie". Creates a
// SavingsEntry and atomically bumps the goal's denormalized currentAmount in
// one transaction so the running total never drifts from the entry ledger.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const CreateBody = z.object({
  amount: z.number().int().positive(),
  note: z.string().trim().max(200).optional(),
});

export async function POST(
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

    const body = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const owns = await prisma.savingsGoal.findFirst({
      where: { id, userId: auth.user.sub },
      select: { id: true },
    });
    if (!owns) {
      return NextResponse.json(
        { error: 'SAVINGS_GOAL_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const [entry, goal] = await prisma.$transaction([
      prisma.savingsEntry.create({
        data: {
          savingsGoalId: id,
          amount: parsed.data.amount,
          note: parsed.data.note ?? null,
        },
      }),
      prisma.savingsGoal.update({
        where: { id },
        data: { currentAmount: { increment: parsed.data.amount } },
      }),
    ]);

    return NextResponse.json(
      {
        entry: {
          id: entry.id,
          amount: entry.amount,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        },
        goal: {
          id: goal.id,
          name: goal.name,
          icon: goal.icon,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          period: goal.period,
          completed: goal.currentAmount >= goal.targetAmount,
        },
      },
      { status: 201, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
