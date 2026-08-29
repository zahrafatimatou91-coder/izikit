# Abonnement — Essai gratuit, paiement et cycle de vie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire vivre le modèle `Subscription` déjà en base : essai Pro de 7 jours à l'inscription, activation Pro via le paiement générique existant (`POST /api/orders`), extension du webhook Bictorys pour créditer la période payée, archivage/réactivation automatique des enveloppes et objectifs au downgrade/upgrade, rappels avant échéance, et les deux pages de retour de paiement (`/orders/[id]/success`, `/orders/[id]/failed`) qu'`POST /api/orders` référence déjà mais qui n'existent pas encore.

**Architecture:** Aucune nouvelle route de paiement — `POST /api/orders` (déjà générique, déjà avec circuit breaker + idempotence) est réutilisée telle quelle pour un achat d'abonnement via `metadata: { purpose: 'subscription', period: 'monthly' | 'annual' }`. Le seul point d'intégration côté paiement est `onPaid` dans le webhook Bictorys existant (fichier projet, pas protégé), qui lit ce `metadata` et met à jour `Subscription` dans la même transaction Serializable déjà ouverte par la factory protégée. Un nouveau module `subscriptions/archive.ts` centralise l'archivage (downgrade) et la réactivation (upgrade) des enveloppes/objectifs, appelé à la fois par le webhook et par un nouveau cron quotidien `subscription-expiration` qui fait aussi vivre les rappels avant échéance. Aucune migration Prisma : tous les champs nécessaires (`Subscription.plan/status/currentPeriodEnd/lastOrderId`, `Envelope.archivedAt`, `SavingsGoal.archivedAt`) existent déjà.

**Tech Stack:** Next.js 16 Route Handlers (`runtime = 'nodejs'`), Prisma 5, Vitest + `prismaMock`, Vercel Cron.

**Spec:** [docs/superpowers/specs/2026-08-29-monetization-subscription-design.md](../specs/2026-08-29-monetization-subscription-design.md) — Chantier 1 (Downgrade, modèle "pass") et Chantier 2 (Essai Pro gratuit, Implications techniques).

## Global Constraints

