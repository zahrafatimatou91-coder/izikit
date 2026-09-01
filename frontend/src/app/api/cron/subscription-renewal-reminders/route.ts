// POST /api/cron/subscription-renewal-reminders — daily. Emails a user once
// when their PAID Pro subscription is within RENEWAL_BANNER_URGENT_DAYS (7)
// of `currentPeriodEnd`. See lib/server/subscriptions/renewal-reminder.ts
// for the full rationale (Mobile Money has no card-on-file, so renewal is
// always a manual action — the dashboard SubscriptionBanner alone doesn't
// reach a user who isn't in the app).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { sendUpcomingRenewalReminders } from '@/lib/server/subscriptions/renewal-reminder';
import { getEmailQueue } from '@/lib/server/queues/email-queue-singleton';
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
    let checked = 0;
    let reminded = 0;

    await withLease(
      redis ?? undefined,
      'subscription-renewal-reminders',
      LEASE_TTL_MS,
      async () => {
        const result = await sendUpcomingRenewalReminders({
          prisma,
          emailQueue: getEmailQueue(),
        });
        checked = result.checked;
        reminded = result.reminded;
        log.info('subscription-renewal-reminders tick', {
          checked,
          reminded,
          requestId: ctx.requestId,
        });
      },
    );

    return NextResponse.json(
      { ok: true, checked, reminded },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
