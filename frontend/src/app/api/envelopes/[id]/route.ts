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
import { normalizeForCompare } from '@/lib/text';

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

    // Only check when the name is actually changing — renaming "Photocopie"
    // to "photocopie" (itself, different case) must not falsely collide.
    if (parsed.data.name !== undefined) {
      const nameTarget = normalizeForCompare(parsed.data.name);
      const others = await prisma.envelope.findMany({
        where: { userId: auth.user.sub, id: { not: id } },
        select: { name: true },
      });
      if (others.some((e) => normalizeForCompare(e.name) === nameTarget)) {
        return NextResponse.json(
          {
            error: 'ENVELOPE_NAME_TAKEN',
            message: `Tu as déjà une enveloppe nommée « ${parsed.data.name} ».`,
          },
          { status: 409, headers: { 'x-request-id': reqCtx.requestId } },
        );
      }
    }

    // Only check when the limit is actually going UP — lowering it (or
    // leaving it alone) can never newly push the total over budget, and
    // blocking those edits would strand a user who's already over-
    // allocated (e.g. can't even change an unrelated envelope's color)
    // until they fix every envelope at once. The "others" query only runs
    // once we know an increase is actually happening.
    if (parsed.data.monthlyLimit !== undefined) {
      const envelope = await prisma.envelope.findUnique({
        where: { id },
        select: { userId: true, monthlyLimit: true },
      });
      if (!envelope || envelope.userId !== auth.user.sub) {
        return NextResponse.json(
          { error: 'NOT_FOUND' },
          { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
        );
      }
      if (parsed.data.monthlyLimit > envelope.monthlyLimit) {
        const [user, others] = await Promise.all([
          prisma.user.findUnique({ where: { id: auth.user.sub }, select: { totalBudget: true } }),
          prisma.envelope.findMany({
            where: { userId: auth.user.sub, id: { not: id } },
            select: { monthlyLimit: true },
          }),
        ]);
        if (user?.totalBudget != null) {
          const sumOthers = others.reduce((sum, e) => sum + e.monthlyLimit, 0);
          const newTotal = sumOthers + parsed.data.monthlyLimit;
          if (newTotal > user.totalBudget) {
            const remaining = Math.max(0, user.totalBudget - sumOthers);
            return NextResponse.json(
              {
                error: 'ENVELOPE_BUDGET_EXCEEDED',
                message: `Cette limite dépasse ton budget total (${user.totalBudget} FCFA) — il reste ${remaining} FCFA à répartir entre tes enveloppes.`,
              },
              { status: 409, headers: { 'x-request-id': reqCtx.requestId } },
            );
          }
        }
      }
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