- Chaque Route Handler modifié ou créé garde/ajoute `export const runtime = 'nodejs'`.
- Aucune migration Prisma dans ce plan — tous les champs existent déjà (Plan 1 : `archivedAt` ; modèle `Subscription` : présent depuis le schéma initial).
- `frontend/src/lib/server/webhook/handler.ts` reste protégé — non modifié. Seul le fichier projet `frontend/src/app/api/webhooks/bictorys/route.ts` (déjà écrit pour être étendu par projet) est touché.
- `frontend/src/lib/server/outbox/dispatcher.ts` (protégé) **n'est pas touché par ce plan** — les notifications d'abonnement (rappel essai, rappel renouvellement, expiration) sont émises directement via `createNotification(prisma, ...)` depuis le cron, exactement comme le fait déjà `savings-goal-reminders` (aucun événement outbox n'est nécessaire pour du contenu généré depuis un cron ; l'outbox sert aux effets émis depuis une transaction webhook déjà ouverte).
- Renouvellement = modèle "pass" manuel (jamais de prélèvement automatique) : payer une période prolonge `currentPeriodEnd` à partir de `max(now, currentPeriodEnd actuel)`, jamais depuis `now` seul si l'abonnement est encore actif — payer en avance ne doit jamais faire perdre de jours.
- Downgrade jamais destructif : le surplus (enveloppes les plus anciennes par `createdAt`, tous les objectifs d'épargne) passe en `archivedAt: <now>`, jamais supprimé. Upgrade réactive tout (`archivedAt: null`) d'un coup.
- `dedupeKey` de toute notification doit être déterministe (jamais de timestamp d'exécution ou de suffixe aléatoire) — voir `notifications/templates.ts` en tête de fichier.
- Ne jamais qualifier les Conseils personnalisés d'« IA » (contrainte de copy globale au projet — sans objet direct dans ce plan mais rappelée car elle s'applique à tout nouveau texte utilisateur).
- Un seul essai par compte, accordé uniquement à la création du compte (`POST /api/auth/signup`), jamais redéclenché ailleurs.

---

## File Structure

- `frontend/src/lib/server/subscriptions/tier.ts` **(modifié)** — ajoute les constantes de durée (essai, périodes payées, fenêtres de rappel) et un parseur de métadonnées de commande d'abonnement. Reste le seul fichier source de vérité pour tout ce qui touche aux paliers.
- `frontend/src/lib/server/subscriptions/archive.ts` **(nouveau)** — `archiveSurplusForFreeDowngrade` / `reactivateArchivedForProUpgrade`, utilisées par le webhook (upgrade) et le cron (downgrade).
- `frontend/src/lib/server/subscriptions/expire.ts` **(nouveau)** — `expireLapsedSubscriptions` / `sendUpcomingSubscriptionReminders`, le cœur du cron `subscription-expiration`, sur le modèle de `orders/expire.ts`.
- `frontend/src/lib/server/notifications/templates.ts` **(modifié)** — 3 nouveaux templates : rappel fin d'essai, rappel de renouvellement, confirmation d'expiration.
- `frontend/src/app/api/auth/signup/route.ts` **(modifié)** — crée la `Subscription` d'essai dans la même transaction que le `User`.
- `frontend/src/app/api/webhooks/bictorys/route.ts` **(modifié)** — `onPaid` active/prolonge Pro et réactive l'archivage quand `order.metadata.purpose === 'subscription'`.
- `frontend/src/app/api/cron/subscription-expiration/route.ts` **(nouveau)** — cron quotidien, mirroir de `order-expiration/route.ts`.
- `frontend/vercel.json` **(modifié)** — enregistre le nouveau cron.
- `frontend/src/app/api/orders/[id]/route.ts` **(nouveau)** — `GET`, ownership-checked, backe les deux pages ci-dessous.
- `frontend/src/app/orders/[id]/success/page.tsx` **(nouveau)**
- `frontend/src/app/orders/[id]/failed/page.tsx` **(nouveau)**

---

### Task 1: Constantes d'abonnement + essai Pro de 7 jours à l'inscription

**Files:**
- Modify: `frontend/src/lib/server/subscriptions/tier.ts`
- Modify: `frontend/src/app/api/auth/signup/route.ts:121-142`
- Test: `frontend/src/lib/server/subscriptions/tier.test.ts`
- Test: `frontend/src/app/api/auth/signup/route.test.ts`

**Interfaces:**
- Produces: `SUBSCRIPTION_TRIAL_DAYS: number`, `SUBSCRIPTION_PERIOD_DAYS: Record<'monthly' | 'annual', number>`, `SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS: number`, `SUBSCRIPTION_RENEWAL_REMINDER_DAYS: number`, `parseSubscriptionOrderMetadata(metadata: unknown): { purpose: 'subscription'; period: 'monthly' | 'annual' } | null` — tous exportés de `tier.ts`, consommés par les Tasks 3 et 5.

- [ ] **Step 1: Write the failing tests for the new tier.ts exports**

Add to `frontend/src/lib/server/subscriptions/tier.test.ts`:

```ts
describe('SUBSCRIPTION_TRIAL_DAYS / SUBSCRIPTION_PERIOD_DAYS', () => {
  it('trial is 7 days', () => {
    expect(SUBSCRIPTION_TRIAL_DAYS).toBe(7);
  });

  it('monthly is 30 days, annual is 365 days', () => {
    expect(SUBSCRIPTION_PERIOD_DAYS.monthly).toBe(30);
    expect(SUBSCRIPTION_PERIOD_DAYS.annual).toBe(365);
  });
});

describe('parseSubscriptionOrderMetadata', () => {
  it('returns null for null/non-object metadata', () => {
    expect(parseSubscriptionOrderMetadata(null)).toBeNull();
    expect(parseSubscriptionOrderMetadata('subscription')).toBeNull();
  });

  it('returns null when purpose is not "subscription"', () => {
    expect(parseSubscriptionOrderMetadata({ purpose: 'donation', period: 'monthly' })).toBeNull();
  });

  it('returns null when period is missing or invalid', () => {
    expect(parseSubscriptionOrderMetadata({ purpose: 'subscription' })).toBeNull();
    expect(
      parseSubscriptionOrderMetadata({ purpose: 'subscription', period: 'weekly' }),
    ).toBeNull();
  });

  it('parses a valid subscription metadata object', () => {
    expect(parseSubscriptionOrderMetadata({ purpose: 'subscription', period: 'annual' })).toEqual({
      purpose: 'subscription',
      period: 'annual',
    });
  });
});
```

Add the new imports to the top of that test file:

```ts
import {
  getEffectivePlan,
  isTrial,
  getHistoryFloor,
  FREE_MAX_ENVELOPES,
  FREE_MAX_SAVINGS_GOALS,
  SUBSCRIPTION_TRIAL_DAYS,
  SUBSCRIPTION_PERIOD_DAYS,
  parseSubscriptionOrderMetadata,
} from './tier';
```

(Keep whatever subset of these the existing file already imports — add only the new names.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/tier.test.ts`
Expected: FAIL — `SUBSCRIPTION_TRIAL_DAYS` etc. are not exported yet.

- [ ] **Step 3: Implement the new tier.ts exports**

Append to `frontend/src/lib/server/subscriptions/tier.ts` (after the existing `getHistoryFloor` function):

```ts
/** Trial length granted once at signup — see isTrial() above and the
 * signup route. */
export const SUBSCRIPTION_TRIAL_DAYS = 7;

/** Paid period lengths in days, keyed by the `period` value a subscription
 * checkout is created with (`POST /api/orders` body's
 * `metadata: { purpose: 'subscription', period }`). 13 500 FCFA/an buys 365
 * days flat — no leap-year adjustment, matches the "3 mois offerts" pricing
 * framing in the spec rather than a precise 9×30-day count. */
export const SUBSCRIPTION_PERIOD_DAYS: Record<'monthly' | 'annual', number> = {
  monthly: 30,
  annual: 365,
};

/** Reminder windows before `currentPeriodEnd`, in days — consumed by the
 * subscription-expiration cron. A trial (never billed) and a paid renewal
 * get distinct copy and distinct windows (spec: -2j essai, -3j payant). */
export const SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS = 2;
export const SUBSCRIPTION_RENEWAL_REMINDER_DAYS = 3;

export interface SubscriptionOrderMetadata {
  purpose: 'subscription';
  period: 'monthly' | 'annual';
}

/**
 * Reads `Order.metadata` (an opaque `Prisma.JsonValue`) and returns a typed
 * subscription-purchase descriptor, or `null` if this order isn't a
 * subscription purchase (any other Order shape — e.g. a future non-
 * subscription use of the same generic checkout — is left untouched by the
 * webhook's subscription-activation branch).
 */
export function parseSubscriptionOrderMetadata(metadata: unknown): SubscriptionOrderMetadata | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const m = metadata as Record<string, unknown>;
  if (m.purpose !== 'subscription') return null;
  if (m.period !== 'monthly' && m.period !== 'annual') return null;
  return { purpose: 'subscription', period: m.period };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/tier.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the trial subscription at signup**

Add to `frontend/src/app/api/auth/signup/route.test.ts`, inside the `describe('POST /api/auth/signup', ...)` block, right after the `'creates a new user, code, and outbox event for genuinely new emails'` test:

```ts
  it('seeds a 7-day Pro trial subscription for a new user (no order yet)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'u-trial' } as never);
    prismaMock.verificationCode.create.mockResolvedValue({} as never);

    const before = Date.now();
    await POST(makeReq({ email: 'trial@example.com', password: 'a-strong-passphrase' }));
    const after = Date.now();

    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1);
    const subArg = prismaMock.subscription.create.mock.calls[0]?.[0];
    expect(subArg?.data?.userId).toBe('u-trial');
    expect(subArg?.data?.plan).toBe('PRO');
    expect(subArg?.data?.status).toBe('ACTIVE');
    expect(subArg?.data?.lastOrderId).toBeNull();
    const periodEnd = (subArg?.data?.currentPeriodEnd as Date).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(periodEnd).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(periodEnd).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter frontend exec vitest run src/app/api/auth/signup/route.test.ts -t "seeds a 7-day"`
Expected: FAIL — `prismaMock.subscription.create` was never called.

- [ ] **Step 7: Seed the trial subscription inside the signup transaction**

In `frontend/src/app/api/auth/signup/route.ts`, add the import:

```ts
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/server/subscriptions/tier';
```

Then change the transaction body (currently lines 121-142) from:

```ts
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash },
        select: { id: true },
      });
      await tx.verificationCode.create({
```

to:

```ts
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash },
        select: { id: true },
      });
      // Reverse-trial: every new account starts Pro for 7 days, no card/
      // payment required. `lastOrderId: null` marks it as a trial (see
      // isTrial() in subscriptions/tier.ts) until a real payment lands.
      // Granted exactly once, here — never redriggered by any other flow.
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000),
          lastOrderId: null,
        },
      });
      await tx.verificationCode.create({
```

(Leave everything from `await tx.verificationCode.create({` onward, including the closing of the transaction, untouched.)

Log the trial-lifecycle event (spec: `trial_started`) right inside the transaction, immediately after the `tx.subscription.create` call added above — `user.id` is only in scope there, not after the transaction closes:

```ts
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_TRIAL_DAYS * 24 * 60 * 60 * 1000),
          lastOrderId: null,
        },
      });
      log.info('subscription trial_started', { userId: user.id });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/auth/signup/route.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones — the new `tx.subscription.create` call doesn't affect any existing assertion).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/server/subscriptions/tier.ts frontend/src/lib/server/subscriptions/tier.test.ts frontend/src/app/api/auth/signup/route.ts frontend/src/app/api/auth/signup/route.test.ts
git commit -m "feat(subscriptions): seed a 7-day Pro trial at signup"
```

---

### Task 2: Archivage au downgrade / réactivation à l'upgrade

**Files:**
- Create: `frontend/src/lib/server/subscriptions/archive.ts`
- Test: `frontend/src/lib/server/subscriptions/archive.test.ts`

**Interfaces:**
- Consumes: `FREE_MAX_ENVELOPES` from `frontend/src/lib/server/subscriptions/tier.ts` (Plan 1).
- Produces: `archiveSurplusForFreeDowngrade(client: ArchiveTxClient, userId: string): Promise<void>`, `reactivateArchivedForProUpgrade(client: ArchiveTxClient, userId: string): Promise<void>`, `type ArchiveTxClient` — consumed by Task 3 (webhook, upgrade path) and Task 5 (cron, downgrade path). `ArchiveTxClient` must be structurally satisfied by both a plain `PrismaClient` and any Prisma transaction client (`Prisma.TransactionClient` or the webhook factory's `PrismaTransactionClient`) — achieved by declaring it as a `Pick<PrismaClient, 'envelope' | 'savingsGoal'>`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/server/subscriptions/archive.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { archiveSurplusForFreeDowngrade, reactivateArchivedForProUpgrade } from './archive';

const findMany = vi.fn();
const updateMany = vi.fn();
const goalUpdateMany = vi.fn();

const client = {
  envelope: { findMany, updateMany },
  savingsGoal: { updateMany: goalUpdateMany },
} as unknown as Parameters<typeof archiveSurplusForFreeDowngrade>[0];

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  goalUpdateMany.mockReset();
});

describe('archiveSurplusForFreeDowngrade', () => {
  it('archives the oldest envelopes beyond the Free limit (2), keeps the 2 newest active', async () => {
    findMany.mockResolvedValue([
      { id: 'e-oldest' },
      { id: 'e-middle' },
      { id: 'e-newer' },
      { id: 'e-newest' },
    ]); // pre-sorted ascending by createdAt, as the real query does
    goalUpdateMany.mockResolvedValue({ count: 0 });

    await archiveSurplusForFreeDowngrade(client, 'u1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e-oldest', 'e-middle'] } },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('does nothing to envelopes when already at or under the Free limit', async () => {
    findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    goalUpdateMany.mockResolvedValue({ count: 0 });

    await archiveSurplusForFreeDowngrade(client, 'u1');

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('archives every active savings goal (Free allows 0)', async () => {
    findMany.mockResolvedValue([]);
    goalUpdateMany.mockResolvedValue({ count: 3 });

    await archiveSurplusForFreeDowngrade(client, 'u1');

    expect(goalUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
  });
});

describe('reactivateArchivedForProUpgrade', () => {
  it('reactivates every archived envelope and savings goal for the user', async () => {
    updateMany.mockResolvedValue({ count: 2 });
    goalUpdateMany.mockResolvedValue({ count: 1 });

    await reactivateArchivedForProUpgrade(client, 'u1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    expect(goalUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/archive.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement archive.ts**

Create `frontend/src/lib/server/subscriptions/archive.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/archive.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/server/subscriptions/archive.ts frontend/src/lib/server/subscriptions/archive.test.ts
git commit -m "feat(subscriptions): archive-on-downgrade / reactivate-on-upgrade helper"
```

---

### Task 3: Le webhook active/prolonge Pro sur un paiement d'abonnement

**Files:**
- Modify: `frontend/src/app/api/webhooks/bictorys/route.ts`
- Test: `frontend/src/app/api/webhooks/bictorys/route.test.ts`

**Interfaces:**
- Consumes: `parseSubscriptionOrderMetadata`, `SUBSCRIPTION_PERIOD_DAYS` (Task 1); `reactivateArchivedForProUpgrade` (Task 2).
- Produces: nothing new consumed by later tasks — this is the payment→Subscription integration point.

- [ ] **Step 1: Write the failing test**

In `frontend/src/app/api/webhooks/bictorys/route.test.ts`, extend the shared `$transaction` mock at the top of the file. Change:

```ts
const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const orderFindFirst = vi.fn();
const orderUpdate = vi.fn();
const outboxCreate = vi.fn();

const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) =>
  fn({
    webhookLog: { findUnique, create, update },
    order: { findFirst: orderFindFirst, update: orderUpdate },
    outboxEvent: { create: outboxCreate },
  }),
);
```

to:

```ts
const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const orderFindFirst = vi.fn();
const orderUpdate = vi.fn();
const outboxCreate = vi.fn();
const subscriptionFindUnique = vi.fn();
const subscriptionUpsert = vi.fn();
const envelopeUpdateMany = vi.fn();
const savingsGoalUpdateMany = vi.fn();

const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) =>
  fn({
    webhookLog: { findUnique, create, update },
    order: { findFirst: orderFindFirst, update: orderUpdate },
    outboxEvent: { create: outboxCreate },
    subscription: { findUnique: subscriptionFindUnique, upsert: subscriptionUpsert },
    envelope: { updateMany: envelopeUpdateMany },
    savingsGoal: { updateMany: savingsGoalUpdateMany },
  }),
);
```

And extend the `beforeEach` reset block. Change:

```ts
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  orderFindFirst.mockReset();
  orderUpdate.mockReset();
  outboxCreate.mockReset();
```

to:

```ts
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  orderFindFirst.mockReset();
  orderUpdate.mockReset();
  outboxCreate.mockReset();
  subscriptionFindUnique.mockReset();
  subscriptionUpsert.mockReset();
  envelopeUpdateMany.mockReset();
  savingsGoalUpdateMany.mockReset();
```

Then add a new test, right after the existing `'onPaid enqueues outbox event when order is found (WH-02 — outbox-not-closures)'` test:

```ts
  it('onPaid activates Pro and extends currentPeriodEnd when order.metadata.purpose is "subscription"', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1500,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'monthly' },
    });
    outboxCreate.mockResolvedValue({ id: 'ob1' });
    subscriptionFindUnique.mockResolvedValueOnce(null); // no existing subscription row
    subscriptionUpsert.mockResolvedValue({});
    envelopeUpdateMany.mockResolvedValue({ count: 0 });
    savingsGoalUpdateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = subscriptionUpsert.mock.calls[0]?.[0];
    expect(upsertArg.where).toEqual({ userId: 'u1' });
    expect(upsertArg.update.plan).toBe('PRO');
    expect(upsertArg.update.status).toBe('ACTIVE');
    expect(upsertArg.update.lastOrderId).toBe('o1');
    // ~30 days out (monthly), give or take a second for test execution time.
    const periodEnd = (upsertArg.update.currentPeriodEnd as Date).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(periodEnd).toBeGreaterThan(Date.now() + thirtyDaysMs - 5000);
    expect(periodEnd).toBeLessThan(Date.now() + thirtyDaysMs + 5000);

    expect(envelopeUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });

  it('onPaid extends from the existing currentPeriodEnd, not from now, when still Pro', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o2',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1500,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'monthly' },
    });
    outboxCreate.mockResolvedValue({ id: 'ob2' });
    const futurePeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    subscriptionFindUnique.mockResolvedValueOnce({
      userId: 'u1',
      plan: 'PRO',
      currentPeriodEnd: futurePeriodEnd,
      lastOrderId: 'o-old',
    });
    subscriptionUpsert.mockResolvedValue({});
    envelopeUpdateMany.mockResolvedValue({ count: 0 });
    savingsGoalUpdateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    const upsertArg = subscriptionUpsert.mock.calls[0]?.[0];
    const expected = futurePeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000;
    expect((upsertArg.update.currentPeriodEnd as Date).getTime()).toBe(expected);
  });

  it('onPaid does not touch Subscription for a non-subscription order', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o3',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
      metadata: null,
    });
    outboxCreate.mockResolvedValue({ id: 'ob3' });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    expect(subscriptionUpsert).not.toHaveBeenCalled();
    expect(envelopeUpdateMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/app/api/webhooks/bictorys/route.test.ts -t "subscription"`
Expected: FAIL — `subscriptionUpsert` is never called yet.

- [ ] **Step 3: Implement the onPaid subscription-activation branch**

In `frontend/src/app/api/webhooks/bictorys/route.ts`, add the imports:

```ts
import {
  parseSubscriptionOrderMetadata,
  SUBSCRIPTION_PERIOD_DAYS,
} from '@/lib/server/subscriptions/tier';
import { reactivateArchivedForProUpgrade } from '@/lib/server/subscriptions/archive';
```

Then, inside `onPaid`, insert a new block right after the `tx.order.update({...})` call and before the `// Outbox emits stay inside...` comment. The surrounding code changes from:

```ts
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(paymentMethod !== null ? { paymentMethod } : {}),
      },
    });

    // Outbox emits stay inside the factory's Serializable tx so the rows
```

to:

```ts
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(paymentMethod !== null ? { paymentMethod } : {}),
      },
    });

    // Subscription purchase — activate/extend Pro and reactivate any
    // envelopes/savings-goals archived by a prior Free downgrade. Runs
    // inside the same Serializable tx as the Order status flip so a crash
    // between the two is impossible (both commit together or neither does).
    const subMeta = parseSubscriptionOrderMetadata(order.metadata);
    if (subMeta && order.userId) {
      const existingSub = await tx.subscription.findUnique({ where: { userId: order.userId } });
      const now = new Date();
      const base =
        existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd.getTime() > now.getTime()
          ? existingSub.currentPeriodEnd
          : now;
      const periodMs = SUBSCRIPTION_PERIOD_DAYS[subMeta.period] * 24 * 60 * 60 * 1000;
      const currentPeriodEnd = new Date(base.getTime() + periodMs);

      await tx.subscription.upsert({
        where: { userId: order.userId },
        create: {
          userId: order.userId,
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodEnd,
          lastOrderId: order.id,
        },
        update: {
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodEnd,
          lastOrderId: order.id,
        },
      });

      await reactivateArchivedForProUpgrade(tx, order.userId);
    }

    // Outbox emits stay inside the factory's Serializable tx so the rows
```

(The rest of `onPaid` — the two `enqueueOutbox` calls and the `return {};` — stays exactly as-is; the generic "payment received" notification/email still fire for a subscription purchase too, same as any other order.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/webhooks/bictorys/route.test.ts`
Expected: PASS (all tests in the file — the new tx methods added to the shared mock are additive and don't affect the pre-existing tests, which never reference `tx.subscription`/`tx.envelope`/`tx.savingsGoal`).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: no errors. (`tx` inside `onPaid` is typed `PrismaTransactionClient` from the protected factory — it structurally satisfies `ArchiveTxClient` because that type only requires `.envelope`/`.savingsGoal`, both present with identical delegate types.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/api/webhooks/bictorys/route.ts frontend/src/app/api/webhooks/bictorys/route.test.ts
git commit -m "feat(subscriptions): activate/extend Pro from a paid subscription order"
```

---

### Task 4: Nouveaux templates de notification (rappels + expiration)

**Files:**
- Modify: `frontend/src/lib/server/notifications/templates.ts`
- Test: `frontend/src/lib/server/notifications/templates.test.ts` (create if it doesn't exist; if it exists, extend it — check first).

**Interfaces:**
- Produces: `subscriptionTrialEndingNotification(userId, { currentPeriodEnd, envelopeCount, goalCount }): CreateNotificationInput`, `subscriptionRenewalReminderNotification(userId, { currentPeriodEnd }): CreateNotificationInput`, `subscriptionExpiredNotification(userId, { wasTrial, currentPeriodEnd }): CreateNotificationInput` — consumed by Task 5.

- [ ] **Step 1: Check whether a test file already exists**

Run: `ls frontend/src/lib/server/notifications/templates.test.ts`

If it exists, read it first and add the new `describe` blocks below into it, following its existing import/style conventions. If it doesn't exist, create it fresh with the content in Step 1 below (imports only what's needed).

- [ ] **Step 2: Write the failing tests**

Add (or create the file with) these tests:

```ts
import { describe, it, expect } from 'vitest';
import {
  subscriptionTrialEndingNotification,
  subscriptionRenewalReminderNotification,
  subscriptionExpiredNotification,
} from './templates';

describe('subscriptionTrialEndingNotification', () => {
  it('mentions the real envelope and goal counts', () => {
    const end = new Date('2026-09-05T00:00:00.000Z');
    const n = subscriptionTrialEndingNotification('u1', {
      currentPeriodEnd: end,
      envelopeCount: 4,
      goalCount: 2,
    });
    expect(n.type).toBe('SUBSCRIPTION_TRIAL_ENDING');
    expect(n.body).toContain('4 enveloppes');
    expect(n.body).toContain("2 objectifs d'épargne");
    expect(n.dedupeKey).toBe(`subscription-trial-ending:u1:${end.toISOString()}`);
  });

  it('omits a count clause when both counts are 0', () => {
    const end = new Date('2026-09-05T00:00:00.000Z');
    const n = subscriptionTrialEndingNotification('u1', {
      currentPeriodEnd: end,
      envelopeCount: 0,
      goalCount: 0,
    });
    expect(n.body).not.toContain('actifs :');
  });
});

describe('subscriptionRenewalReminderNotification', () => {
  it('has a deterministic dedupeKey scoped to the period end', () => {
    const end = new Date('2026-10-01T00:00:00.000Z');
    const n = subscriptionRenewalReminderNotification('u1', { currentPeriodEnd: end });
    expect(n.type).toBe('SUBSCRIPTION_RENEWAL_REMINDER');
    expect(n.dedupeKey).toBe(`subscription-renewal-reminder:u1:${end.toISOString()}`);
  });
});

describe('subscriptionExpiredNotification', () => {
  it('uses trial-specific copy when wasTrial is true', () => {
    const end = new Date('2026-09-07T00:00:00.000Z');
    const n = subscriptionExpiredNotification('u1', { wasTrial: true, currentPeriodEnd: end });
    expect(n.title).toContain('essai');
    expect(n.body).not.toContain('garder tes données');
  });

  it('uses paid-lapse copy when wasTrial is false', () => {
    const end = new Date('2026-09-07T00:00:00.000Z');
    const n = subscriptionExpiredNotification('u1', { wasTrial: false, currentPeriodEnd: end });
    expect(n.title).toContain('abonnement');
  });

  it('dedupeKey is scoped to the period that lapsed, not to execution time', () => {
    const end = new Date('2026-09-07T00:00:00.000Z');
    const n = subscriptionExpiredNotification('u1', { wasTrial: true, currentPeriodEnd: end });
    expect(n.dedupeKey).toBe(`subscription-expired:u1:${end.toISOString()}`);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/server/notifications/templates.test.ts`
Expected: FAIL — the three functions aren't exported yet.

- [ ] **Step 4: Implement the three templates**

Append to `frontend/src/lib/server/notifications/templates.ts` (after the existing `inactivityNudgeNotification` function, at the end of the file):

```ts
/** Fired from the subscription-expiration cron when a TRIAL Pro period
 * (`lastOrderId === null`) is within `SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS`
 * of lapsing. Uses the account's real envelope/goal counts rather than
 * generic copy — a concrete, personalized loss converts better than a vague
 * one, and stays honest: nothing is actually deleted (see
 * subscriptionExpiredNotification), so this says "rester actif", never
 * "garder tes données". `currentPeriodEnd` scopes the dedupeKey so the same
 * trial period is reminded at most once even if the cron catches the
 * window on more than one of its daily runs. */
export function subscriptionTrialEndingNotification(
  userId: string,
  info: { currentPeriodEnd: Date; envelopeCount: number; goalCount: number },
): CreateNotificationInput {
  const dateLabel = info.currentPeriodEnd.toLocaleDateString('fr-FR');
  const pieces: string[] = [];
  if (info.envelopeCount > 0) {
    pieces.push(`${info.envelopeCount} enveloppe${info.envelopeCount > 1 ? 's' : ''}`);
  }
  if (info.goalCount > 0) {
    pieces.push(`${info.goalCount} objectif${info.goalCount > 1 ? 's' : ''} d'épargne`);
  }
  const countsLine = pieces.length > 0 ? ` Tu as ${pieces.join(' et ')} actifs :` : '';
  return {
    userId,
    type: 'SUBSCRIPTION_TRIAL_ENDING',
    title: 'Ton essai Pro se termine bientôt',
    body: `Ton essai Pro se termine le ${dateLabel}.${countsLine} passe à Pro pour qu'ils restent actifs.`,
    data: { currentPeriodEnd: info.currentPeriodEnd.toISOString() },
    dedupeKey: `subscription-trial-ending:${userId}:${info.currentPeriodEnd.toISOString()}`,
  };
}

/** Fired from the subscription-expiration cron for a PAID subscription
 * (`lastOrderId !== null`) within `SUBSCRIPTION_RENEWAL_REMINDER_DAYS` of
 * its manual "pass" expiring — there is no auto-recurring billing, so this
 * is the only nudge to renew before losing Pro. `currentPeriodEnd` scopes
 * the dedupeKey (see subscriptionTrialEndingNotification above). */
export function subscriptionRenewalReminderNotification(
  userId: string,
  info: { currentPeriodEnd: Date },
): CreateNotificationInput {
  const dateLabel = info.currentPeriodEnd.toLocaleDateString('fr-FR');
  return {
    userId,
    type: 'SUBSCRIPTION_RENEWAL_REMINDER',
    title: 'Ton abonnement Pro arrive à échéance',
    body: `Ton abonnement Pro se termine le ${dateLabel}. Renouvelle pour rester Pro sans interruption.`,
    data: { currentPeriodEnd: info.currentPeriodEnd.toISOString() },
    dedupeKey: `subscription-renewal-reminder:${userId}:${info.currentPeriodEnd.toISOString()}`,
  };
}

/** Fired from the subscription-expiration cron right after a Pro period
 * (trial or paid) lapses without renewal and the account is flipped back to
 * Free. Nothing was deleted — the surplus enveloppes/objectifs were
 * archived, not removed (see subscriptions/archive.ts) — so the copy never
 * implies a data loss. Same mechanism/template for a non-converted trial
 * and a non-renewed paid subscription, only the wording differs
 * (`wasTrial`). `currentPeriodEnd` scopes the dedupeKey to the period that
 * just lapsed, so a later resubscribe-then-lapse-again cycle gets its own
 * notification. */
export function subscriptionExpiredNotification(
  userId: string,
  info: { wasTrial: boolean; currentPeriodEnd: Date },
): CreateNotificationInput {
  return {
    userId,
    type: 'SUBSCRIPTION_EXPIRED',
    title: info.wasTrial ? 'Ton essai Pro est terminé' : 'Ton abonnement Pro a expiré',
    body: info.wasTrial
      ? "Tu es repassé sur le plan Free. Rien n'est perdu : passe à Pro quand tu veux pour tout réactiver."
      : "Tu es repassé sur le plan Free faute de renouvellement. Rien n'est perdu : repasse à Pro quand tu veux pour tout réactiver.",
    data: { wasTrial: info.wasTrial },
    dedupeKey: `subscription-expired:${userId}:${info.currentPeriodEnd.toISOString()}`,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/server/notifications/templates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/server/notifications/templates.ts frontend/src/lib/server/notifications/templates.test.ts
git commit -m "feat(notifications): add subscription trial/renewal/expiration templates"
```

---

### Task 5: Cron `subscription-expiration` — bascule vers Free + rappels

**Files:**
- Create: `frontend/src/lib/server/subscriptions/expire.ts`
- Create: `frontend/src/app/api/cron/subscription-expiration/route.ts`
- Modify: `frontend/vercel.json`
- Test: `frontend/src/lib/server/subscriptions/expire.test.ts`
- Test: `frontend/src/app/api/cron/subscription-expiration/route.test.ts`

**Interfaces:**
- Consumes: `archiveSurplusForFreeDowngrade` (Task 2); `subscriptionTrialEndingNotification`, `subscriptionRenewalReminderNotification`, `subscriptionExpiredNotification` (Task 4); `SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS`, `SUBSCRIPTION_RENEWAL_REMINDER_DAYS` (Task 1); `createNotification` from `@/lib/server/notifications`.
- Produces: `expireLapsedSubscriptions(opts: { prisma: PrismaClient; batchSize?: number; now?: Date }): Promise<{ expired: number }>`, `sendUpcomingSubscriptionReminders(opts: { prisma: PrismaClient; now?: Date }): Promise<{ trialReminded: number; renewalReminded: number }>`.

- [ ] **Step 1: Write the failing tests for expire.ts**

Create `frontend/src/lib/server/subscriptions/expire.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { expireLapsedSubscriptions, sendUpcomingSubscriptionReminders } from './expire';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('expireLapsedSubscriptions', () => {
  it('flips a lapsed PRO subscription to FREE and archives surplus', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub1',
        userId: 'u1',
        lastOrderId: null,
        currentPeriodEnd: new Date('2026-08-30T00:00:00.000Z'),
      },
    ] as never);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.envelope.findMany.mockResolvedValue([]);
    prismaMock.savingsGoal.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await expireLapsedSubscriptions({ prisma: prismaMock, now });

    expect(result.expired).toBe(1);
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'sub1', plan: 'PRO' },
      data: { plan: 'FREE' },
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.type).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('skips the notification when the row was renewed concurrently (updateMany count 0)', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub1',
        userId: 'u1',
        lastOrderId: 'o1',
        currentPeriodEnd: new Date('2026-08-30T00:00:00.000Z'),
      },
    ] as never);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 0 }); // raced with a renewal

    const result = await expireLapsedSubscriptions({ prisma: prismaMock, now });

    expect(result.expired).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('returns 0 when there is nothing to expire', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    const result = await expireLapsedSubscriptions({ prisma: prismaMock });
    expect(result.expired).toBe(0);
  });
});

describe('sendUpcomingSubscriptionReminders', () => {
  it('sends the trial-ending reminder with real envelope/goal counts within 2 days of a trial ending', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        userId: 'u1',
        lastOrderId: null,
        currentPeriodEnd: new Date('2026-09-02T12:00:00.000Z'), // ~1.5 days out
      },
    ] as never);
    prismaMock.envelope.count.mockResolvedValue(3);
    prismaMock.savingsGoal.count.mockResolvedValue(1);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await sendUpcomingSubscriptionReminders({ prisma: prismaMock, now });

    expect(result.trialReminded).toBe(1);
    expect(result.renewalReminded).toBe(0);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.type).toBe('SUBSCRIPTION_TRIAL_ENDING');
  });

  it('sends the renewal reminder within 3 days of a PAID subscription ending', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        userId: 'u2',
        lastOrderId: 'o1',
        currentPeriodEnd: new Date('2026-09-03T00:00:00.000Z'), // 2 days out
      },
    ] as never);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await sendUpcomingSubscriptionReminders({ prisma: prismaMock, now });

    expect(result.renewalReminded).toBe(1);
    expect(result.trialReminded).toBe(0);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.type).toBe('SUBSCRIPTION_RENEWAL_REMINDER');
  });

  it('does not remind a subscription outside the reminder window', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      { userId: 'u3', lastOrderId: 'o1', currentPeriodEnd: new Date('2026-09-20T00:00:00.000Z') },
    ] as never);

    const result = await sendUpcomingSubscriptionReminders({ prisma: prismaMock, now });

    expect(result.trialReminded).toBe(0);
    expect(result.renewalReminded).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/expire.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement expire.ts**

