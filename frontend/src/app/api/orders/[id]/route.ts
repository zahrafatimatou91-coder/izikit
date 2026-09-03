// GET /api/orders/[id] — one order the caller owns. Backs the generic
// post-checkout landing pages (/orders/[id]/success, /orders/[id]/failed)
// and their client-side polling while a webhook confirmation is in flight.
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

    const order = await prisma.order.findFirst({
      where: { id, userId: auth.user.sub },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'ORDER_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const metadata = (order.metadata ?? null) as Record<string, unknown> | null;
    const purpose = metadata && typeof metadata.purpose === 'string' ? metadata.purpose : null;
    const period = metadata && typeof metadata.period === 'string' ? metadata.period : null;

    // The success page needs the renewal date to show "next billing" on a
    // subscription purchase — one extra indexed lookup, only for that
    // purpose, scoped to the caller's own row (same auth boundary as the
    // Order query above).
    let currentPeriodEnd: string | null = null;
    if (purpose === 'subscription') {
      const sub = await prisma.subscription.findUnique({
        where: { userId: auth.user.sub },
        select: { currentPeriodEnd: true },
      });
      currentPeriodEnd = sub?.currentPeriodEnd?.toISOString() ?? null;
    }

    return NextResponse.json(
      {
        id: order.id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        purpose,
        period,
        currentPeriodEnd,
        createdAt: order.createdAt.toISOString(),
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
