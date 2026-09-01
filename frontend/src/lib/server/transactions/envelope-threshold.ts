// Shared by both POST /api/transactions and PATCH /api/transactions/[id]
// — creating OR editing a transaction can push an envelope's spend over
// its limit, so both call sites need the same check. Lives here (not
// exported from a route.ts) because Next.js route modules are only
// supposed to export HTTP method handlers + config.
//
// Only the 100% (over-limit) alert fires. The old 50% / 80% pings were
// removed as noise — the dashboard already shows a live "≥85%, careful"
// warning, so the bell is reserved for "you actually went over".
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { currentBudgetPeriod } from '@/lib/server/budget-period';
import { createNotification } from '@/lib/server/notifications';
import { envelopeThresholdNotification } from '@/lib/server/notifications/templates';
import { isChannelEnabled, type NotificationPrefs } from '@/lib/server/notifications/prefs-merge';

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
  if (spent < envelope.monthlyLimit) return; // still within budget — nothing to flag

  try {
    await createNotification(
      prisma,
      envelopeThresholdNotification(
        userId,
        envelope,
        spent,
        envelope.monthlyLimit,
        period.start.toISOString(),
      ),
    );
  } catch {
    // Swallow — the transaction is already committed; a notification
    // hiccup must not poison the response.
  }
}
