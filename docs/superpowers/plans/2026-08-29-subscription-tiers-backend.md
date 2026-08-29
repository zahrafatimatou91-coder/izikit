# Subscription Tiers & Gating — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Free/Pro tier distinction real in the backend — a Free
account is actually limited (2 envelopes, 0 savings goals, 2 months of
visible history, no Tendances/Conseils), a Pro account is actually
unlimited, and nothing is ever silently deleted when someone drops from Pro
to Free.

**Architecture:** One new pure helper (`subscriptions/tier.ts`) computes the
*effective* plan live from the existing `Subscription` row (never trusting
the stored `plan` column blindly, since it can lag until the daily
expiration cron runs). Every route that needs to gate a feature calls this
helper directly — no new middleware HOF, since the check differs per
resource (a count limit, a hard block, a date floor). A `Subscription`
row's presence is optional per user; its absence means Free.

**Tech Stack:** Next.js 16 Route Handlers, Prisma 5, Vitest + the existing
`prismaMock`/`mockNextCookies` test utilities.

**Spec:** [docs/superpowers/specs/2026-08-29-monetization-subscription-design.md](../specs/2026-08-29-monetization-subscription-design.md) — this plan implements the "Chantier 1" data-model/gating requirements and the `GET /api/subscription` read needed by the later `/subscription` page plan. Trial creation, checkout wiring, the expiration cron, and notifications are a separate follow-up plan (they depend on the helper this plan produces).

## Global Constraints

- Every Route Handler exports `export const runtime = 'nodejs';` (CLAUDE.md — enforced by CI).
- Every mutating route calls `verifyCsrf(req)` before `requireAuth()`.
- FCFA amounts are integers in the smallest unit — never decimals (not touched by this plan, no money moves here, but keep in mind for the next one).
- Free tier: 2 envelopes max, 0 savings goals, history visible = current month + previous month only, no Tendances, no Conseils personnalisés.
- Pro tier: all of the above unlimited/unlocked.
- Archiving (never deletion) is the only mechanism that removes something from a Free user's active view.
- New stable error codes introduced by this plan: `ENVELOPE_TIER_LIMIT`, `SAVINGS_GOAL_REQUIRES_PRO`, `INSIGHTS_REQUIRES_PRO`, `TIPS_REQUIRES_PRO`. Frontend must switch on `.code`, never on message text (existing project convention).

---

## File Structure

