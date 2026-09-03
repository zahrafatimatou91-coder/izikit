// ADMIN — GET /api/admin/overview
//
// KPI aggregate for the /admin landing page. ADMIN role (read-only, no PII
// beyond the 5 most-recent signups which the users list already exposes).
// Rate-limited per userId like every admin read.
//
// Everything is computed live:
//   users.byPlan / activeTrials  → effective PRO (plan + currentPeriodEnd),
//                                   never the raw Subscription.plan column
//   users.compedPro              → effective PRO granted by an admin (no money)
//   signups                      → 6 monthly buckets from User.createdAt
//   revenue.mrrFcfa              → Σ active PAID Pro (comps excluded — not
//                                   revenue), each priced from the amount the
//                                   paying Order actually captured, annual /12
//   system                      → env-presence booleans ONLY (never a value)
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  getEffectivePlan,
  isTrial,
  parseSubscriptionOrderMetadata,
} from '@/lib/server/subscriptions/tier';
import { getSubscriptionPricing } from '@/lib/server/settings';
import { getRedis } from '@/lib/server/redis';

const MONTH_KEYS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Real reachability, not just env presence: an invalid/expired Upstash
 * token leaves the env vars set but every call failing — rate-limiting then
 * silently degrades to in-memory and leader-leases break. `off` = not
 * configured (fine in dev), `down` = configured but the PING failed. */
async function redisHealth(): Promise<'ok' | 'down' | 'off'> {
  const r = getRedis();
  if (!r) return 'off';
  try {
    await r.ping();
    return 'ok';
  } catch {
    return 'down';
  }
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

    const [totalUsers, newLast30d, effectiveProSubs, signupRows, recentUsersRaw, pricing, redis] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        // Effective-Pro exactly as getEffectivePlan defines it: plan + a
        // future currentPeriodEnd. Deliberately NOT filtered on `status` —
        // the shared helper ignores it, and gating that off `status` here
        // would make this KPI drift from the users / subscriptions lists the
        // day a "cancel at period end" flow (status CANCELED, plan still PRO)
        // is added.
        prisma.subscription.findMany({
          where: { plan: 'PRO', currentPeriodEnd: { gt: now } },
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
            subscription: {
              select: { plan: true, currentPeriodEnd: true, lastOrderId: true },
            },
          },
        }),
        getSubscriptionPricing(),
        redisHealth(),
      ]);

    const isComp = (id: string | null): boolean => typeof id === 'string' && id.startsWith('comp:');

    const proCount = effectiveProSubs.length;
    const activeTrials = effectiveProSubs.filter((s) => s.lastOrderId === null).length;
    const compedPro = effectiveProSubs.filter((s) => isComp(s.lastOrderId)).length;
    // "Paid" = effective Pro with a real paying Order. Trials (lastOrderId
    // null) and admin comps ("comp:<adminId>") are NOT revenue and must not
    // land in MRR / ARPU / the paid count.
    const paidSubs = effectiveProSubs.filter(
      (s) => s.lastOrderId !== null && !isComp(s.lastOrderId),
    );

    // Price each paid sub from what its Order actually captured — not the
    // current AppSetting price, which may have been changed by an admin after
    // these subs were bought. Fall back to the live monthly price only if the
    // Order row can't be found (deleted / legacy).
    const realOrderIds = paidSubs.map((s) => s.lastOrderId as string);
    const paidOrders = realOrderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: realOrderIds } },
          select: { id: true, amount: true, metadata: true },
        })
      : [];
    const orderById = new Map(
      paidOrders.map((o) => [
        o.id,
        {
          amount: o.amount,
          period: parseSubscriptionOrderMetadata(o.metadata)?.period ?? 'monthly',
        },
      ]),
    );

    let mrrFcfa = 0;
    for (const s of paidSubs) {
      const o = orderById.get(s.lastOrderId as string);
      if (!o) {
        mrrFcfa += pricing.monthly;
        continue;
      }
      mrrFcfa += o.period === 'annual' ? Math.round(o.amount / 12) : o.amount;
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
      isTrial: u.subscription ? isTrial(u.subscription) : false,
      isComp: isComp(u.subscription?.lastOrderId ?? null),
    }));

    return NextResponse.json(
      {
        users: {
          total: totalUsers,
          byPlan: { free: Math.max(0, totalUsers - proCount), pro: proCount },
          activeTrials,
          compedPro,
          newLast30d,
        },
        signups,
        revenue: { mrrFcfa, paidSubs: paidSubs.length, arpuFcfa },
        system: {
          db: true, // proven — this response just ran several DB queries
          redis, // live PING: 'ok' | 'down' | 'off'
          email: Boolean(process.env.RESEND_API_KEY),
          payments: Boolean(process.env.BICTORYS_API_KEY || process.env.MONEROO_API_KEY),
        },
        recentUsers,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
