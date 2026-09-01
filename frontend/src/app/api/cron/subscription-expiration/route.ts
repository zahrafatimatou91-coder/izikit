// POST /api/cron/subscription-expiration — daily. Flips lapsed PRO
// subscriptions (trial or paid) back to FREE and archives their surplus.
// The pre-lapse "ends soon" IN-APP reminders it used to also send were
// dropped — the dashboard SubscriptionBanner covers that state for anyone
// who opens the app. See
// docs/superpowers/specs/2026-08-29-monetization-subscription-design.md.
// A separate EMAIL channel for paid (non-trial) subscriptions was added
// later — see the subscription-renewal-reminders cron + Subscriptions
// domain rationale in lib/server/subscriptions/renewal-reminder.ts — since
// Mobile Money has no card-on-file and a user who never opens the app
// before lapsing gets no signal at all otherwise.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { expireLapsedSubscriptions } from '@/lib/server/subscriptions/expire';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();
const LEASE_TTL_MS = 60_000; // ~2 × maxDuration

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let expired = 0;

    await withLease(redis ?? undefined, 'subscription-expiration', LEASE_TTL_MS, async () => {
      const expireResult = await expireLapsedSubscriptions({ prisma });
      expired = expireResult.expired;
      log.info('subscription-expiration tick', {
        expired,
        requestId: ctx.requestId,
      });
    });

    return NextResponse.json({ ok: true, expired }, { headers: { 'x-request-id': ctx.requestId } });
  });
}