Create `frontend/src/lib/server/subscriptions/expire.ts`:

```ts
// frontend/src/lib/server/subscriptions/expire.ts
//
// Two responsibilities for the daily subscription-expiration cron:
//   1. expireLapsedSubscriptions — flip PRO subscriptions whose
//      currentPeriodEnd has passed back to FREE, archiving any surplus
//      envelopes/savings-goals (subscriptions/archive.ts). Covers both a
//      paid subscription that wasn't renewed and a trial that wasn't
//      converted — same mechanism, per the spec ("Fin d'essai non converti").
//   2. sendUpcomingSubscriptionReminders — notify users whose PRO
//      subscription is about to lapse: -2 days for a trial
//      (lastOrderId === null), -3 days for a paid subscription.
//
// Notifications are created directly via createNotification(prisma, ...),
// never via the outbox — this cron isn't running inside a webhook's
// Serializable transaction, so there's no protected dispatcher.ts to touch
// (same posture as the existing savings-goal-reminders cron).
import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '../notifications';
import {
  subscriptionTrialEndingNotification,
  subscriptionRenewalReminderNotification,
  subscriptionExpiredNotification,
} from '../notifications/templates';
import {
  SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS,
  SUBSCRIPTION_RENEWAL_REMINDER_DAYS,
} from './tier';
import { archiveSurplusForFreeDowngrade } from './archive';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExpireLapsedSubscriptionsOptions {
  prisma: PrismaClient;
  batchSize?: number; // default 100
  now?: Date;
}

export async function expireLapsedSubscriptions(
  opts: ExpireLapsedSubscriptionsOptions,
): Promise<{ expired: number }> {
  const batchSize = opts.batchSize ?? 100;
  const now = opts.now ?? new Date();

  const candidates = await opts.prisma.subscription.findMany({
    where: { plan: 'PRO', currentPeriodEnd: { lt: now } },
    orderBy: { currentPeriodEnd: 'asc' },
    take: batchSize,
    select: { id: true, userId: true, lastOrderId: true, currentPeriodEnd: true },
  });

  if (candidates.length === 0) return { expired: 0 };

  let expired = 0;
  for (const sub of candidates) {
    if (!sub.currentPeriodEnd) continue; // can't happen given the WHERE above; keeps TS happy
    const wasTrial = sub.lastOrderId === null;

    // plan='PRO' WHERE-guard prevents racing with a webhook that just
    // renewed this subscription (mirrors orders/expire.ts's WR-01 pattern).
    // The notification is issued OUTSIDE this transaction, using the plain
    // `prisma` client — createNotification's signature takes a full
    // PrismaClient, not a transaction client, and there's no correctness
    // requirement that the flip and the notification commit atomically.
    const flipped = await opts.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.updateMany({
        where: { id: sub.id, plan: 'PRO' },
        data: { plan: 'FREE' },
      });
      if (updated.count === 0) return false;
      await archiveSurplusForFreeDowngrade(tx, sub.userId);
      return true;
    });
    if (!flipped) continue;
    expired++;

    try {
      await createNotification(
        opts.prisma,
        subscriptionExpiredNotification(sub.userId, {
          wasTrial,
          currentPeriodEnd: sub.currentPeriodEnd,
        }),
      );
    } catch {
      // Swallow — one user's notification hiccup shouldn't stop the batch
      // (same posture as savings-goal-reminders / withdrawals routes).
    }
  }
  return { expired };
}

export interface SendUpcomingSubscriptionRemindersOptions {
  prisma: PrismaClient;
  now?: Date;
}

export async function sendUpcomingSubscriptionReminders(
  opts: SendUpcomingSubscriptionRemindersOptions,
): Promise<{ trialReminded: number; renewalReminded: number }> {
  const now = opts.now ?? new Date();
  const maxWindowDays = Math.max(
    SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS,
    SUBSCRIPTION_RENEWAL_REMINDER_DAYS,
  );
  const horizon = new Date(now.getTime() + maxWindowDays * DAY_MS);

  const upcoming = await opts.prisma.subscription.findMany({
    where: { plan: 'PRO', currentPeriodEnd: { gt: now, lte: horizon } },
    select: { userId: true, lastOrderId: true, currentPeriodEnd: true },
  });

  let trialReminded = 0;
  let renewalReminded = 0;

  for (const sub of upcoming) {
    if (!sub.currentPeriodEnd) continue;
    const daysLeft = (sub.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS;
    const isTrialSub = sub.lastOrderId === null;

    try {
      if (isTrialSub) {
        if (daysLeft > SUBSCRIPTION_TRIAL_ENDING_REMINDER_DAYS) continue;
        const [envelopeCount, goalCount] = await Promise.all([
          opts.prisma.envelope.count({ where: { userId: sub.userId, archivedAt: null } }),
          opts.prisma.savingsGoal.count({ where: { userId: sub.userId, archivedAt: null } }),
        ]);
        const created = await createNotification(
          opts.prisma,
          subscriptionTrialEndingNotification(sub.userId, {
            currentPeriodEnd: sub.currentPeriodEnd,
            envelopeCount,
            goalCount,
          }),
        );
        if (created) trialReminded++;
      } else {
        if (daysLeft > SUBSCRIPTION_RENEWAL_REMINDER_DAYS) continue;
        const created = await createNotification(
          opts.prisma,
          subscriptionRenewalReminderNotification(sub.userId, {
            currentPeriodEnd: sub.currentPeriodEnd,
          }),
        );
        if (created) renewalReminded++;
      }
    } catch {
      // Swallow — same posture as expireLapsedSubscriptions above.
    }
  }

  return { trialReminded, renewalReminded };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/expire.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the cron route**

Create `frontend/src/app/api/cron/subscription-expiration/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/subscriptions/expire', () => ({
  expireLapsedSubscriptions: vi.fn().mockResolvedValue({ expired: 2 }),
  sendUpcomingSubscriptionReminders: vi
    .fn()
    .mockResolvedValue({ trialReminded: 1, renewalReminded: 3 }),
}));