- **Create** `frontend/src/lib/server/subscriptions/tier.ts` — the effective-plan helper + Free-tier constants. Single responsibility: given a `Subscription` row (or none), answer "what plan does this user actually have right now, and where's the Free history floor?"
- **Create** `frontend/src/lib/server/subscriptions/tier.test.ts`
- **Create** `frontend/src/app/api/subscription/route.ts` — `GET` only in this plan (no `POST` yet — that's checkout, next plan).
- **Create** `frontend/src/app/api/subscription/route.test.ts`
- **Modify** `frontend/prisma/schema.prisma` — add `archivedAt` to `Envelope` and `SavingsGoal`.
- **Modify** `frontend/src/app/api/envelopes/route.ts` — gate `POST`, expose `archived` on `GET`.
- **Modify** `frontend/src/app/api/envelopes/route.test.ts` — add the new tier-limit tests.
- **Modify** `frontend/src/app/api/savings-goals/route.ts` — gate `POST`, expose `archived` on `GET`.
- **Modify** `frontend/src/app/api/savings-goals/route.test.ts`
- **Modify** `frontend/src/app/api/transactions/route.ts` — filter `GET` history by date floor for Free.
- **Modify** `frontend/src/app/api/transactions/route.test.ts`
- **Modify** `frontend/src/app/api/insights/route.ts` — 403 for Free.
- **Create** `frontend/src/app/api/insights/route.test.ts` (none exists yet — check before creating; if one exists, extend it instead).
- **Modify** `frontend/src/app/api/tips/route.ts` — 403 for Free.
- **Create** `frontend/src/app/api/tips/route.test.ts` (same caveat as insights).

---

### Task 1: Prisma schema — `archivedAt` on Envelope and SavingsGoal

**Files:**
- Modify: `frontend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Envelope.archivedAt: DateTime | null`, `SavingsGoal.archivedAt: DateTime | null` — every later task reads/writes these two fields under that exact name.

- [ ] **Step 1: Add the fields**

In `frontend/prisma/schema.prisma`, inside `model Envelope { ... }`, add one line right after `updatedAt`:

```prisma
model Envelope {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  icon         String // lucide icon name, user-picked
  color        String // swatch key from src/lib/envelope-colors.ts, e.g. "envelope-1"
  monthlyLimit Int // smallest unit (FCFA has no decimals)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  // Set when a Free downgrade pushes this envelope past the 2-envelope
  // limit (oldest-created first). Never deleted — see
  // docs/superpowers/specs/2026-08-29-monetization-subscription-design.md
  // "Downgrade". Reactivated (set back to null) the moment the user is Pro
  // again.
  archivedAt   DateTime?

  transactions Transaction[]

  @@index([userId])
}
```

Inside `model SavingsGoal { ... }`, add the same field right after `paceAmount`:

```prisma
  paceAmount    Int?
  // Same archiving mechanism as Envelope.archivedAt — see that field's
  // comment.
  archivedAt    DateTime?
  createdAt     DateTime @default(now())
```

- [ ] **Step 2: Apply the migration**

Run: `pnpm db:migrate:dev --name add_archived_at_to_envelope_and_savings_goal`

Expected: a new folder under `frontend/prisma/migrations/` containing the `ALTER TABLE` for both columns, and Prisma Client regenerated (check `frontend/node_modules/.prisma/client` timestamp updated).

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm --filter frontend exec vitest run`
Expected: PASS (a new nullable column changes nothing for existing code paths).

- [ ] **Step 4: Commit**

```bash
git add frontend/prisma/schema.prisma frontend/prisma/migrations
git commit -m "feat(subscriptions): add archivedAt to Envelope and SavingsGoal"
```

---

### Task 2: `subscriptions/tier.ts` — effective plan helper

**Files:**
- Create: `frontend/src/lib/server/subscriptions/tier.ts`
- Test: `frontend/src/lib/server/subscriptions/tier.test.ts`

**Interfaces:**
- Produces:
  - `type EffectivePlan = 'FREE' | 'PRO'`
  - `interface SubscriptionLike { plan: string; currentPeriodEnd: Date | null }`
  - `getEffectivePlan(sub: SubscriptionLike | null): EffectivePlan`
  - `isTrial(sub: SubscriptionLike & { lastOrderId: string | null }): boolean`
  - `getHistoryFloor(plan: EffectivePlan, now?: Date): Date | null`
  - `FREE_MAX_ENVELOPES: 2`, `FREE_MAX_SAVINGS_GOALS: 0`

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/lib/server/subscriptions/tier.test.ts
import { describe, it, expect } from 'vitest';
import { getEffectivePlan, isTrial, getHistoryFloor, FREE_MAX_ENVELOPES, FREE_MAX_SAVINGS_GOALS } from './tier';

describe('getEffectivePlan', () => {
  it('returns FREE when there is no subscription row', () => {
    expect(getEffectivePlan(null)).toBe('FREE');
  });

  it('returns FREE when plan is FREE', () => {
    expect(getEffectivePlan({ plan: 'FREE', currentPeriodEnd: null })).toBe('FREE');
  });

  it('returns FREE for the unused PLUS tier (defensive default)', () => {
    expect(getEffectivePlan({ plan: 'PLUS', currentPeriodEnd: null })).toBe('FREE');
  });

  it('returns PRO when plan is PRO and currentPeriodEnd is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(getEffectivePlan({ plan: 'PRO', currentPeriodEnd: future })).toBe('PRO');
  });

  it('returns FREE when plan is PRO but currentPeriodEnd has passed', () => {
    const past = new Date(Date.now() - 60_000);
    expect(getEffectivePlan({ plan: 'PRO', currentPeriodEnd: past })).toBe('FREE');
  });

  it('returns PRO when plan is PRO and currentPeriodEnd is null (defensive — no expiry set)', () => {
    expect(getEffectivePlan({ plan: 'PRO', currentPeriodEnd: null })).toBe('PRO');
  });
});

describe('isTrial', () => {
  it('is true for an active PRO subscription with no lastOrderId', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTrial({ plan: 'PRO', currentPeriodEnd: future, lastOrderId: null })).toBe(true);
  });

  it('is false once a real order has paid for the period', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTrial({ plan: 'PRO', currentPeriodEnd: future, lastOrderId: 'order-1' })).toBe(false);
  });

  it('is false for a lapsed trial (effective plan is FREE)', () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTrial({ plan: 'PRO', currentPeriodEnd: past, lastOrderId: null })).toBe(false);
  });
});

describe('getHistoryFloor', () => {
  it('returns null (no floor) for PRO', () => {
    expect(getHistoryFloor('PRO')).toBeNull();
  });

  it('returns the first instant of the previous calendar month for FREE', () => {
    const now = new Date(Date.UTC(2026, 8, 29)); // 2026-09-29 (month index 8 = September)
    const floor = getHistoryFloor('FREE', now);
    expect(floor?.toISOString()).toBe(new Date(Date.UTC(2026, 7, 1)).toISOString()); // 2026-08-01
  });

  it('handles the January edge case (rolls back to previous December)', () => {
    const now = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
    const floor = getHistoryFloor('FREE', now);
    expect(floor?.toISOString()).toBe(new Date(Date.UTC(2025, 11, 1)).toISOString()); // 2025-12-01
  });
});

describe('tier constants', () => {
  it('match the spec', () => {
    expect(FREE_MAX_ENVELOPES).toBe(2);
    expect(FREE_MAX_SAVINGS_GOALS).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/tier.test.ts`
Expected: FAIL — `Cannot find module './tier'`.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/lib/server/subscriptions/tier.ts
//
// Effective-plan computation and Free-tier limits. Every route that gates
// a feature imports from here — never re-derive this logic inline.
//
// IMPORTANT: never gate on the raw `Subscription.plan` column alone. A
// lapsed Pro period still reads `plan: 'PRO'` in the DB until the daily
// `subscription-expiration` cron catches up (up to ~24h lag) — see the
// follow-up plan for that cron. `getEffectivePlan` always computes the
// LIVE state by also checking `currentPeriodEnd`, so gating is correct
// regardless of cron timing. The cron is only responsible for the
// *side effects* of a lapse (archiving over-limit rows, sending the
// "your Pro ended" notification) — not for access control.
import 'server-only';

export type EffectivePlan = 'FREE' | 'PRO';

export interface SubscriptionLike {
  plan: string;
  currentPeriodEnd: Date | null;
}

/** Free tier: 2 envelopes max (spec "Chantier 1"). */
export const FREE_MAX_ENVELOPES = 2;
/** Free tier: savings goals are 100% Pro-exclusive. */
export const FREE_MAX_SAVINGS_GOALS = 0;
/** Free tier: history visible = current month + this many months back. */
export const FREE_HISTORY_MONTHS_BACK = 1;

export function getEffectivePlan(sub: SubscriptionLike | null): EffectivePlan {
  if (!sub) return 'FREE';
  if (sub.plan !== 'PRO') return 'FREE'; // covers FREE and the unused PLUS reservation
  if (sub.currentPeriodEnd === null) return 'PRO'; // defensive: every PRO row this app creates sets an expiry
  return sub.currentPeriodEnd.getTime() > Date.now() ? 'PRO' : 'FREE';
}

/**
 * A subscription is "trial" iff it's currently effective PRO and no real
 * order has ever paid for it (`lastOrderId` stays null for the entire
 * 7-day trial window — see the checkout plan). Once a payment lands,
 * `lastOrderId` is set and it becomes a paid subscription even if the
 * plan/currentPeriodEnd values look identical in shape.
 */
export function isTrial(sub: SubscriptionLike & { lastOrderId: string | null }): boolean {
  return sub.lastOrderId === null && getEffectivePlan(sub) === 'PRO';
}

/**
 * First instant (UTC) of the earliest month a Free account may see in its
 * transaction history. `null` means no floor — show everything (Pro).
 */
export function getHistoryFloor(plan: EffectivePlan, now: Date = new Date()): Date | null {
  if (plan === 'PRO') return null;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - FREE_HISTORY_MONTHS_BACK, 1));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/lib/server/subscriptions/tier.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/server/subscriptions/tier.ts frontend/src/lib/server/subscriptions/tier.test.ts
