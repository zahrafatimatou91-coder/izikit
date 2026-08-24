// POST /api/onboarding — persists the "Ton budget" onboarding step
// (frontend/src/app/onboarding/page.tsx). Envelope + savings-goal onboarding
// steps land in later phases (see .planning/banani/00-roadmap.md).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  totalBudget: z.number().int().positive(),
  budgetFrequency: z.enum(['monthly', 'weekly', 'daily']),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    await prisma.user.update({
      where: { id: auth.user.sub },
      data: {
        totalBudget: parsed.data.totalBudget,
        budgetFrequency: parsed.data.budgetFrequency,
      },
    });

    return NextResponse.json(
      { totalBudget: parsed.data.totalBudget, budgetFrequency: parsed.data.budgetFrequency },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
