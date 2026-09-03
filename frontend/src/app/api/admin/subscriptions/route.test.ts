import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);

const adminCtx = {
  user: { sub: 'admin-1', email: 'a@test.local' },
  admin: { id: 'admin-1', email: 'a@test.local', role: 'ADMIN' as const },
};

function makeGet(qs = ''): NextRequest {
  return new NextRequest(`http://test/api/admin/subscriptions${qs}`, { method: 'GET' });
}

function subRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 's1',
    userId: overrides.userId ?? 'u1',
    plan: overrides.plan ?? 'PRO',
    status: overrides.status ?? 'ACTIVE',
    currentPeriodEnd: overrides.currentPeriodEnd ?? new Date(Date.now() + 5 * 86400_000),
    lastOrderId: overrides.lastOrderId === undefined ? 'order_1' : overrides.lastOrderId,
    createdAt: overrides.createdAt ?? new Date('2026-08-01T00:00:00Z'),
    user: overrides.user ?? { email: 'u1@test.local', name: null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
});

describe('GET /api/admin/subscriptions', () => {
  it('returns { items: [], nextCursor: null } for no rows', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([] as never);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextCursor: null });
  });

  it('maps rows with computed effectivePlan / isTrial / isComp', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      subRow({ id: 's1', lastOrderId: null }), // trial
      subRow({ id: 's2', lastOrderId: 'comp:admin-9' }), // comp
      subRow({ id: 's3', lastOrderId: 'order_x' }), // paid
    ] as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).toMatchObject({ effectivePlan: 'PRO', isTrial: true, isComp: false });
    expect(body.items[1]).toMatchObject({ isTrial: false, isComp: true });
    expect(body.items[2]).toMatchObject({ isTrial: false, isComp: false });
    expect(body.items[0].userEmail).toBe('u1@test.local');
  });

  it('applies the ?trial=1 filter', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([] as never);
    await GET(makeGet('?trial=1'));
    const where = prismaMock.subscription.findMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    expect(where.plan).toBe('PRO');
    expect(where.lastOrderId).toBeNull();
  });

  it('applies the ?expiring=1 filter as a currentPeriodEnd window', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([] as never);
    await GET(makeGet('?expiring=1'));
    const where = prismaMock.subscription.findMany.mock.calls[0]?.[0]?.where as {
      currentPeriodEnd?: { gt?: Date; lte?: Date };
    };
    expect(where.currentPeriodEnd?.gt).toBeInstanceOf(Date);
    expect(where.currentPeriodEnd?.lte).toBeInstanceOf(Date);
  });

  it('forwards a 429 from the rate limiter', async () => {
    mockRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(429);
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });
});
