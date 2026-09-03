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
  it('returns the order plus the renewal date when owned by the caller', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      amount: 13500,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'annual' },
      createdAt: new Date('2026-08-29T00:00:00.000Z'),
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      currentPeriodEnd: new Date('2027-08-29T00:00:00.000Z'),
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
      period: 'annual',
      currentPeriodEnd: '2027-08-29T00:00:00.000Z',
      createdAt: '2026-08-29T00:00:00.000Z',
    });
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1', userId: 'user-1' } }),
    );
    expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('returns null purpose/period/currentPeriodEnd for a non-subscription order', async () => {
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
    expect(body.period).toBeNull();
    expect(body.currentPeriodEnd).toBeNull();
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
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
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );

    const res = await GET(new NextRequest('http://test/api/orders/o1'), ctxFor('o1'));
    expect(res.status).toBe(401);
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });
});
