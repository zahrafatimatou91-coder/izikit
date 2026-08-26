// GET /api/transactions — cursor-paginated history list (see
// lib/server/pagination/paginate.ts). POST creates a manually-entered
// transaction (decision: manual entry, not SMS/bank import — see
// .planning/banani/00-roadmap.md).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { clampLimit, decodeCursor, cursorWhere, buildPage } from '@/lib/server/pagination/paginate';
import { currentBudgetPeriod } from '@/lib/server/budget-period';
import { withDbRetry } from '@/lib/server/db-retry';
import { createNotification } from '@/lib/server/notifications';
import { envelopeThresholdNotification } from '@/lib/server/notifications/templates';
import { isChannelEnabled, type NotificationPrefs } from '@/lib/server/notifications/prefs-merge';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const ALERT_THRESHOLDS = [0.8, 1] as const;

async function maybeFireEnvelopeThreshold(userId: string, envelopeId: string): Promise<void> {
  const [envelope, prefsRow, user] = await Promise.all([
    prisma.envelope.findUnique({
      where: { id: envelopeId },
      select: { id: true, name: true, monthlyLimit: true },
    }),
    prisma.notificationPreferences.findUnique({ where: { userId }, select: { prefs: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { budgetFrequency: true } }),
  ]);
  if (!envelope || envelope.monthlyLimit <= 0) return;

  const prefs = (prefsRow?.prefs ?? null) as NotificationPrefs | null;
  if (!isChannelEnabled(prefs, 'ENVELOPE_THRESHOLD', 'inApp')) return;

  const period = currentBudgetPeriod(user?.budgetFrequency);
  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      envelopeId,
      amount: { lt: 0 },
      occurredAt: { gte: period.start, lte: period.end },
    },
    _sum: { amount: true },
  });
  const spent = Math.abs(agg._sum.amount ?? 0);
  const ratio = spent / envelope.monthlyLimit;

  // Fire the highest threshold crossed — a single transaction that jumps
  // straight past 100% still only produces one notification, not two.
  for (const threshold of [...ALERT_THRESHOLDS].reverse()) {
    if (ratio >= threshold) {
      const pct = Math.round(threshold * 100);
      try {
        await createNotification(
          prisma,
          envelopeThresholdNotification(
            userId,
            envelope,
            spent,
            envelope.monthlyLimit,
            pct,
            period.start.toISOString(),
            threshold >= 1,
          ),
        );
      } catch {
        // Swallow — the transaction is already committed; a notification
        // hiccup must not poison the response.
      }
      return;
    }
  }
}

const CreateBody = z.object({
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, 'amount must not be zero'),
  label: z.string().trim().min(1).max(120),
  envelopeId: z.string().min(1).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.TransactionWhereInput = {
      userId: auth.user.sub,
      ...cursorWhere(cursor),
    };

    const rows = await withDbRetry(() =>
      prisma.transaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        include: { envelope: { select: { name: true, icon: true } } },
      }),
    );

    const page = buildPage(rows, limit);

    return NextResponse.json(
      {
        items: page.items.map((t) => ({
          id: t.id,
          amount: t.amount,
          label: t.label,
          occurredAt: t.occurredAt.toISOString(),
          envelope: t.envelope ? { name: t.envelope.name, icon: t.envelope.icon } : null,
        })),
        nextCursor: page.nextCursor,
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

    if (parsed.data.envelopeId) {
      const owns = await prisma.envelope.findFirst({
        where: { id: parsed.data.envelopeId, userId: auth.user.sub },
        select: { id: true },
      });
      if (!owns) {
        return NextResponse.json(
          { error: 'ENVELOPE_NOT_FOUND' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: auth.user.sub,
        amount: parsed.data.amount,
        label: parsed.data.label,
        envelopeId: parsed.data.envelopeId ?? null,
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      },
    });

    if (parsed.data.envelopeId && parsed.data.amount < 0) {
      await maybeFireEnvelopeThreshold(auth.user.sub, parsed.data.envelopeId);
    }

    return NextResponse.json(
      { transaction: { ...transaction, occurredAt: transaction.occurredAt.toISOString() } },
      { status: 201, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