git commit -m "feat(subscriptions): add getEffectivePlan/isTrial/getHistoryFloor helper"
```

---

### Task 3: `GET /api/subscription`

**Files:**
- Create: `frontend/src/app/api/subscription/route.ts`
- Test: `frontend/src/app/api/subscription/route.test.ts`

**Interfaces:**
- Consumes: `getEffectivePlan`, `isTrial` from `@/lib/server/subscriptions/tier` (Task 2).
- Produces: `GET` response shape `{ plan: 'FREE'|'PRO', status: string, currentPeriodEnd: string|null, isTrial: boolean }` — the `/subscription` page plan reads this exact shape.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/app/api/subscription/route.test.ts
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
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/subscription', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
});

describe('GET /api/subscription', () => {
  it('returns FREE with isTrial false when the user has no Subscription row', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      plan: 'FREE',
      status: 'ACTIVE',
      currentPeriodEnd: null,
      isTrial: false,
    });
  });

  it('returns PRO + isTrial true during the 7-day trial window', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: future,
      lastOrderId: null,
    } as never);

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.plan).toBe('PRO');
    expect(body.isTrial).toBe(true);
    expect(body.currentPeriodEnd).toBe(future.toISOString());
  });

  it('returns PRO + isTrial false once a real order has paid', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: future,
      lastOrderId: 'order-1',
    } as never);

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.isTrial).toBe(false);
  });

  it('returns FREE when a Pro period has lapsed, even if the stored plan still says PRO', async () => {
    const past = new Date(Date.now() - 60_000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: past,
      lastOrderId: 'order-1',
    } as never);

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.plan).toBe('FREE');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend exec vitest run src/app/api/subscription/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement**

```typescript
// frontend/src/app/api/subscription/route.ts
//
// GET /api/subscription — the current user's plan status. Backs the
// /subscription page's status banner and every "Fonctionnalité Pro" gate
// elsewhere in the app that needs to know the live plan client-side.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { getEffectivePlan, isTrial } from '@/lib/server/subscriptions/tier';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const sub = await prisma.subscription.findUnique({ where: { userId: auth.user.sub } });
    const plan = getEffectivePlan(sub);

    return NextResponse.json(
      {
        plan,
        status: sub?.status ?? 'ACTIVE',
        currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        isTrial: sub ? isTrial(sub) : false,
      },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/subscription/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/subscription/route.ts frontend/src/app/api/subscription/route.test.ts
git commit -m "feat(subscriptions): add GET /api/subscription"
```

---

### Task 4: Gate `POST /api/envelopes` at the Free limit + expose `archived`

**Files:**
- Modify: `frontend/src/app/api/envelopes/route.ts`
- Modify: `frontend/src/app/api/envelopes/route.test.ts`

**Interfaces:**
- Consumes: `getEffectivePlan`, `FREE_MAX_ENVELOPES` from Task 2.
- Produces: `POST` 403 body `{ error: 'ENVELOPE_TIER_LIMIT', message: string }` when a Free user already has `FREE_MAX_ENVELOPES` non-archived envelopes. `GET` response items gain `archived: boolean`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/app/api/envelopes/route.test.ts` (same file, new `describe` block — keep the existing duplicate-name tests as-is):

```typescript
vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));
// (already present at the top of the file — do not duplicate the mock,
// just add the new describe block below the existing ones)

describe('POST /api/envelopes — Free tier limit', () => {
  it('blocks a 3rd envelope for a Free account with ENVELOPE_TIER_LIMIT', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null); // no row = Free
    prismaMock.envelope.findMany.mockResolvedValue([
      { name: 'Nourriture', monthlyLimit: 10000, archivedAt: null },
      { name: 'Transport', monthlyLimit: 10000, archivedAt: null },
    ] as never);

    const res = await POST(
      makePost({ name: 'Loisirs', icon: 'star', color: 'envelope-3', monthlyLimit: 5000 }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ENVELOPE_TIER_LIMIT');
    expect(prismaMock.envelope.create).not.toHaveBeenCalled();
  });

  it('does not count archived envelopes against the Free limit', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.envelope.findMany.mockResolvedValue([
      { name: 'Nourriture', monthlyLimit: 10000, archivedAt: null },
      { name: 'Ancienne', monthlyLimit: 10000, archivedAt: new Date() },
    ] as never);
    prismaMock.envelope.create.mockResolvedValue({
      id: 'env-2',
      name: 'Loisirs',
      icon: 'star',
      color: 'envelope-3',
      monthlyLimit: 5000,
    } as never);

    const res = await POST(
      makePost({ name: 'Loisirs', icon: 'star', color: 'envelope-3', monthlyLimit: 5000 }),
    );
    expect(res.status).toBe(201);
  });

  it('allows a 3rd+ envelope for a Pro account', async () => {
    const future = new Date(Date.now() + 60_000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      currentPeriodEnd: future,
    } as never);
    prismaMock.envelope.findMany.mockResolvedValue([
      { name: 'Nourriture', monthlyLimit: 10000, archivedAt: null },
      { name: 'Transport', monthlyLimit: 10000, archivedAt: null },
    ] as never);
    prismaMock.envelope.create.mockResolvedValue({
      id: 'env-3',
      name: 'Loisirs',
      icon: 'star',
      color: 'envelope-3',
      monthlyLimit: 5000,
    } as never);

    const res = await POST(
      makePost({ name: 'Loisirs', icon: 'star', color: 'envelope-3', monthlyLimit: 5000 }),
    );
    expect(res.status).toBe(201);
  });
});

describe('GET /api/envelopes — archived flag', () => {
  it('exposes archived: true for an envelope with archivedAt set', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ budgetFrequency: 'monthly' } as never);
    prismaMock.envelope.findMany.mockResolvedValue([
      {
        id: 'env-1',
        name: 'Ancienne',
        icon: 'star',
        color: 'envelope-1',
        monthlyLimit: 10000,
        archivedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);
    prismaMock.transaction.groupBy.mockResolvedValue([]);

    const res = await GET(new NextRequest('http://test/api/envelopes'));
    const body = await res.json();
    expect(body.envelopes[0].archived).toBe(true);
  });
});
```

Add `GET` to the existing `import { POST } from './route';` line so it reads `import { GET, POST } from './route';`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend exec vitest run src/app/api/envelopes/route.test.ts`
Expected: FAIL — the new tests fail (403 tests get 201, `archived` is `undefined`).

- [ ] **Step 3: Implement**

In `frontend/src/app/api/envelopes/route.ts`, add the import and the check inside `POST`, and add `archived` to the `GET` mapping.

```typescript
// add to the existing imports
import { getEffectivePlan, FREE_MAX_ENVELOPES } from '@/lib/server/subscriptions/tier';
```

In `POST`, right after the existing `existingEnvelopes` fetch (which currently `select`s `{ name, monthlyLimit }` — widen it to also select `archivedAt`), add the tier subscription lookup and the limit check, before the duplicate-name check:

```typescript
    const [user, existingEnvelopes, subscription] = await Promise.all([
      prisma.user.findUnique({ where: { id: auth.user.sub }, select: { totalBudget: true } }),
      prisma.envelope.findMany({
        where: { userId: auth.user.sub },
        select: { name: true, monthlyLimit: true, archivedAt: true },
      }),
      prisma.subscription.findUnique({ where: { userId: auth.user.sub } }),
    ]);

    const plan = getEffectivePlan(subscription);
    const activeCount = existingEnvelopes.filter((e) => e.archivedAt === null).length;
    if (plan === 'FREE' && activeCount >= FREE_MAX_ENVELOPES) {
      return NextResponse.json(
        {
          error: 'ENVELOPE_TIER_LIMIT',
          message: `Le plan Free est limité à ${FREE_MAX_ENVELOPES} enveloppes — passe à Pro pour en ajouter.`,
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }
```

(This replaces the existing `const [user, existingEnvelopes] = await Promise.all([...])` block — keep everything below it, i.e. the duplicate-name check and the budget-sum check, unchanged.)

In `GET`, find the response-mapping line — currently the route returns raw `envelopes` mixed with computed `spent` (check the exact current mapping near the end of the `GET` handler and add `archived: e.archivedAt !== null` to each mapped envelope object, alongside the existing `spent` field).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/envelopes/route.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/envelopes/route.ts frontend/src/app/api/envelopes/route.test.ts
git commit -m "feat(subscriptions): gate envelope creation at the Free limit, expose archived flag"
```

---

### Task 5: Gate `POST /api/savings-goals` (Free = 0) + expose `archived`

**Files:**
- Modify: `frontend/src/app/api/savings-goals/route.ts`
- Modify: `frontend/src/app/api/savings-goals/route.test.ts`

**Interfaces:**
- Consumes: `getEffectivePlan` from Task 2.
- Produces: `POST` 403 body `{ error: 'SAVINGS_GOAL_REQUIRES_PRO', message: string }` for any Free account, unconditionally. `GET` items gain `archived: boolean`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/app/api/savings-goals/route.test.ts` (check the top of the file first — it needs the same `requireAuth` mock as Task 4; add `prismaMock.subscription.findUnique` calls same way):

```typescript
describe('POST /api/savings-goals — Free tier gate', () => {
  it('blocks any goal creation for a Free account with SAVINGS_GOAL_REQUIRES_PRO', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await POST(
      makePost({ name: 'Vélo', icon: 'bike', targetAmount: 50000, period: 'weekly', paceAmount: 5000 }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('SAVINGS_GOAL_REQUIRES_PRO');
    expect(prismaMock.savingsGoal.create).not.toHaveBeenCalled();
    expect(prismaMock.savingsGoal.findMany).not.toHaveBeenCalled(); // gate short-circuits before the duplicate-name check
  });

  it('allows goal creation for a Pro account', async () => {
    const future = new Date(Date.now() + 60_000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      currentPeriodEnd: future,
    } as never);
    prismaMock.savingsGoal.findMany.mockResolvedValue([]);
    prismaMock.savingsGoal.create.mockResolvedValue({
      id: 'goal-1',
      name: 'Vélo',
      icon: 'bike',
      targetAmount: 50000,
      currentAmount: 0,
      period: 'weekly',
      paceAmount: 5000,
      createdAt: new Date(),
    } as never);

    const res = await POST(
      makePost({ name: 'Vélo', icon: 'bike', targetAmount: 50000, period: 'weekly', paceAmount: 5000 }),
    );
    expect(res.status).toBe(201);
  });
});
```

Check whether `makePost` already exists in this test file (it does, per the pattern seen in Task 4's sibling file) — reuse it; do not redefine.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend exec vitest run src/app/api/savings-goals/route.test.ts`
Expected: FAIL — Free case currently returns 201, not 403.

- [ ] **Step 3: Implement**

Add the import:

```typescript
import { getEffectivePlan } from '@/lib/server/subscriptions/tier';
```

In `POST`, insert this check immediately after the `verifyCsrf`/`requireAuth` block and BEFORE the `req.json()` body parse (savings goals are entirely Pro-gated — no need to even validate the body for a Free user):

```typescript
    const subscription = await prisma.subscription.findUnique({ where: { userId: auth.user.sub } });
    if (getEffectivePlan(subscription) === 'FREE') {
      return NextResponse.json(
        {
          error: 'SAVINGS_GOAL_REQUIRES_PRO',
          message: 'Les objectifs d\'épargne sont réservés à Pro — passe à Pro pour commencer à épargner.',
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }
```

In `GET`, find where `goals` is mapped into the response (the existing handler builds a `goals` array combined with `entries`/`breakdown` — locate the per-goal object construction and add `archived: g.archivedAt !== null` alongside the other fields already there, e.g. `id`, `name`, `targetAmount`).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/savings-goals/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/savings-goals/route.ts frontend/src/app/api/savings-goals/route.test.ts
git commit -m "feat(subscriptions): gate savings-goal creation behind Pro, expose archived flag"
```

---

### Task 6: Filter `GET /api/transactions` history by date for Free

**Files:**
- Modify: `frontend/src/app/api/transactions/route.ts`
- Modify: `frontend/src/app/api/transactions/route.test.ts`

**Interfaces:**
- Consumes: `getEffectivePlan`, `getHistoryFloor` from Task 2.
- Produces: no response-shape change — `GET` simply omits rows older than the Free floor from the existing paginated `items` array.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/app/api/transactions/route.test.ts` (check the top of the file for its existing `requireAuth`/`prismaMock` setup and reuse it — do not re-declare `mockRequireAuth`):

```typescript
describe('GET /api/transactions — Free history floor', () => {
  it('adds an occurredAt floor to the query for a Free account', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null); // Free
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await GET(new NextRequest('http://test/api/transactions'));

    const callArgs = prismaMock.transaction.findMany.mock.calls[0]?.[0];
    expect(callArgs.where.occurredAt).toEqual({ gte: expect.any(Date) });
  });

  it('adds no occurredAt floor for a Pro account', async () => {
    const future = new Date(Date.now() + 60_000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      currentPeriodEnd: future,
    } as never);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await GET(new NextRequest('http://test/api/transactions'));

    const callArgs = prismaMock.transaction.findMany.mock.calls[0]?.[0];
    expect(callArgs.where.occurredAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend exec vitest run src/app/api/transactions/route.test.ts`
Expected: FAIL — `callArgs.where.occurredAt` is `undefined` in the Free case (no floor applied yet).

- [ ] **Step 3: Implement**

Add the import:

```typescript
import { getEffectivePlan, getHistoryFloor } from '@/lib/server/subscriptions/tier';
```

In `GET`, right after `const auth = await requireAuth();` guard, fetch the subscription and compute the floor; then merge it into the existing `where` object:

```typescript
    const subscription = await prisma.subscription.findUnique({ where: { userId: auth.user.sub } });
    const historyFloor = getHistoryFloor(getEffectivePlan(subscription));

    const url = req.nextUrl;
    const limit = clampLimit(url.searchParams.get('limit'));
    const cursor = decodeCursor(url.searchParams.get('cursor'));

    const where: Prisma.TransactionWhereInput = {
      userId: auth.user.sub,
      ...cursorWhere(cursor),
      ...(historyFloor ? { occurredAt: { gte: historyFloor } } : {}),
    };
```

(This replaces the existing `const where: Prisma.TransactionWhereInput = { userId: auth.user.sub, ...cursorWhere(cursor) };` block — everything below it in the handler is unchanged.)

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/transactions/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/transactions/route.ts frontend/src/app/api/transactions/route.test.ts
git commit -m "feat(subscriptions): limit Free-tier transaction history to the last 2 months"
```

---

### Task 7: Gate `GET /api/insights` behind Pro

**Files:**
- Modify: `frontend/src/app/api/insights/route.ts`
- Create or extend: `frontend/src/app/api/insights/route.test.ts` — **first run** `find frontend/src/app/api/insights -name "route.test.ts"` to check whether one already exists; if it does, add the new `describe` block to it instead of overwriting.

**Interfaces:**
- Consumes: `getEffectivePlan` from Task 2.
- Produces: `GET` 403 body `{ error: 'INSIGHTS_REQUIRES_PRO', message: string }` for Free accounts.

- [ ] **Step 1: Write the failing test**

```typescript
// If frontend/src/app/api/insights/route.test.ts does not exist yet, create
// it with this content. If it exists, add this describe block to it and
// reuse its existing requireAuth/prismaMock setup instead of redeclaring.
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { sub: 'user-1', email: 'me@example.com' } } as never);
});

