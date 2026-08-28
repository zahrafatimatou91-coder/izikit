// GET /api/envelopes — list the user's envelopes with `spent` computed over
// the current budget period (see budget-period.ts). POST creates one.
// Envelopes are fully user-customizable (name/icon/color/limit) — see
// .planning/banani/00-roadmap.md decisions.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { currentBudgetPeriod } from '@/lib/server/budget-period';
import { withDbRetry } from '@/lib/server/db-retry';
import { ENVELOPE_SWATCHES } from '@/lib/envelope-colors';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { normalizeForCompare } from '@/lib/text';

const SWATCH_KEYS = ENVELOPE_SWATCHES.map((s) => s.key) as [string, ...string[]];

const CreateBody = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().min(1).max(50),
  color: z.enum(SWATCH_KEYS),
  monthlyLimit: z.number().int().positive(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // `envelopes` doesn't depend on the budget period, so it runs alongside
    // the user lookup instead of waiting for `budgetFrequency` first.
    const [user, envelopes] = await withDbRetry(() =>
      Promise.all([
        prisma.user.findUnique({
          where: { id: auth.user.sub },
          select: { budgetFrequency: true },
        }),
        prisma.envelope.findMany({
          where: { userId: auth.user.sub },
          orderBy: { createdAt: 'asc' },
        }),
      ]),
    );
    const period = currentBudgetPeriod(user?.budgetFrequency);

    const spentByEnvelope = await withDbRetry(() =>
      prisma.transaction.groupBy({
        by: ['envelopeId'],
        where: {
          userId: auth.user.sub,
          envelopeId: { not: null },
          amount: { lt: 0 },
          occurredAt: { gte: period.start, lte: period.end },
        },
        _sum: { amount: true },
      }),
    );

    const spentMap = new Map(
      spentByEnvelope.map((row) => [row.envelopeId, Math.abs(row._sum.amount ?? 0)]),
    );

    return NextResponse.json(
      {
        envelopes: envelopes.map((e) => ({
          id: e.id,
          name: e.name,
          icon: e.icon,
          color: e.color,
          monthlyLimit: e.monthlyLimit,
          spent: spentMap.get(e.id) ?? 0,
        })),
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    // Reject a name that already exists for this user (case/accent-
    // insensitive) — same rationale as savings-goals: a silent second
    // envelope with the same name is a duplicate, not a new category.
    const existingEnvelopes = await prisma.envelope.findMany({
      where: { userId: auth.user.sub },
      select: { name: true },
    });
    const nameTarget = normalizeForCompare(parsed.data.name);
    if (existingEnvelopes.some((e) => normalizeForCompare(e.name) === nameTarget)) {
      return NextResponse.json(
        {
          error: 'ENVELOPE_NAME_TAKEN',
          message: `Tu as déjà une enveloppe nommée « ${parsed.data.name} ».`,
        },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const envelope = await prisma.envelope.create({
      data: { userId: auth.user.sub, ...parsed.data },
    });

    return NextResponse.json(
      { envelope: { ...envelope, spent: 0 } },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
