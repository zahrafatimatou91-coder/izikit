// ADMIN — GET /api/admin/subscriptions (list Subscription rows joined with
// the user's email, cursor pagination).
//
// Mirrors the users/orders list pattern. ADMIN role (PII: user email).
//
// Filters:
//   ?q          — user email contains (insensitive)
//   ?status     — exact Subscription.status (ACTIVE | PAST_DUE | CANCELED)
//   ?trial=1    — effective PRO with no paying order (lastOrderId null)
//   ?paid=1     — effective PRO with a paying order
//   ?expiring=1 — currentPeriodEnd within the next 7 days
//   ?cursor ?limit
//
// Each row also carries a computed `effectivePlan` / `isTrial` (live, never
// the raw plan column) + `isComp` (admin-granted, lastOrderId "comp:…").
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { clampLimit, cursorWhere, buildPage, decodeCursor } from '@/lib/server/pagination/paginate';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { getEffectivePlan, isTrial } from '@/lib/server/subscriptions/tier';

const SUB_SELECT = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  currentPeriodEnd: true,
  lastOrderId: true,
  createdAt: true,
  user: { select: { email: true, name: true } },
} as const satisfies Prisma.SubscriptionSelect;

const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const q = (url.searchParams.get('q') ?? '').slice(0, 200).trim();
    const status = url.searchParams.get('status');
    const trial = url.searchParams.get('trial') === '1';
    const paid = url.searchParams.get('paid') === '1';
    const expiring = url.searchParams.get('expiring') === '1';
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const now = new Date();
    const where: Prisma.SubscriptionWhereInput = {
      ...(status ? { status } : {}),
      ...(q ? { user: { email: { contains: q, mode: 'insensitive' } } } : {}),
      ...(trial ? { plan: 'PRO', lastOrderId: null, currentPeriodEnd: { gt: now } } : {}),
      ...(paid ? { plan: 'PRO', lastOrderId: { not: null }, currentPeriodEnd: { gt: now } } : {}),
      ...(expiring
        ? { currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + EXPIRING_WINDOW_MS) } }
        : {}),
      ...cursorWhere(cursor),
    };

    const rows = await prisma.subscription.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: SUB_SELECT,
    });

    const page = buildPage(rows, limit);
    const items = page.items.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user?.email ?? null,
      userName: s.user?.name ?? null,
      plan: s.plan,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      lastOrderId: s.lastOrderId,
      createdAt: s.createdAt.toISOString(),
      effectivePlan: getEffectivePlan(s),
      isTrial: isTrial(s),
      isComp: typeof s.lastOrderId === 'string' && s.lastOrderId.startsWith('comp:'),
    }));

    return NextResponse.json(
      { items, nextCursor: page.nextCursor },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
