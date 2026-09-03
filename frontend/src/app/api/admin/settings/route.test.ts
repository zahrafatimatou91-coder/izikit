import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAdmin: vi.fn(),
  requireSuperadmin: vi.fn(),
}));
vi.mock('@/lib/server/middleware/rate-limit-by-userid', () => ({
  enforceAdminRateLimit: vi.fn(),
}));
vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return { ...actual, verifyCsrf: vi.fn() };
});
vi.mock('@/lib/server/admin/audit', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { requireAdmin, requireSuperadmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import { GET, PATCH } from './route';
import { SUBSCRIPTION_PRICE_FCFA } from '@/lib/server/subscriptions/tier';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLog = vi.mocked(logAdminAction);

const adminCtx = {
  user: { sub: 'admin-1', email: 'a@test.local' },
  admin: { id: 'admin-1', email: 'a@test.local', role: 'ADMIN' as const },
};
const superCtx = {
  user: { sub: 'super-1', email: 's@test.local' },
  admin: { id: 'super-1', email: 's@test.local', role: 'SUPERADMIN' as const },
};

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/admin/settings', { method: 'GET' });
}
function makePatch(body: unknown): NextRequest {
  return new NextRequest('http://test/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(adminCtx);
  mockRequireSuperadmin.mockResolvedValue(superCtx);
  mockRateLimit.mockResolvedValue(null);
  mockVerifyCsrf.mockReturnValue(null);
  mockLog.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('GET /api/admin/settings', () => {
  it('returns every known key with isDefault:true when the table is empty', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([] as never);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings['subscription.pricing'].isDefault).toBe(true);
    expect(body.settings['subscription.pricing'].value).toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
    });
    expect(body.trialDays).toBeGreaterThan(0);
  });

  it('forwards a 403 from requireAdmin', async () => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/settings', () => {
  it('requires SUPERADMIN (forwards its 403)', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await PATCH(makePatch({ key: 'support.email', value: { email: 'x@y.z' } }));
    expect(res.status).toBe(403);
    expect(prismaMock.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects with 403 when CSRF fails', async () => {
    mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF' }, { status: 403 }));
    const res = await PATCH(makePatch({ key: 'support.email', value: { email: 'x@y.z' } }));
    expect(res.status).toBe(403);
  });

  it('400s on an unknown key', async () => {
    const res = await PATCH(makePatch({ key: 'nope', value: {} }));
    expect(res.status).toBe(400);
  });

  it('400 INVALID_SETTING_VALUE on a bad value for a known key', async () => {
    const res = await PATCH(makePatch({ key: 'subscription.pricing', value: { monthly: 1 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_SETTING_VALUE');
    expect(prismaMock.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('writes a valid pricing update and audits it', async () => {
    prismaMock.appSetting.upsert.mockResolvedValue({} as never);
    const res = await PATCH(
      makePatch({ key: 'subscription.pricing', value: { monthly: 1800, annual: 16000 } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      setting: { key: 'subscription.pricing', value: { monthly: 1800, annual: 16000 } },
    });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'settings.update', targetId: 'subscription.pricing' }),
    );
  });
});
