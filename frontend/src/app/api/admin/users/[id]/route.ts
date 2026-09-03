// ADMIN-01 — GET /api/admin/users/[id] (detail).
//
// Sequence: makeRequestContext → withRequestContext → requireAdmin('ADMIN')
// → enforceAdminRateLimit → prisma.user.findUnique with the same PII-safe
// USER_SELECT shape as the list endpoint, plus the subscription state, a
// few resource counts, and the 5 most recent orders (the admin detail
// screen shows all of this on one page). 404 on miss with stable code
// USER_NOT_FOUND.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { getEffectivePlan, isTrial } from '@/lib/server/subscriptions/tier';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  country: true,
  totalBudget: true,
  budgetFrequency: true,
  subscription: {
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
      lastOrderId: true,
      createdAt: true,
    },
  },
  _count: {
    select: { envelopes: true, savingsGoals: true, transactions: true, orders: true },
  },
  orders: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      provider: true,
      paymentMethod: true,
      paidAt: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.UserSelect;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const row = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!row) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const { subscription, _count, orders, ...identity } = row;
    const user = {
      ...identity,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd
              ? subscription.currentPeriodEnd.toISOString()
              : null,
            createdAt: subscription.createdAt.toISOString(),
            effectivePlan: getEffectivePlan(subscription),
            isTrial: isTrial(subscription),
            isComp:
              typeof subscription.lastOrderId === 'string' &&
              subscription.lastOrderId.startsWith('comp:'),
          }
        : null,
      counts: {
        envelopes: _count?.envelopes ?? 0,
        savingsGoals: _count?.savingsGoals ?? 0,
        transactions: _count?.transactions ?? 0,
        orders: _count?.orders ?? 0,
      },
      recentOrders: (orders ?? []).map((o) => ({
        ...o,
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
        createdAt: o.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ user }, { headers: { 'x-request-id': reqCtx.requestId } });
  });
}
