// frontend/src/lib/server/subscriptions/archive.ts
//
// Non-destructive downgrade/upgrade: when a Pro period lapses, the surplus
// beyond Free's limits is archived (never deleted); when the user is Pro
// again, everything reactivates at once. See
// docs/superpowers/specs/2026-08-29-monetization-subscription-design.md
// "Downgrade" for the product rule this implements.
//
// `ArchiveTxClient` is deliberately narrow (Pick, not the full PrismaClient)
// so the SAME functions work both outside a transaction (a plain `prisma`)
// and inside one (a Prisma transaction client) — both shapes carry
// `.envelope` / `.savingsGoal` with identical delegate types.
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { FREE_MAX_ENVELOPES } from './tier';

export type ArchiveTxClient = Pick<PrismaClient, 'envelope' | 'savingsGoal'>;

/**
 * Archives the oldest-created envelopes beyond FREE_MAX_ENVELOPES (the
 * surplus, per the spec's wording — the most recently created ones stay
 * active), and every active savings goal (Free allows 0). Called when a
 * Subscription flips from PRO to FREE.
 */
export async function archiveSurplusForFreeDowngrade(
  client: ArchiveTxClient,
  userId: string,
): Promise<void> {
  const activeEnvelopes = await client.envelope.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (activeEnvelopes.length > FREE_MAX_ENVELOPES) {
    const surplus = activeEnvelopes.slice(0, activeEnvelopes.length - FREE_MAX_ENVELOPES);
    await client.envelope.updateMany({
      where: { id: { in: surplus.map((e) => e.id) } },
      data: { archivedAt: new Date() },
    });
  }

  // FREE_MAX_SAVINGS_GOALS is 0 — every active goal is surplus.
  await client.savingsGoal.updateMany({
    where: { userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
}

/**
 * Reactivates everything archived for this user in one shot. Called when a
 * Subscription flips (back) to PRO via a successful payment.
 */
export async function reactivateArchivedForProUpgrade(
  client: ArchiveTxClient,
  userId: string,
): Promise<void> {
  await client.envelope.updateMany({
    where: { userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  await client.savingsGoal.updateMany({
    where: { userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
}