describe('GET /api/insights — Pro gate', () => {
  it('blocks a Free account with INSIGHTS_REQUIRES_PRO', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest('http://test/api/insights'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('INSIGHTS_REQUIRES_PRO');
  });

  it('allows a Pro account through', async () => {
    const future = new Date(Date.now() + 60_000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      currentPeriodEnd: future,
    } as never);

    const res = await GET(new NextRequest('http://test/api/insights'));
    expect(res.status).not.toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend exec vitest run src/app/api/insights/route.test.ts`
Expected: FAIL (or, if creating the file fresh, the "allows a Pro account" case may error on unrelated missing mocks — that's fine, only the 403 test needs to pass after Step 3; if the "allows" test needs more mocking than shown here because of other data this route fetches, that's pre-existing route behavior outside this task's scope — narrow that test's assertion to just `res.status !== 403` as written, which does not require mocking the rest of the route's data).

- [ ] **Step 3: Implement**

Add the import:

```typescript
import { getEffectivePlan } from '@/lib/server/subscriptions/tier';
```

In `GET`, right after the `requireAuth` guard:

```typescript
    const subscription = await prisma.subscription.findUnique({ where: { userId: auth.user.sub } });
    if (getEffectivePlan(subscription) === 'FREE') {
      return NextResponse.json(
        {
          error: 'INSIGHTS_REQUIRES_PRO',
          message: 'Les tendances sont réservées à Pro — passe à Pro pour y accéder.',
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/insights/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/insights/route.ts frontend/src/app/api/insights/route.test.ts
git commit -m "feat(subscriptions): gate Tendances (insights) behind Pro"
```

---

### Task 8: Gate `GET /api/tips` behind Pro

**Files:**
- Modify: `frontend/src/app/api/tips/route.ts`
- Create or extend: `frontend/src/app/api/tips/route.test.ts` — same existence check as Task 7.

**Interfaces:**
- Consumes: `getEffectivePlan` from Task 2.
- Produces: `GET` 403 body `{ error: 'TIPS_REQUIRES_PRO', message: string }` for Free accounts. (`GET /api/tips/[id]` and `POST /api/tips/[id]/apply` are unaffected by this task — a Free user cannot reach them anyway once the list itself 403s in the UI; leave those routes alone to keep this task's blast radius small.)

- [ ] **Step 1: Write the failing test**

Same shape as Task 7's test file, adapted:

```typescript
// frontend/src/app/api/tips/route.test.ts — same mocking preamble as
// insights' test (mockNextCookies, requireAuth mock) if the file doesn't
// already have one; otherwise add this describe block to the existing file.
describe('GET /api/tips — Pro gate', () => {
  it('blocks a Free account with TIPS_REQUIRES_PRO', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest('http://test/api/tips'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('TIPS_REQUIRES_PRO');
  });

  it('allows a Pro account through', async () => {
    const future = new Date(Date.now() + 60_000);
    prismaMock.subscription.findUnique.mockResolvedValue({
      plan: 'PRO',
      currentPeriodEnd: future,
    } as never);

    const res = await GET(new NextRequest('http://test/api/tips'));
    expect(res.status).not.toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter frontend exec vitest run src/app/api/tips/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Same pattern as Task 7, in `frontend/src/app/api/tips/route.ts`'s `GET`:

```typescript
import { getEffectivePlan } from '@/lib/server/subscriptions/tier';
```

```typescript
    const subscription = await prisma.subscription.findUnique({ where: { userId: auth.user.sub } });
    if (getEffectivePlan(subscription) === 'FREE') {
      return NextResponse.json(
        {
          error: 'TIPS_REQUIRES_PRO',
          message: 'Les conseils personnalisés sont réservés à Pro — passe à Pro pour y accéder.',
        },
        { status: 403, headers: { 'x-request-id': ctx.requestId } },
      );
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/tips/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/tips/route.ts frontend/src/app/api/tips/route.test.ts
git commit -m "feat(subscriptions): gate Conseils personnalisés (tips) behind Pro"
```

---

## Self-Review

**Spec coverage:**
- Free limits (2 envelopes, 0 goals, 2-month history, Tendances/Conseils locked) → Tasks 4–8. ✓
- Pro unlimited → covered by the same tasks' `getEffectivePlan() === 'PRO'` branches. ✓
- Archiving field existing so a later task can implement the actual archive/reactivate side effect → Task 1. ✓ (the archive/reactivate *behavior* itself — triggered by downgrade/expiration — belongs to the next plan, since it needs the expiration cron; this plan only adds the field and makes every read/write path respect it.)
- `GET /api/subscription` needed by the `/subscription` page plan → Task 3. ✓
- Trial creation, checkout, cron, notifications, order success/failed pages → explicitly out of this plan's scope, called out in the plan header as the next plan.

**Placeholder scan:** no TBD/TODO; every step has real code. The one deliberately open item (Step 3 of Tasks 7/8 test-file existence check) is an explicit instruction, not a placeholder — the executor runs one `find` command and branches, both branches are fully specified.

**Type consistency:** `SubscriptionLike` (Task 2) matches the shape returned by `prisma.subscription.findUnique` used in Tasks 3–8 (`plan: string`, `currentPeriodEnd: Date | null`); `isTrial`'s extra `lastOrderId: string | null` matches the real column. `getHistoryFloor`'s `EffectivePlan` return type from `getEffectivePlan` is threaded consistently into Task 6.

## Next plans (not in this document)

1. **Trial, checkout & lifecycle** — signup-time trial `Subscription` row, `onPaid` webhook extension to upgrade a paid order into an active Pro period, new outbox event kinds + `notifications/templates.ts` entries (⚠️ touches the PROTECTED `outbox/dispatcher.ts` — the executor must pause and get explicit user confirmation before that specific edit, per CLAUDE.md), the `subscription-expiration` cron (archiving + reminders), and the still-missing generic `GET /api/orders/[id]` + `/orders/[id]/success` + `/orders/[id]/failed` pages the existing `POST /api/orders` route already redirects to.
2. **`/subscription` page** — depends on plan 1's checkout wiring and this plan's `GET /api/subscription`.
3. **Landing page hero + redesign** — no backend dependency, can run fully in parallel (good candidate to hand to a second session).
