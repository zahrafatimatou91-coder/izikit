// GET /api/subscription — the current user's plan status. Backs the
// /subscription page's status banner and every "Fonctionnalité Pro" gate
// elsewhere in the app that needs to know the live plan client-side.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { getEffectivePlan, isTrial } from '@/lib/server/subscriptions/tier';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const sub = await prisma.subscription.findUnique({ where: { userId: auth.user.sub } });
    const plan = getEffectivePlan(sub);

    return NextResponse.json(
      {
        plan,
        status: sub?.status ?? 'ACTIVE',
        currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        isTrial: sub ? isTrial(sub) : false,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
