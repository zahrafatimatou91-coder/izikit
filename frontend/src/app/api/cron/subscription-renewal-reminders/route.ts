// POST /api/cron/subscription-renewal-reminders — daily. Two email
// reminders, same underlying gap (Mobile Money has no card-on-file / no
// push, so the dashboard SubscriptionBanner alone never reaches a user who
// isn't in the app before their period lapses):
//   1. PAID Pro subscriptions within RENEWAL_BANNER_URGENT_DAYS (7) of
//      `currentPeriodEnd` — see lib/server/subscriptions/renewal-reminder.ts.
//   2. Pro TRIALS (never paid) within TRIAL_BANNER_URGENT_DAYS (3) of
//      `currentPeriodEnd` — see lib/server/subscriptions/trial-reminder.ts.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { sendUpcomingRenewalReminders } from '@/lib/server/subscriptions/renewal-reminder';
import { sendTrialEndingReminders } from '@/lib/server/subscriptions/trial-reminder';
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
    let renewalChecked = 0;
    let renewalReminded = 0;
    let trialChecked = 0;
    let trialReminded = 0;

    await withLease(
      redis ?? undefined,
      'subscription-renewal-reminders',
      LEASE_TTL_MS,
      async () => {
        const emailQueue = getEmailQueue();
        const [renewalResult, trialResult] = await Promise.all([
          sendUpcomingRenewalReminders({ prisma, emailQueue }),
          sendTrialEndingReminders({ prisma, emailQueue }),
        ]);
        renewalChecked = renewalResult.checked;
        renewalReminded = renewalResult.reminded;
        trialChecked = trialResult.checked;
        trialReminded = trialResult.reminded;
        log.info('subscription-renewal-reminders tick', {
          renewalChecked,
          renewalReminded,
          trialChecked,
          trialReminded,
          requestId: ctx.requestId,
        });
      },
    );

    return NextResponse.json(
      {
        ok: true,
        checked: renewalChecked + trialChecked,
        reminded: renewalReminded + trialReminded,
        renewal: { checked: renewalChecked, reminded: renewalReminded },
        trial: { checked: trialChecked, reminded: trialReminded },
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
