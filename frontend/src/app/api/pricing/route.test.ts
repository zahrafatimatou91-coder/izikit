import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { GET } from './route';
import { SUBSCRIPTION_PRICE_FCFA, SUBSCRIPTION_TRIAL_DAYS } from '@/lib/server/subscriptions/tier';

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/pricing', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/pricing', () => {
  it('returns the constant fallback when no AppSetting row exists', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
      trialDays: SUBSCRIPTION_TRIAL_DAYS,
    });
  });

  it('returns the admin-set price when the row is valid', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: 'subscription.pricing',
      value: { monthly: 2000, annual: 19000 },
      updatedAt: new Date(),
      updatedBy: 'super-1',
    } as never);
    const res = await GET(makeGet());
    const body = await res.json();
    expect(body.monthly).toBe(2000);
    expect(body.annual).toBe(19000);
  });

  it('degrades to the constant when the database is unreachable (P1001)', async () => {
    prismaMock.appSetting.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Can’t reach database server', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
      trialDays: SUBSCRIPTION_TRIAL_DAYS,
    });
  });

  it('sets a short public cache header', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.headers.get('cache-control')).toContain('max-age=60');
  });
});
