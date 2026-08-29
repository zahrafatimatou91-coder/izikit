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
