// GET /api/tips/[id] — one tip's full detail.
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

    const tip = await prisma.tip.findUnique({ where: { id } });
    if (!tip) {
      return NextResponse.json(
        { error: 'TIP_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      {
        tip: {
          id: tip.id,
          title: tip.title,
          icon: tip.icon,
          category: tip.category,
          estimatedSavingsFcfa: tip.estimatedSavingsFcfa,
          steps: tip.body.split('\n\n'),
        },
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
