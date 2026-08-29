// POST /api/cron/subscription-expiration — daily. Flips lapsed PRO
// subscriptions (trial or paid) back to FREE and archives their surplus,
// then sends upcoming-expiry reminders (-2j trial, -3j paid renewal). See
// docs/superpowers/specs/2026-08-29-monetization-subscription-design.md.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import {
  expireLapsedSubscriptions,
  sendUpcomingSubscriptionReminders,
} from '@/lib/server/subscriptions/expire';
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
    let trialReminded = 0;
    let renewalReminded = 0;

    await withLease(redis ?? undefined, 'subscription-expiration', LEASE_TTL_MS, async () => {
      const expireResult = await expireLapsedSubscriptions({ prisma });
      expired = expireResult.expired;
      const reminderResult = await sendUpcomingSubscriptionReminders({ prisma });
      trialReminded = reminderResult.trialReminded;
      renewalReminded = reminderResult.renewalReminded;
      log.info('subscription-expiration tick', {
        expired,
        trialReminded,
        renewalReminded,
        requestId: ctx.requestId,
      });
    });

    return NextResponse.json(
      { ok: true, expired, trialReminded, renewalReminded },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
