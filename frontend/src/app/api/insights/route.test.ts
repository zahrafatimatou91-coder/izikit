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
    // Minimal mocking so the rest of the (pre-existing) handler completes —
    // this task only tests the gate, not the insights computation itself.
    prismaMock.user.findUnique.mockResolvedValue({ totalBudget: 0 } as never);
    prismaMock.envelope.findMany.mockResolvedValue([]);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.savingsGoal.findMany.mockResolvedValue([]);

    const res = await GET(new NextRequest('http://test/api/insights'));
    expect(res.status).not.toBe(403);
  });
});
