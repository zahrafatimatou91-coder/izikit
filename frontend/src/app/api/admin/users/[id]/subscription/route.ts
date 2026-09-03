// ADMIN — POST /api/admin/users/[id]/subscription
//
// SUPERADMIN-only manual Pro comp / revoke. One clear place to hand a user
// Pro without a payment (support gesture, beta tester, staff) or to pull it.
//
// Body: { action: "grant" | "revoke", period?: "monthly" | "annual", days?: number }
//   grant  → upsert Subscription to PRO/ACTIVE, currentPeriodEnd extended by
//            `days` (or the period's length) from max(now, existing end),
//            lastOrderId = "comp:<adminId>" — a sentinel so isTrial() stays
//            false (a comp isn't a trial) and reporting can tell comps apart
//            from paid subs. Archived envelopes/goals reactivate.
//   revoke → flip to FREE immediately (currentPeriodEnd = now), archive the
//            surplus beyond Free's limits (non-destructive — see
//            subscriptions/archive.ts).
//
// Audited: action "subscription.grant" / "subscription.revoke".
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { SUBSCRIPTION_PERIOD_DAYS } from '@/lib/server/subscriptions/tier';
import {
  archiveSurplusForFreeDowngrade,
  reactivateArchivedForProUpgrade,
} from '@/lib/server/subscriptions/archive';

const DAY_MS = 24 * 60 * 60 * 1000;

const Body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('grant'),
    period: z.enum(['monthly', 'annual']).optional(),
    days: z.number().int().min(1).max(3650).optional(),
  }),
  z.object({ action: z.literal('revoke') }),
]);

type Discriminator =
  | { kind: 'NOT_FOUND' }
  | { kind: 'OK'; plan: string; currentPeriodEnd: string | null; isComp: boolean };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }
    const body = parsed.data;

    const result: Discriminator = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!user) return { kind: 'NOT_FOUND' as const };

      const existing = await tx.subscription.findUnique({ where: { userId: id } });
      const now = new Date();

      if (body.action === 'grant') {
        const days = body.days ?? SUBSCRIPTION_PERIOD_DAYS[body.period ?? 'monthly'];
        const base =
          existing?.currentPeriodEnd && existing.currentPeriodEnd.getTime() > now.getTime()
            ? existing.currentPeriodEnd
            : now;
        const currentPeriodEnd = new Date(base.getTime() + days * DAY_MS);
        const lastOrderId = `comp:${auth.admin.id}`;

        await tx.subscription.upsert({
          where: { userId: id },
          create: { userId: id, plan: 'PRO', status: 'ACTIVE', currentPeriodEnd, lastOrderId },
          update: { plan: 'PRO', status: 'ACTIVE', currentPeriodEnd, lastOrderId },
        });
        await reactivateArchivedForProUpgrade(tx, id);

        await logAdminAction(tx, {
          actorId: auth.admin.id,
          action: 'subscription.grant',
          targetType: 'User',
          targetId: id,
          metadata: {
            days,
            period: body.period ?? null,
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            previousPlan: existing?.plan ?? 'FREE',
          },
        });

        return {
          kind: 'OK' as const,
          plan: 'PRO',
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          isComp: true,
        };
      }

      // revoke
      await tx.subscription.upsert({
        where: { userId: id },
        create: { userId: id, plan: 'FREE', status: 'CANCELED', currentPeriodEnd: now },
        update: { plan: 'FREE', status: 'CANCELED', currentPeriodEnd: now },
      });
      await archiveSurplusForFreeDowngrade(tx, id);

      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'subscription.revoke',
        targetType: 'User',
        targetId: id,
        metadata: {
          previousPlan: existing?.plan ?? 'FREE',
          previousPeriodEnd: existing?.currentPeriodEnd?.toISOString() ?? null,
        },
      });

      return {
        kind: 'OK' as const,
        plan: 'FREE',
        currentPeriodEnd: now.toISOString(),
        isComp: false,
      };
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    return NextResponse.json(
      {
        subscription: {
          plan: result.plan,
          currentPeriodEnd: result.currentPeriodEnd,
          isComp: result.isComp,
        },
      },
      { status: 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