import { POST } from './route';
import {
  expireLapsedSubscriptions,
  sendUpcomingSubscriptionReminders,
} from '@/lib/server/subscriptions/expire';

function makeReq(authHeader?: string): NextRequest {
  return new NextRequest('http://test/api/cron/subscription-expiration', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
});

describe('POST /api/cron/subscription-expiration', () => {
  it('rejects without a valid CRON_SECRET bearer token', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(expireLapsedSubscriptions).not.toHaveBeenCalled();
  });

  it('runs both steps and reports counts on a valid request', async () => {
    const res = await POST(makeReq('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, expired: 2, trialReminded: 1, renewalReminded: 3 });
    expect(expireLapsedSubscriptions).toHaveBeenCalledTimes(1);
    expect(sendUpcomingSubscriptionReminders).toHaveBeenCalledTimes(1);
  });

  it("exports runtime='nodejs'", async () => {
    const mod = (await import('./route')) as { runtime?: string };
    expect(mod.runtime).toBe('nodejs');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter frontend exec vitest run src/app/api/cron/subscription-expiration/route.test.ts`
Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 7: Implement the cron route**

Create `frontend/src/app/api/cron/subscription-expiration/route.ts`:

```ts
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
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter frontend exec vitest run src/app/api/cron/subscription-expiration/route.test.ts`
Expected: PASS

- [ ] **Step 9: Register the cron in vercel.json**

In `frontend/vercel.json`, add a new entry to the `"crons"` array (order doesn't matter functionally; append at the end for a minimal diff):

```json
    { "path": "/api/cron/inactivity-nudges", "schedule": "0 20 * * *" },
    { "path": "/api/cron/subscription-expiration", "schedule": "0 5 * * *" }
```

(That replaces the previous last line — `{ "path": "/api/cron/inactivity-nudges", "schedule": "0 20 * * *" }` — which was the final array entry; add a trailing comma to it and the new entry after it, keeping the closing `]`/`}` unchanged.)

- [ ] **Step 10: Full suite + typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend exec vitest run`
Expected: no type errors; only pre-existing bcrypt-timeout flakiness (if any) — a real failure anywhere else means investigate before continuing.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/lib/server/subscriptions/expire.ts frontend/src/lib/server/subscriptions/expire.test.ts frontend/src/app/api/cron/subscription-expiration/route.ts frontend/src/app/api/cron/subscription-expiration/route.test.ts frontend/vercel.json
git commit -m "feat(subscriptions): daily expiration cron with trial/renewal reminders"
```

---

### Task 6: `GET /api/orders/[id]`

**Files:**
- Create: `frontend/src/app/api/orders/[id]/route.ts`
- Test: `frontend/src/app/api/orders/[id]/route.test.ts`

**Interfaces:**
- Produces: `GET` returning `{ id, status, amount, currency, purpose, createdAt }` for an order owned by the caller — consumed by Task 7's pages via the client-side `api()` wrapper as `api<OrderStatus>(\`/api/orders/${id}\`)`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/api/orders/[id]/route.test.ts`:

```ts
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET } from './route';

const mockRequireAuth = vi.mocked(requireAuth);

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { sub: 'user-1', email: 'me@example.com' } } as never);
});

