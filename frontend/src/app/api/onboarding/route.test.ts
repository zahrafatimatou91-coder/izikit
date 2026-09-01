// POST /api/onboarding tests.
//
// Pattern mirrors transactions/route.test.ts: prismaMock first (auto-hoists
// vi.mock for '@/lib/server/prisma'), mockNextCookies() for the async
// cookies() store, vi.mock('@/lib/server/middleware') so requireAuth is
// controlled per test.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://test/api/onboarding', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-tok',
      cookie: 'app-csrf=csrf-tok',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
});

describe('POST /api/onboarding', () => {
  it('persists totalBudget + budgetFrequency without country (backward compatible)', async () => {
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POST(makePost({ totalBudget: 50000, budgetFrequency: 'monthly' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ totalBudget: 50000, budgetFrequency: 'monthly', country: null });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { totalBudget: 50000, budgetFrequency: 'monthly' },
    });
  });

  it('persists an uppercase country code as-is', async () => {
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POST(
      makePost({ totalBudget: 50000, budgetFrequency: 'monthly', country: 'SN' }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { totalBudget: 50000, budgetFrequency: 'monthly', country: 'SN' },
    });
  });

  it('normalizes a lowercase country code to uppercase', async () => {
    prismaMock.user.update.mockResolvedValue({} as never);
    const res = await POST(
      makePost({ totalBudget: 50000, budgetFrequency: 'monthly', country: 'cm' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.country).toBe('CM');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { totalBudget: 50000, budgetFrequency: 'monthly', country: 'CM' },
    });
  });

  it('rejects an unknown country code (400 VALIDATION_FAILED)', async () => {
    const res = await POST(
      makePost({ totalBudget: 50000, budgetFrequency: 'monthly', country: 'US' }),
    );
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid budgetFrequency', async () => {
    const res = await POST(makePost({ totalBudget: 50000, budgetFrequency: 'yearly' }));
    expect(res.status).toBe(400);
  });
});
