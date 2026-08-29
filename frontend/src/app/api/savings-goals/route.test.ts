// POST /api/savings-goals tests — focused on the duplicate-name guard.
//
// Pattern mirrors transactions/route.test.ts: prismaMock first (auto-hoists
// vi.mock for '@/lib/server/prisma'), mockNextCookies() for the async
// cookies() store, vi.mock('@/lib/server/middleware') so requireAuth is
// controlled per test. verifyCsrf is exercised for real (matching header +
// cookie) rather than mocked.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { GET, POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://test/api/savings-goals', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-tok',
      cookie: 'app-csrf=csrf-tok',
    },
    body: JSON.stringify(body),
  });
}

const proSubscription = { plan: 'PRO', currentPeriodEnd: new Date(Date.now() + 60_000) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
  // Savings goals are entirely Pro-gated (see the "Free tier gate" describe
  // block below) — the pre-existing tests in this block exercise the
  // duplicate-name guard, which only a Pro account can even reach now.
  prismaMock.subscription.findUnique.mockResolvedValue(proSubscription as never);
});

describe('POST /api/savings-goals', () => {
  it('creates a goal when the name is not taken', async () => {
    prismaMock.savingsGoal.findMany.mockResolvedValue([]);
    prismaMock.savingsGoal.create.mockResolvedValue({
      id: 'goal-1',
      name: 'Voyage',
      icon: 'plane',
      targetAmount: 10000,
      currentAmount: 0,
      period: 'monthly',
      paceAmount: 1000,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never);

    const res = await POST(
      makePost({
        name: 'Voyage',
        icon: 'plane',
        targetAmount: 10000,
        period: 'monthly',
        paceAmount: 1000,
      }),
    );
    expect(res.status).toBe(201);
    expect(prismaMock.savingsGoal.create).toHaveBeenCalled();
  });

  // Regression: two "photocopie" goals (differing only by pace) confused
  // the user — the only difference was a small pace label on the card.
  it('rejects a name that already exists for this user with GOAL_NAME_TAKEN', async () => {
    prismaMock.savingsGoal.findMany.mockResolvedValue([{ name: 'photocopie' } as never]);

    const res = await POST(
      makePost({
        name: 'photocopie',
        icon: 'camera',
        targetAmount: 1000,
        period: 'daily',
        paceAmount: 100,
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('GOAL_NAME_TAKEN');
    expect(typeof body.message).toBe('string');
    expect(prismaMock.savingsGoal.create).not.toHaveBeenCalled();
  });

  it('matches accent/case-insensitively (e.g. "Photocopie" vs "photocopie")', async () => {
    prismaMock.savingsGoal.findMany.mockResolvedValue([{ name: 'PHOTOCOPIE' } as never]);

    const res = await POST(
      makePost({
        name: 'photocopie',
        icon: 'camera',
        targetAmount: 1000,
        period: 'daily',
        paceAmount: 100,
      }),
    );
    expect(res.status).toBe(409);
    expect(prismaMock.savingsGoal.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/savings-goals — Free tier gate', () => {
  it('blocks any goal creation for a Free account with SAVINGS_GOAL_REQUIRES_PRO', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    const res = await POST(
      makePost({
        name: 'Vélo',
        icon: 'bike',
        targetAmount: 50000,
        period: 'weekly',
        paceAmount: 5000,
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('SAVINGS_GOAL_REQUIRES_PRO');
    expect(prismaMock.savingsGoal.create).not.toHaveBeenCalled();
    expect(prismaMock.savingsGoal.findMany).not.toHaveBeenCalled(); // gate short-circuits before the duplicate-name check
  });

  it('allows goal creation for a Pro account', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(proSubscription as never);
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
      makePost({
        name: 'Vélo',
        icon: 'bike',
        targetAmount: 50000,
        period: 'weekly',
        paceAmount: 5000,
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe('GET /api/savings-goals — archived flag', () => {
  it('exposes archived: true for a goal with archivedAt set', async () => {
    prismaMock.savingsGoal.findMany.mockResolvedValue([
      {
        id: 'goal-1',
        name: 'Ancien',
        icon: 'bike',
        targetAmount: 50000,
        currentAmount: 0,
        period: 'weekly',
        paceAmount: 5000,
        archivedAt: new Date(),
        createdAt: new Date(),
      },
    ] as never);
    prismaMock.savingsEntry.findMany.mockResolvedValue([]);

    const res = await GET(new NextRequest('http://test/api/savings-goals'));
    const body = await res.json();
    expect(body.goals[0].archived).toBe(true);
  });
});
