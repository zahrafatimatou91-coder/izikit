// ADMIN — GET /api/admin/overview
//
// KPI aggregate for the /admin landing page. ADMIN role (read-only, no PII
// beyond the 5 most-recent signups which the users list already exposes).
// Rate-limited per userId like every admin read.
//
// Everything is computed live:
//   users.byPlan / activeTrials  → effective PRO (plan + currentPeriodEnd),
//                                   never the raw Subscription.plan column
//   signups                      → 6 monthly buckets from User.createdAt
//   revenue.mrrFcfa              → Σ active PAID Pro, annual normalized /12,
//                                   priced from the live AppSetting pricing
//   system                      → env-presence booleans ONLY (never a value)
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { getEffectivePlan, parseSubscriptionOrderMetadata } from '@/lib/server/subscriptions/tier';
import { getSubscriptionPricing } from '@/lib/server/settings';

const MONTH_KEYS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const sixMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTH_KEYS - 1), 1),
    );

    const [totalUsers, newLast30d, effectiveProSubs, signupRows, recentUsersRaw, pricing] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.subscription.findMany({
          where: { plan: 'PRO', status: 'ACTIVE', currentPeriodEnd: { gt: now } },
          select: { userId: true, lastOrderId: true, currentPeriodEnd: true },
        }),
        prisma.user.findMany({
          where: { createdAt: { gte: sixMonthsAgo } },
          select: { createdAt: true },
        }),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            subscription: { select: { plan: true, currentPeriodEnd: true } },
          },
        }),
        getSubscriptionPricing(),
      ]);

    const proCount = effectiveProSubs.length;
    const activeTrials = effectiveProSubs.filter((s) => s.lastOrderId === null).length;
    const paidSubs = effectiveProSubs.filter((s) => s.lastOrderId !== null);

    // Period (monthly vs annual) comes from the paying Order's metadata. A
    // "comp:<adminId>" sentinel lastOrderId won't match any Order and is
    // treated as monthly for MRR purposes.
    const realOrderIds = paidSubs
      .map((s) => s.lastOrderId)
      .filter((id): id is string => typeof id === 'string' && !id.startsWith('comp:'));
    const paidOrders = realOrderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: realOrderIds } },
          select: { id: true, metadata: true },
        })
      : [];
    const periodByOrder = new Map(
      paidOrders.map((o) => [
        o.id,
        parseSubscriptionOrderMetadata(o.metadata)?.period ?? 'monthly',
      ]),
    );

    let mrrFcfa = 0;
    for (const s of paidSubs) {
      const period = s.lastOrderId ? (periodByOrder.get(s.lastOrderId) ?? 'monthly') : 'monthly';
      mrrFcfa += period === 'annual' ? Math.round(pricing.annual / 12) : pricing.monthly;
    }
    const arpuFcfa = paidSubs.length ? Math.round(mrrFcfa / paidSubs.length) : 0;

    // 6 monthly signup buckets, oldest first, zero-filled.
    const buckets = new Map<string, number>();
    for (let i = MONTH_KEYS - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      buckets.set(monthKey(d), 0);
    }
    for (const row of signupRows) {
      const k = monthKey(row.createdAt);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    const signups = [...buckets.entries()].map(([month, count]) => ({ month, count }));

    const recentUsers = recentUsersRaw.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      plan: getEffectivePlan(u.subscription),
    }));

    return NextResponse.json(
      {
        users: {
          total: totalUsers,
          byPlan: { free: Math.max(0, totalUsers - proCount), pro: proCount },
          activeTrials,
          newLast30d,
        },
        signups,
        revenue: { mrrFcfa, paidSubs: paidSubs.length, arpuFcfa },
        system: {
          db: true,
          redis: Boolean(process.env.UPSTASH_REDIS_REST_URL),
          email: Boolean(process.env.RESEND_API_KEY),
          payments: Boolean(process.env.BICTORYS_API_KEY || process.env.MONEROO_API_KEY),
        },
        recentUsers,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
