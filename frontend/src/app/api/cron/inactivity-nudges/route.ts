// POST /api/cron/inactivity-nudges — fires twice daily (vercel.json
// schedules this same route at 13:00 and 20:00 UTC; resolveInactivitySlot
// maps whichever hour actually fired to 'midday' | 'evening' so the two
// invocations get distinct copy and distinct dedupeKeys). For every
// onboarded user (totalBudget set) who has logged neither a Transaction
// nor a SavingsEntry since midnight (UTC, server-clock — matches the
// convention already used by budget-period.ts), fires one
// INACTIVITY_NUDGE notification. createNotification's dedupeKey makes
// this safe to fire at most once per user per slot per day even if the
// cron re-runs.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/server/cron/auth';
import { withLease } from '@/lib/server/leader-lease';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createLogger } from '@/lib/server/logger';
import { createNotification } from '@/lib/server/notifications';
import { inactivityNudgeNotification } from '@/lib/server/notifications/templates';
import { isChannelEnabled, type NotificationPrefs } from '@/lib/server/notifications/prefs-merge';
import { resolveInactivitySlot } from '@/lib/server/cron/inactivity-slot';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const log = createLogger();
const LEASE_TTL_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const fail = verifyCronSecret(req);
  if (fail) return fail;

  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    let checked = 0;
    let nudged = 0;

    await withLease(redis ?? undefined, 'inactivity-nudges', LEASE_TTL_MS, async () => {
      const now = new Date();
      const slot = resolveInactivitySlot(now);
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const dateIso = todayStart.toISOString().slice(0, 10);

      const [users, activeTxnUsers, activeEntries, prefsRows] = await Promise.all([
        prisma.user.findMany({
          where: { totalBudget: { not: null } },
          select: { id: true },
        }),
        prisma.transaction.findMany({
          where: { createdAt: { gte: todayStart } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.savingsEntry.findMany({
          where: { createdAt: { gte: todayStart } },
          select: { savingsGoal: { select: { userId: true } } },
        }),
        prisma.notificationPreferences.findMany({ select: { userId: true, prefs: true } }),
      ]);
      checked = users.length;

      const activeUserIds = new Set<string>([
        ...activeTxnUsers.map((t) => t.userId),
        ...activeEntries.map((e) => e.savingsGoal.userId),
      ]);
      const prefsByUser = new Map(
        prefsRows.map((row) => [row.userId, row.prefs as NotificationPrefs | null]),
      );

      for (const user of users) {
        if (activeUserIds.has(user.id)) continue;
        if (!isChannelEnabled(prefsByUser.get(user.id), 'INACTIVITY_NUDGE', 'inApp')) continue;

        try {
          const created = await createNotification(
            prisma,
            inactivityNudgeNotification(user.id, slot, dateIso),
          );
          if (created) nudged += 1;
        } catch (err) {
          // Swallow — one user's notification hiccup shouldn't stop the
          // batch (same posture as savings-goal-reminders/route.ts).
          log.warn('inactivity-nudges: notification failed', {
            userId: user.id,
            requestId: ctx.requestId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      log.info('inactivity-nudges tick', { slot, checked, nudged, requestId: ctx.requestId });
    });

    return NextResponse.json(
      { ok: true, checked, nudged },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
