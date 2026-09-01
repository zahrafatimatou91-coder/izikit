import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/subscriptions/expire', () => ({
  expireLapsedSubscriptions: vi.fn().mockResolvedValue({ expired: 2 }),
}));

import { POST } from './route';
import { expireLapsedSubscriptions } from '@/lib/server/subscriptions/expire';

function makeReq(authHeader?: string): NextRequest {
  return new NextRequest('http://test/api/cron/subscription-expiration', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
});

describe('POST /api/cron/subscription-expiration', () => {
  it('rejects without a valid CRON_SECRET bearer token', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(expireLapsedSubscriptions).not.toHaveBeenCalled();
  });

  it('expires lapsed subscriptions and reports the count', async () => {
    const res = await POST(makeReq('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, expired: 2 });
    expect(expireLapsedSubscriptions).toHaveBeenCalledTimes(1);
  });

  it("exports runtime='nodejs'", async () => {
    const mod = (await import('./route')) as { runtime?: string };
    expect(mod.runtime).toBe('nodejs');
  });
});
