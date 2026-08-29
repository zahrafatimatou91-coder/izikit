// DELETE /api/auth/oauth/google — unlink "Sign in with Google" from the
// current account. Refuses when Google is the only remaining login method.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '@/lib/server/middleware';
import { DELETE } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeReq(opts: { csrf?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.csrf ?? true) {
    headers['x-csrf-token'] = 'csrf-tok';
    headers['cookie'] = 'app-csrf=csrf-tok';
  }
  return new NextRequest('http://test/api/auth/oauth/google', { method: 'DELETE', headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  __cookieStore.clear();
  mockRequireAuth.mockResolvedValue(authedCtx);
});

describe('DELETE /api/auth/oauth/google', () => {
  it('missing CSRF header → 403, no delete', async () => {
    const res = await DELETE(makeReq({ csrf: false }));
    expect(res.status).toBe(403);
    expect(prismaMock.oAuthAccount.deleteMany).not.toHaveBeenCalled();
  });

  it('requireAuth bail → 401, no delete', async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing token' }, { status: 401 }),
    );
    const res = await DELETE(makeReq());
    expect(res.status).toBe(401);
    expect(prismaMock.oAuthAccount.deleteMany).not.toHaveBeenCalled();
  });

  it('unlinks Google when the account also has a password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: 'bcrypt-hash',
      oauthAccounts: [{ provider: 'google' }],
    } as never);
    prismaMock.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await DELETE(makeReq());

    expect(res.status).toBe(200);
    expect(prismaMock.oAuthAccount.deleteMany.mock.calls[0]?.[0]).toEqual({
      where: { userId: 'user-1', provider: 'google' },
    });
  });

  it('unlinks Google when another provider is still linked', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: null,
      oauthAccounts: [{ provider: 'google' }, { provider: 'github' }],
    } as never);
    prismaMock.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await DELETE(makeReq());

    expect(res.status).toBe(200);
    expect(prismaMock.oAuthAccount.deleteMany).toHaveBeenCalled();
  });

  it('refuses (409 LAST_LOGIN_METHOD) when Google is the only login method', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: null,
      oauthAccounts: [{ provider: 'google' }],
    } as never);

    const res = await DELETE(makeReq());

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('LAST_LOGIN_METHOD');
    expect(prismaMock.oAuthAccount.deleteMany).not.toHaveBeenCalled();
  });

  it('409 NOT_LINKED when no Google account is linked', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: 'bcrypt-hash',
      oauthAccounts: [],
    } as never);

    const res = await DELETE(makeReq());

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('NOT_LINKED');
    expect(prismaMock.oAuthAccount.deleteMany).not.toHaveBeenCalled();
  });
});

describe('source invariants', () => {
  it("route source contains runtime='nodejs', verifyCsrf, withRequestContext", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
    expect(src).toContain('verifyCsrf(req)');
    expect(src).toContain('withRequestContext');
  });
});
