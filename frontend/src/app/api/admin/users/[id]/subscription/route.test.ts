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
vi.mock('@/lib/server/subscriptions/archive', () => ({
  archiveSurplusForFreeDowngrade: vi.fn().mockResolvedValue(undefined),
  reactivateArchivedForProUpgrade: vi.fn().mockResolvedValue(undefined),
}));

import { requireSuperadmin } from '@/lib/server/middleware';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { verifyCsrf } from '@/lib/server/auth';
import { logAdminAction } from '@/lib/server/admin/audit';
import {
  archiveSurplusForFreeDowngrade,
  reactivateArchivedForProUpgrade,
} from '@/lib/server/subscriptions/archive';
import { POST } from './route';

const mockRequireSuperadmin = vi.mocked(requireSuperadmin);
const mockRateLimit = vi.mocked(enforceAdminRateLimit);
const mockVerifyCsrf = vi.mocked(verifyCsrf);
const mockLog = vi.mocked(logAdminAction);
const mockArchive = vi.mocked(archiveSurplusForFreeDowngrade);
const mockReactivate = vi.mocked(reactivateArchivedForProUpgrade);

const superCtx = {
  user: { sub: 'super-1', email: 's@test.local' },
  admin: { id: 'super-1', email: 's@test.local', role: 'SUPERADMIN' as const },
};

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://test/api/admin/users/u1/subscription', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}
function ctxWith(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperadmin.mockResolvedValue(superCtx);
  mockRateLimit.mockResolvedValue(null);
  mockVerifyCsrf.mockReturnValue(null);
  mockLog.mockResolvedValue(undefined);
  mockArchive.mockResolvedValue(undefined);
  mockReactivate.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as never);
  prismaMock.subscription.findUnique.mockResolvedValue(null as never);
  prismaMock.subscription.upsert.mockResolvedValue({} as never);
});

describe('POST /api/admin/users/[id]/subscription', () => {
  it('404s for an unknown user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null as never);
    const res = await POST(makePost({ action: 'grant' }), ctxWith('missing'));
    expect(res.status).toBe(404);
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it('400s on an invalid body', async () => {
    const res = await POST(makePost({ action: 'sideways' }), ctxWith('u1'));
    expect(res.status).toBe(400);
  });

  it('grants comp Pro: upserts PRO with a comp sentinel, reactivates, audits', async () => {
    const res = await POST(makePost({ action: 'grant', period: 'monthly' }), ctxWith('u1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription.plan).toBe('PRO');
    expect(body.subscription.isComp).toBe(true);
    const upsertArg = prismaMock.subscription.upsert.mock.calls[0]?.[0] as {
      create: { lastOrderId: string; plan: string };
    };
    expect(upsertArg.create.plan).toBe('PRO');
    expect(upsertArg.create.lastOrderId).toBe('comp:super-1');
    expect(mockReactivate).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'subscription.grant' }),
    );
  });

  it('revoke: flips to FREE/CANCELED, archives surplus, audits', async () => {
    const res = await POST(makePost({ action: 'revoke' }), ctxWith('u1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription.plan).toBe('FREE');
    const upsertArg = prismaMock.subscription.upsert.mock.calls[0]?.[0] as {
      update: { plan: string; status: string };
    };
    expect(upsertArg.update).toMatchObject({ plan: 'FREE', status: 'CANCELED' });
    expect(mockArchive).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(mockLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'subscription.revoke' }),
    );
  });

  it('rejects when CSRF fails', async () => {
    mockVerifyCsrf.mockReturnValueOnce(NextResponse.json({ error: 'CSRF' }, { status: 403 }));
    const res = await POST(makePost({ action: 'grant' }), ctxWith('u1'));
    expect(res.status).toBe(403);
  });

  it('requires SUPERADMIN', async () => {
    mockRequireSuperadmin.mockResolvedValueOnce(
      NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 }),
    );
    const res = await POST(makePost({ action: 'grant' }), ctxWith('u1'));
    expect(res.status).toBe(403);
  });
});
