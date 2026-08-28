// Shared by both POST /api/transactions and PATCH /api/transactions/[id]
// — creating OR editing a transaction can push an envelope's spend past a
// 50/80/100% threshold, so both call sites need the same check. Lives
// here (not exported from a route.ts) because Next.js route modules are
// only supposed to export HTTP method handlers + config.
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { currentBudgetPeriod } from '@/lib/server/budget-period';
import { createNotification } from '@/lib/server/notifications';
import { envelopeThresholdNotification } from '@/lib/server/notifications/templates';
import { isChannelEnabled, type NotificationPrefs } from '@/lib/server/notifications/prefs-merge';

const ALERT_THRESHOLDS = [0.5, 0.8, 1] as const;

export async function maybeFireEnvelopeThreshold(
  userId: string,
  envelopeId: string,
): Promise<void> {
  const [envelope, prefsRow, user] = await Promise.all([
    prisma.envelope.findUnique({
      where: { id: envelopeId },
      select: { id: true, name: true, monthlyLimit: true },
    }),
    prisma.notificationPreferences.findUnique({ where: { userId }, select: { prefs: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { budgetFrequency: true } }),
  ]);
  if (!envelope || envelope.monthlyLimit <= 0) return;

  const prefs = (prefsRow?.prefs ?? null) as NotificationPrefs | null;
  if (!isChannelEnabled(prefs, 'ENVELOPE_THRESHOLD', 'inApp')) return;

  const period = currentBudgetPeriod(user?.budgetFrequency);
  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      envelopeId,
      amount: { lt: 0 },
      occurredAt: { gte: period.start, lte: period.end },
    },
    _sum: { amount: true },
  });
  const spent = Math.abs(agg._sum.amount ?? 0);
  const ratio = spent / envelope.monthlyLimit;

  // Fire the highest threshold crossed — a single transaction that jumps
  // straight past 100% still only produces one notification, not two.
  for (const threshold of [...ALERT_THRESHOLDS].reverse()) {
    if (ratio >= threshold) {
      const pct = Math.round(threshold * 100);
      try {
        await createNotification(
          prisma,
          envelopeThresholdNotification(
            userId,
            envelope,
            spent,
            envelope.monthlyLimit,
            pct,
            period.start.toISOString(),
            threshold >= 1,
          ),
        );
      } catch {
        // Swallow — the transaction is already committed; a notification
        // hiccup must not poison the response.
      }
      return;
    }
  }
}