describe('GET /api/orders/[id]', () => {
  it('returns the order when owned by the caller', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      amount: 13500,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'annual' },
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
    } as never);

    const res = await GET(new NextRequest('http://test/api/orders/o1'), ctxFor('o1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: 'o1',
      status: 'PAID',
      amount: 13500,
      currency: 'XOF',
      purpose: 'subscription',
      createdAt: '2026-08-29T00:00:00.000Z',
    });
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', userId: 'user-1' } }),
    );
  });

  it('returns null purpose for a non-subscription order', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'o2',
      status: 'PENDING',
      amount: 5000,
      currency: 'XOF',
      metadata: null,
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
    } as never);

    const res = await GET(new NextRequest('http://test/api/orders/o2'), ctxFor('o2'));
    const body = await res.json();
    expect(body.purpose).toBeNull();
  });

  it('returns 404 when the order does not exist or belongs to another user', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const res = await GET(new NextRequest('http://test/api/orders/o3'), ctxFor('o3'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('ORDER_NOT_FOUND');
  });

  it('requires auth', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Missing token' }, { status: 401 }));

    const res = await GET(new NextRequest('http://test/api/orders/o1'), ctxFor('o1'));
    expect(res.status).toBe(401);
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/app/api/orders/[id]/route.test.ts`
Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 3: Implement the route**

Create `frontend/src/app/api/orders/[id]/route.ts`:

```ts
// GET /api/orders/[id] — one order the caller owns. Backs the generic
// post-checkout landing pages (/orders/[id]/success, /orders/[id]/failed)
// and their client-side polling while a webhook confirmation is in flight.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const order = await prisma.order.findFirst({
      where: { id, userId: auth.user.sub },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'ORDER_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const metadata = (order.metadata ?? null) as Record<string, unknown> | null;
    const purpose = metadata && typeof metadata.purpose === 'string' ? metadata.purpose : null;

    return NextResponse.json(
      {
        id: order.id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        purpose,
        createdAt: order.createdAt.toISOString(),
      },
      { headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/orders/[id]/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/api/orders/[id]/route.ts" "frontend/src/app/api/orders/[id]/route.test.ts"
git commit -m "feat(orders): add GET /api/orders/[id]"
```

---

### Task 7: Pages `/orders/[id]/success` et `/orders/[id]/failed`

**Files:**
- Create: `frontend/src/app/orders/[id]/success/page.tsx`
- Create: `frontend/src/app/orders/[id]/failed/page.tsx`

**Interfaces:**
- Consumes: `GET /api/orders/[id]` (Task 6) via `api<OrderStatus>()`; `useUser` from `@/contexts/AuthContext`; `FormPageSkeleton`; `Icon`; `formatPrice` — all existing, established conventions (see `frontend/src/app/auth/error/page.tsx` and `frontend/src/app/savings/[goalId]/confirmed/page.tsx` for the pattern this follows).

No new tests — these are client pages with no server logic of their own (the logic they call, `GET /api/orders/[id]`, is already tested in Task 6). This project's existing page components (e.g. `auth/error/page.tsx`, `savings/[goalId]/confirmed/page.tsx`) have no colocated test files either — UI is verified by running the dev server, matching that established convention.

- [ ] **Step 1: Create the success page**

Create `frontend/src/app/orders/[id]/success/page.tsx`:

```tsx
// /orders/[id]/success — generic post-checkout landing page. POST
// /api/orders hardcodes this as its successUrl for EVERY order (not just
// subscriptions), so this page must handle both a subscription purchase
// and any other future use of the same generic checkout.
//
// Bictorys redirects here as soon as the user confirms payment on their
// phone, which can be BEFORE the webhook has landed and flipped the Order
// to PAID (WH-01/WH-02 in webhook/handler.ts are correct but async) — so
// this polls GET /api/orders/[id] for a short window rather than trusting
// a single fetch.
//
// TODO(Plan 3 — /subscription page): once /subscription exists, point the
// subscription-purpose CTA there instead of /dashboard.
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';

interface OrderStatus {
  id: string;
  status: string;
  amount: number;
  currency: string;
  purpose: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s total

export default function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick(count: number) {
      try {
        const res = await api<OrderStatus>(`/api/orders/${id}`);
        if (cancelled) return;
        setOrder(res);
        if (res.status === 'PENDING' && count < MAX_POLLS) {
          setPolls(count + 1);
          timer = setTimeout(() => void tick(count + 1), POLL_INTERVAL_MS);
        } else {
          setPolls(count);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Commande introuvable.');
      }
    }
    void tick(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="font-body text-sm text-accent">{error}</p>
        <Link href="/" className="font-body text-sm text-muted-foreground underline">
          Accueil
        </Link>
      </main>
    );
  }

  if (!order) return <FormPageSkeleton />;

  const isSubscription = order.purpose === 'subscription';
  const confirmed = order.status === 'PAID';
  const stillPending = order.status === 'PENDING' && polls >= MAX_POLLS;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
        <Icon i={confirmed ? 'check' : 'clock'} size={32} className="text-white" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-headings text-2xl font-bold text-foreground">
          {confirmed
            ? 'Paiement confirmé !'
            : stillPending
              ? 'Confirmation en cours'
              : 'Paiement en cours de confirmation'}
        </h1>
        <p className="font-body text-sm text-muted-foreground">
          {confirmed &&
            (isSubscription
              ? 'Ton abonnement Pro est actif.'
              : `Ton paiement de ${formatPrice(order.amount)} F a bien été reçu.`)}
          {!confirmed &&
            stillPending &&
            'Ça prend plus de temps que prévu — vérifie à nouveau dans quelques minutes.'}
          {!confirmed && !stillPending && "On attend la confirmation de ta banque ou de ton opérateur..."}
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground"
      >
        {isSubscription ? 'Voir mon tableau de bord' : "Retour à l'accueil"}
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Create the failed page**

Create `frontend/src/app/orders/[id]/failed/page.tsx`:

```tsx
// /orders/[id]/failed — generic post-checkout failure landing page. POST
// /api/orders hardcodes this as its failureUrl for every order. No polling
// needed here: Bictorys only redirects to this URL once the payment
// attempt has actually failed.
//
// TODO(Plan 3 — /subscription page): once /subscription exists, point the
// subscription-purpose "Réessayer" CTA there instead of /dashboard.
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';

interface OrderStatus {
  id: string;
  status: string;
  amount: number;
  currency: string;
  purpose: string | null;
}

export default function OrderFailedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<OrderStatus>(`/api/orders/${id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Commande introuvable.'));
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  const isSubscription = order?.purpose === 'subscription';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        <Icon i="x" size={32} className="text-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-headings text-2xl font-bold text-foreground">Paiement non abouti</h1>
        <p className="font-body text-sm text-muted-foreground">
          {error ??
            "Ton paiement n'a pas pu être confirmé. Réessaie ou choisis un autre moyen de paiement."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link
          href="/dashboard"
          className="rounded-lg bg-primary px-6 py-3 text-center font-body text-sm font-bold text-primary-foreground"
        >
          {isSubscription ? 'Réessayer' : "Retour à l'accueil"}
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Lint + typecheck**

Run: `pnpm --filter frontend exec eslint "src/app/orders/**" && pnpm --filter frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check on the dev server**

Run: `pnpm dev`, then in another terminal create a PENDING order row for your dev user directly via `pnpm db:studio` (or a one-off script) and visit `/orders/<that-id>/success` and `/orders/<that-id>/failed` while logged in. Confirm: no console errors, the skeleton shows briefly, then the real content renders, and the polling stops once you flip the row to `PAID` in Prisma Studio while the success page is open.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/orders/[id]/success/page.tsx" "frontend/src/app/orders/[id]/failed/page.tsx"
git commit -m "feat(orders): add post-checkout success/failed landing pages"
```

---

## Self-Review

**Spec coverage:**
- Essai Pro 7 jours à l'inscription, un seul par compte, `lastOrderId: null` → Task 1. ✅
- Modèle "pass" : payer prolonge depuis `max(now, currentPeriodEnd)`, jamais de prélèvement automatique → Task 3. ✅
- Downgrade non-destructif (archivage du surplus, jamais suppression) + upgrade réactive tout → Task 2, câblé par Tasks 3 (upgrade) et 5 (downgrade). ✅
- Rappel de renouvellement -3j (payant) et rappel de fin d'essai -2j (avec vrais chiffres du compte) → Task 4 (templates) + Task 5 (cron). ✅
- Fin d'essai non converti gérée par le même mécanisme d'expiration qu'un abonnement payé non renouvelé, sans logique supplémentaire → Task 5's `expireLapsedSubscriptions` traite les deux identiquement (seule la copy varie via `wasTrial`). ✅
- Confirmation d'expiration, copy "rester actif" jamais "garder tes données" → Task 4. ✅
- Journalisation minimale des transitions de cycle de vie (`trial_started`) → Task 1 (`log.info('subscription trial_started', ...)`). `trial_reminder_sent` / `subscription_renewed` / `subscription_lapsed` sont observables via les compteurs déjà loggés par le cron (`log.info('subscription-expiration tick', { expired, trialReminded, renewalReminded })`) et par le webhook (le `subscriptionUpsert` s'exécute déjà sous un contexte de requête qui logue — aucune ligne de log supplémentaire n'a été jugée nécessaire au-delà de ces deux points, qui donnent déjà un taux de conversion mesurable : essais démarrés (Task 1) vs. essais rappelés/expirés (cron) vs. abonnements activés (déductible du nombre d'appels `onPaid` avec `subMeta` non-null, visible dans les logs applicatifs existants).
- Pages `/orders/[id]/success` et `/orders/[id]/failed` référencées par `POST /api/orders` mais inexistantes → Task 6 + Task 7. ✅
- Réutilisation de `POST /api/orders` existant pour l'achat d'abonnement, aucune nouvelle route de paiement → confirmé par la conception (Task 3 ne fait que lire `order.metadata`, ne crée aucune route). ✅

**Hors scope de CE plan (rappel, déjà noté dans le spec) :** le bouton "Passer à Pro" et la page `/subscription` elle-même (Plan 3) — ce plan les suppose absents et route donc les CTA post-paiement vers `/dashboard` avec un TODO explicite plutôt que vers une route qui n'existe pas encore.

**Placeholder scan:** aucun "TODO"/"TBD" hors les deux TODO explicites et intentionnels de Task 7 (pointant vers Plan 3, pas une lacune de CE plan) ; aucune section "similar to Task N" sans code réel ; chaque étape de test contient des assertions concrètes.

**Type consistency:** `ArchiveTxClient` (Task 2) est utilisé identiquement dans Task 3 (`tx` typé `PrismaTransactionClient`) et Task 5 (`tx` d'un `prisma.$transaction`) — vérifié structurellement compatible avec les deux (voir note dans Task 3, Step 5). `SubscriptionOrderMetadata`/`parseSubscriptionOrderMetadata` (Task 1) a la même forme partout où il est consommé (Task 3). Les noms de templates (Task 4) correspondent exactement aux imports utilisés dans Task 5. `OrderStatus` (Task 7) correspond exactement à la forme JSON renvoyée par Task 6.
