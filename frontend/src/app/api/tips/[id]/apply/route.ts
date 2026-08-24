// POST /api/tips/[id]/apply — "Appliquer ce conseil". Idempotent: if the
// user already applied this tip (a SavingsGoal with this tipId exists),
// returns it instead of creating a duplicate. Otherwise creates a
// SavingsGoal seeded from the tip (name/icon from the tip, targetAmount
// from its estimatedSavingsFcfa or a sensible default, period=monthly).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { createNotification } from '@/lib/server/notifications';
import { tipAppliedNotification } from '@/lib/server/notifications/templates';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const DEFAULT_TARGET_FCFA = 2000;

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

    const tip = await prisma.tip.findUnique({ where: { id } });
    if (!tip) {
      return NextResponse.json(
        { error: 'TIP_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const existing = await prisma.savingsGoal.findFirst({
      where: { userId: auth.user.sub, tipId: tip.id },
    });

    const goal =
      existing ??
      (await prisma.savingsGoal.create({
        data: {
          userId: auth.user.sub,
          name: tip.title,
          icon: tip.icon,
          targetAmount: tip.estimatedSavingsFcfa ?? DEFAULT_TARGET_FCFA,
          period: 'monthly',
          tipId: tip.id,
        },
      }));

    if (existing === null) {
      try {
        await createNotification(prisma, tipAppliedNotification(auth.user.sub, goal));
      } catch {
        // Swallow — the goal is already committed; a notification hiccup
        // must not poison the response (same posture as withdrawals/route.ts).
      }
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
        alreadyApplied: existing !== null,
      },
      { status: existing ? 200 : 201, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
