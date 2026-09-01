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
import { ALL_COUNTRIES } from '@/lib/countries';

const VALID_COUNTRY_CODES = new Set(ALL_COUNTRIES.map((c) => c.code));

const Body = z.object({
  totalBudget: z.number().int().positive(),
  budgetFrequency: z.enum(['monthly', 'weekly', 'daily']),
  // Optional — the "Settings → modifier le budget" re-entry flow re-submits
  // this same endpoint without asking for country again. Only the first,
  // real onboarding screen collects it. Validated against the app's known
  // country list (see lib/countries.ts) rather than a bare ISO-2 regex, so
  // a typo can't silently route a checkout to the wrong provider.
  country: z
    .string()
    .refine((v) => VALID_COUNTRY_CODES.has(v.toUpperCase()), 'Unknown country code')
    .transform((v) => v.toUpperCase())
    .optional(),
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
        ...(parsed.data.country ? { country: parsed.data.country } : {}),
      },
    });

    return NextResponse.json(
      {
        totalBudget: parsed.data.totalBudget,
        budgetFrequency: parsed.data.budgetFrequency,
        country: parsed.data.country ?? null,
      },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
