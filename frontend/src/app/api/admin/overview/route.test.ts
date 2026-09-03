import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));
vi.mock('@/lib/server/redis', () => ({ getRedis: vi.fn(() => null) }));

import { requireAdmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { getRedis } from '@/lib/server/redis';
import { GET } from './route';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockGetRedis = vi.mocked(getRedis);

const adminCtx = {
  user: { sub: 'admin-1', email: 'a@test.local' },
  admin: { id: 'admin-1', email: 'a@test.local', role: 'ADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/overview', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRateLimit.mockResolvedValue(null);
  prismaMock.user.count.mockResolvedValue(0 as never);
  prismaMock.subscription.findMany.mockResolvedValue([] as never);
  prismaMock.user.findMany.mockResolvedValue([] as never);
  prismaMock.order.findMany.mockResolvedValue([] as never);
  prismaMock.appSetting.findUnique.mockResolvedValue(null);
});

describe('GET /api/admin/overview', () => {
  it('forwards a 403 from requireAdmin without a DB hit', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('returns a zero-filled shape for an empty database', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toEqual({
      total: 0,
      byPlan: { free: 0, pro: 0 },
      activeTrials: 0,
      compedPro: 0,
      newLast30d: 0,
    });
    expect(body.signups).toHaveLength(6);
    expect(body.revenue).toEqual({ mrrFcfa: 0, paidSubs: 0, arpuFcfa: 0 });
    expect(body.system.db).toBe(true);
    expect(body.system.redis).toBe('off'); // getRedis mocked to null
  });

  it('counts effective Pro / trials and computes MRR from the amount actually paid', async () => {
    prismaMock.user.count.mockResolvedValueOnce(10 as never); // total
    prismaMock.user.count.mockResolvedValueOnce(3 as never); // newLast30d
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      { userId: 'u1', lastOrderId: 'order_1', currentPeriodEnd: new Date(Date.now() + 1e9) },
      { userId: 'u2', lastOrderId: null, currentPeriodEnd: new Date(Date.now() + 1e9) },
    ] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never); // signup rows
    prismaMock.user.findMany.mockResolvedValueOnce([] as never); // recent users
    prismaMock.order.findMany.mockResolvedValueOnce([
      { id: 'order_1', amount: 1500, metadata: { purpose: 'subscription', period: 'monthly' } },
    ] as never);

    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.users.byPlan.pro).toBe(2);
    expect(body.users.byPlan.free).toBe(8);
    expect(body.users.activeTrials).toBe(1);
    expect(body.revenue.paidSubs).toBe(1);
    expect(body.revenue.mrrFcfa).toBe(1500);
    expect(body.revenue.arpuFcfa).toBe(1500);
  });

  it('normalizes an annual sub to 1/12 of the amount actually paid', async () => {
    prismaMock.user.count.mockResolvedValueOnce(5 as never);
    prismaMock.user.count.mockResolvedValueOnce(0 as never);
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      { userId: 'u1', lastOrderId: 'order_y', currentPeriodEnd: new Date(Date.now() + 1e9) },
    ] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never);
    prismaMock.order.findMany.mockResolvedValueOnce([
      // paid 13 500 last year — a later admin price change must not move this
      { id: 'order_y', amount: 13500, metadata: { purpose: 'subscription', period: 'annual' } },
    ] as never);

    const body = await (await GET(makeGet())).json();
    expect(body.revenue.mrrFcfa).toBe(1125); // 13500 / 12
    expect(body.revenue.paidSubs).toBe(1);
  });

  it('excludes admin-comped Pro from MRR, ARPU and the paid count', async () => {
    prismaMock.user.count.mockResolvedValueOnce(4 as never);
    prismaMock.user.count.mockResolvedValueOnce(0 as never);
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      { userId: 'u1', lastOrderId: 'order_1', currentPeriodEnd: new Date(Date.now() + 1e9) },
      { userId: 'u2', lastOrderId: 'comp:admin-1', currentPeriodEnd: new Date(Date.now() + 1e9) },
    ] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never);
    prismaMock.order.findMany.mockResolvedValueOnce([
      { id: 'order_1', amount: 1500, metadata: { purpose: 'subscription', period: 'monthly' } },
    ] as never);

    const body = await (await GET(makeGet())).json();
    expect(body.users.byPlan.pro).toBe(2); // both are effective Pro
    expect(body.users.compedPro).toBe(1);
    expect(body.revenue.paidSubs).toBe(1); // comp not counted
    expect(body.revenue.mrrFcfa).toBe(1500); // comp adds nothing
    expect(body.revenue.arpuFcfa).toBe(1500);
  });

  it('flags a trial in the recent-users list', async () => {
    prismaMock.user.count.mockResolvedValueOnce(1 as never);
    prismaMock.user.count.mockResolvedValueOnce(1 as never);
    prismaMock.subscription.findMany.mockResolvedValueOnce([] as never);
    prismaMock.user.findMany.mockResolvedValueOnce([] as never); // signups
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: 'u1',
        name: null,
        email: 'trial@test.local',
        createdAt: new Date(),
        subscription: {
          plan: 'PRO',
          currentPeriodEnd: new Date(Date.now() + 1e9),
          lastOrderId: null,
        },
      },
    ] as never);
    prismaMock.order.findMany.mockResolvedValueOnce([] as never);

    const body = await (await GET(makeGet())).json();
    expect(body.recentUsers[0]).toMatchObject({ plan: 'PRO', isTrial: true });
  });

  it('reports redis "ok" when the live PING succeeds', async () => {
    mockGetRedis.mockReturnValueOnce({ ping: vi.fn().mockResolvedValue('PONG') } as never);
    const body = await (await GET(makeGet())).json();
    expect(body.system.redis).toBe('ok');
  });

  it('reports redis "down" when configured but the PING throws', async () => {
    mockGetRedis.mockReturnValueOnce({
      ping: vi.fn().mockRejectedValue(new Error('unauthorized')),
    } as never);
    const body = await (await GET(makeGet())).json();
    expect(body.system.redis).toBe('down');
  });
});
