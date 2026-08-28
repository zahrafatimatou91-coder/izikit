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
import { POST } from './route';

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

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
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
