// GET /api/tips — list curated tips. Static content (decision: not
// AI-generated — see .planning/banani/00-roadmap.md), but tips whose
// category loosely matches one of the user's real envelope names are
// sorted first — plain case-insensitive substring matching, not
// personalization or generation.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const [tips, envelopes] = await Promise.all([
      prisma.tip.findMany({ orderBy: { title: 'asc' } }),
      prisma.envelope.findMany({
        where: { userId: auth.user.sub },
        select: { name: true },
      }),
    ]);

    const envelopeNames = envelopes.map((e) => e.name.toLowerCase());
    const matches = (category: string) =>
      envelopeNames.some(
        (n) => n.includes(category.toLowerCase()) || category.toLowerCase().includes(n),
      );

    const sorted = [...tips].sort((a, b) => {
      const aMatch = matches(a.category) ? 0 : 1;
      const bMatch = matches(b.category) ? 0 : 1;
      return aMatch - bMatch;
    });

    return NextResponse.json(
      {
        tips: sorted.map((t) => ({
          id: t.id,
          title: t.title,
          icon: t.icon,
          category: t.category,
          estimatedSavingsFcfa: t.estimatedSavingsFcfa,
          excerpt: t.body.split('\n\n')[0],
        })),
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
