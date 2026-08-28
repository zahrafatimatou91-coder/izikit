// GET/PATCH/DELETE /api/transactions/[id] — scoped to the requesting
// user; a mismatched id (not found or not owned) returns 404 either way.
// Mirrors the envelopes/[id] route's shape.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { maybeFireEnvelopeThreshold } from '@/lib/server/transactions/envelope-threshold';

const PatchBody = z.object({
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, 'amount must not be zero'),
  label: z.string().trim().min(1).max(120),
  envelopeId: z.string().min(1).nullable(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: auth.user.sub },
      include: { envelope: { select: { id: true, name: true, icon: true } } },
    });
    if (!transaction) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      {
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          label: transaction.label,
          occurredAt: transaction.occurredAt.toISOString(),
          envelope: transaction.envelope
            ? {
                id: transaction.envelope.id,
                name: transaction.envelope.name,
                icon: transaction.envelope.icon,
              }
            : null,
        },
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}

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

    if (parsed.data.envelopeId) {
      const owns = await prisma.envelope.findFirst({
        where: { id: parsed.data.envelopeId, userId: auth.user.sub },
        select: { id: true },
      });
      if (!owns) {
        return NextResponse.json(
          { error: 'ENVELOPE_NOT_FOUND' },
          { status: 400, headers: { 'x-request-id': reqCtx.requestId } },
        );
      }
    }

    const result = await prisma.transaction.updateMany({
      where: { id, userId: auth.user.sub },
      data: {
        amount: parsed.data.amount,
        label: parsed.data.label,
        envelopeId: parsed.data.envelopeId,
      },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    // Same side effect as creating one — editing the amount or the
    // envelope a spend is filed under can cross a 50/80/100% threshold
    // exactly like a brand-new transaction would.
    if (parsed.data.envelopeId && parsed.data.amount < 0) {
      await maybeFireEnvelopeThreshold(auth.user.sub, parsed.data.envelopeId);
    }

    const transaction = await prisma.transaction.findUnique({ where: { id } });
    return NextResponse.json(
      {
        transaction: transaction && {
          ...transaction,
          occurredAt: transaction.occurredAt.toISOString(),
        },
      },
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
    const result = await prisma.transaction.deleteMany({ where: { id, userId: auth.user.sub } });
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
