// PATCH/DELETE /api/envelopes/[id] — scoped to the requesting user; a
// mismatched id (not found or not owned) returns 404 either way.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { ENVELOPE_SWATCHES } from '@/lib/envelope-colors';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const SWATCH_KEYS = ENVELOPE_SWATCHES.map((s) => s.key) as [string, ...string[]];

const PatchBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().min(1).max(50).optional(),
  color: z.enum(SWATCH_KEYS).optional(),
  monthlyLimit: z.number().int().positive().optional(),
});

export async function PATCH(
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
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    // Built via conditional spreads, not `parsed.data` directly — Zod's
    // `.optional()` fields are typed as `T | undefined` explicitly present,
    // which `exactOptionalPropertyTypes` rejects against Prisma's update input.
    const data = {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.icon !== undefined && { icon: parsed.data.icon }),
      ...(parsed.data.color !== undefined && { color: parsed.data.color }),
      ...(parsed.data.monthlyLimit !== undefined && { monthlyLimit: parsed.data.monthlyLimit }),
    };

    const result = await prisma.envelope.updateMany({
      where: { id, userId: auth.user.sub },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const envelope = await prisma.envelope.findUnique({ where: { id } });
    return NextResponse.json(
      { envelope },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
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
    const result = await prisma.envelope.deleteMany({ where: { id, userId: auth.user.sub } });
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
