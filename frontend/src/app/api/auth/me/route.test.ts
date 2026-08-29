// Tests for GET /api/auth/me (AUTH-06).
// Pattern 14. requireAuth-gated. Note: requireAuth uses cookies() from
// next/headers internally, so tests must use mockNextCookies + prismaMock.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies, __cookieStore } from '@/test-utils/mock-cookies';

mockNextCookies();

vi.mock('@/lib/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/auth')>('@/lib/server/auth');
  return {
    ...actual,
    verifyToken: vi.fn(),
  };
});

import { verifyToken } from '@/lib/server/auth';
import { GET, PATCH } from './route';
import { NextRequest } from 'next/server';

function makeReq(opts: { tokenCookie?: string; bearer?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  return new NextRequest('https://test/api/auth/me', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  __cookieStore.clear();
  vi.mocked(verifyToken).mockReset();
});

describe('GET /api/auth/me', () => {
  it('Test 1: authed — returns user identity', async () => {
    // Place token cookie via mock store; requireAuth reads it via cookies().
    __cookieStore.clear();
    // Fake cookies.set: use mockStore via the mock-cookies internal store.
    // Simpler: test injects directly through Bearer header path which
    // requireAuth supports as a fallback when no cookie is present.
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    } as never);

    const res = await GET(makeReq({ bearer: 'valid-access-token' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      user: { sub: 'u1', email: 'a@b.com' },
    });
  });

  it('Test 2: no cookie + no bearer — 401 missing token', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Missing token|token/i);
  });

  it('Test 3: stale tokenVersion — 401', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 1, // bumped via change-password
    } as never);

    const res = await GET(makeReq({ bearer: 'stale-jwt' }));
    expect(res.status).toBe(401);
  });

  it('Test 4: deleted user — 401', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'u-deleted',
      email: 'gone@b.com',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeReq({ bearer: 'orphan-jwt' }));
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me', () => {
  const CLOUD_URL = 'https://res.cloudinary.com/demo/image/upload/v1/u1/abc.jpg';

  function makePatchReq(
    body: unknown,
    opts: { bearer?: string; csrf?: boolean } = {},
  ): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    if (opts.csrf ?? true) {
      headers['x-csrf-token'] = 'csrf-tok';
      headers['cookie'] = 'app-csrf=csrf-tok';
    }
    return new NextRequest('https://test/api/auth/me', {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
  }

  function authOk(): void {
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'u1', email: 'a@b.com', tokenVersion: 0 });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tokenVersion: 0,
    } as never);
  }

  it('sets avatarUrl from a Cloudinary URL', async () => {
    authOk();
    prismaMock.user.update.mockResolvedValue({ name: 'Awa', avatarUrl: CLOUD_URL } as never);

    const res = await PATCH(makePatchReq({ avatarUrl: CLOUD_URL }, { bearer: 't' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ avatarUrl: CLOUD_URL });
    expect(prismaMock.user.update.mock.calls[0]?.[0]?.data).toEqual({ avatarUrl: CLOUD_URL });
  });

  it('clears avatarUrl when passed null', async () => {
    authOk();
    prismaMock.user.update.mockResolvedValue({ name: 'Awa', avatarUrl: null } as never);

    const res = await PATCH(makePatchReq({ avatarUrl: null }, { bearer: 't' }));

    expect(res.status).toBe(200);
    expect(prismaMock.user.update.mock.calls[0]?.[0]?.data).toEqual({ avatarUrl: null });
  });

  it('rejects an avatarUrl not hosted on Cloudinary', async () => {
    authOk();

    const res = await PATCH(
      makePatchReq({ name: 'Awa', avatarUrl: 'https://evil.example.com/x.jpg' }, { bearer: 't' }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('VALIDATION_FAILED');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects an empty patch', async () => {
    authOk();

    const res = await PATCH(makePatchReq({}, { bearer: 't' }));

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('still updates name on its own', async () => {
    authOk();
    prismaMock.user.update.mockResolvedValue({ name: 'Nouveau', avatarUrl: null } as never);

    const res = await PATCH(makePatchReq({ name: 'Nouveau' }, { bearer: 't' }));

    expect(res.status).toBe(200);
    expect(prismaMock.user.update.mock.calls[0]?.[0]?.data).toEqual({ name: 'Nouveau' });
  });

  it('missing CSRF header → 403', async () => {
    authOk();

    const res = await PATCH(makePatchReq({ name: 'X' }, { bearer: 't', csrf: false }));

    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
