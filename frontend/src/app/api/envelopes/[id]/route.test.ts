// PATCH /api/envelopes/[id] tests — focused on the duplicate-name guard on
// rename (same rationale as envelopes/route.test.ts, but must exclude the
// envelope being renamed itself from the collision check).
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { PATCH } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePatch(body: unknown): NextRequest {
  return new NextRequest('http://test/api/envelopes/env-1', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-tok',
      cookie: 'app-csrf=csrf-tok',
    },
    body: JSON.stringify(body),
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
});

describe('PATCH /api/envelopes/[id]', () => {
  it('renames when the new name does not collide with another envelope', async () => {
    prismaMock.envelope.findMany.mockResolvedValue([]);
    prismaMock.envelope.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.envelope.findUnique.mockResolvedValue({
      id: 'env-1',
      name: 'Loisirs',
      icon: 'gamepad-2',
      color: 'envelope-2',
      monthlyLimit: 15000,
    } as never);

    const res = await PATCH(makePatch({ name: 'Loisirs' }), withParams('env-1'));
    expect(res.status).toBe(200);
    expect(prismaMock.envelope.updateMany).toHaveBeenCalled();
  });

  it('rejects renaming into a name already used by another envelope', async () => {
    prismaMock.envelope.findMany.mockResolvedValue([{ name: 'Transport' } as never]);

    const res = await PATCH(makePatch({ name: 'Transport' }), withParams('env-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('ENVELOPE_NAME_TAKEN');
    expect(prismaMock.envelope.updateMany).not.toHaveBeenCalled();
  });

  it('excludes the envelope itself from the collision check (case-only rename)', async () => {
    // findMany is called with `id: { not: 'env-1' }` — the mock just returns
    // what a correctly-scoped query would: nothing, since "Transport" IS
    // env-1's own current name.
    prismaMock.envelope.findMany.mockResolvedValue([]);
    prismaMock.envelope.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.envelope.findUnique.mockResolvedValue({
      id: 'env-1',
      name: 'transport',
      icon: 'car',
      color: 'envelope-1',
      monthlyLimit: 20000,
    } as never);

    const res = await PATCH(makePatch({ name: 'transport' }), withParams('env-1'));
    expect(res.status).toBe(200);
    expect(prismaMock.envelope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', id: { not: 'env-1' } } }),
    );
  });

  it('skips the name check entirely when name is not part of the patch', async () => {
    prismaMock.envelope.updateMany.mockResolvedValue({ count: 1 });
    // monthlyLimit unchanged (25000 -> 25000) — not an increase, so the
    // budget-exceeded check's own findMany("others") must not fire either.
    prismaMock.envelope.findUnique.mockResolvedValue({
      id: 'env-1',
      userId: 'user-1',
      name: 'Transport',
      icon: 'car',
      color: 'envelope-1',
      monthlyLimit: 25000,
    } as never);

    const res = await PATCH(makePatch({ monthlyLimit: 25000 }), withParams('env-1'));
    expect(res.status).toBe(200);
    expect(prismaMock.envelope.findMany).not.toHaveBeenCalled();
  });

  // Regression: raising one envelope's limit could push the sum of ALL
  // envelope limits past the total budget with no guard at all.
  it('rejects raising a limit past the remaining total budget', async () => {
    prismaMock.envelope.findUnique.mockResolvedValue({
      id: 'env-1',
      userId: 'user-1',
      name: 'Santé',
      icon: 'heart-pulse',
      color: 'envelope-1',
      monthlyLimit: 10000, // current limit
    } as never);
    prismaMock.user.findUnique.mockResolvedValue({ totalBudget: 70000 } as never);
    prismaMock.envelope.findMany.mockResolvedValue([
      { monthlyLimit: 15000 },
      { monthlyLimit: 10000 },
    ] as never);

    const res = await PATCH(makePatch({ monthlyLimit: 60000 }), withParams('env-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('ENVELOPE_BUDGET_EXCEEDED');
    expect(prismaMock.envelope.updateMany).not.toHaveBeenCalled();
  });

  it('allows LOWERING a limit even while other envelopes are already over-allocated', async () => {
    // Total of other envelopes (60000 + 15000 + 10000 = 85000) already
    // exceeds a 70000 budget — this edit only ever decreases its own
    // limit, so it must never be blocked by that pre-existing state.
    prismaMock.envelope.findUnique.mockResolvedValue({
      id: 'env-cafe',
      userId: 'user-1',
      name: 'Café',
      icon: 'coffee',
      color: 'envelope-1',
      monthlyLimit: 2800,
    } as never);
    prismaMock.envelope.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(makePatch({ monthlyLimit: 1000 }), withParams('env-cafe'));
    expect(res.status).toBe(200);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.envelope.updateMany).toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the envelope does not belong to this user', async () => {
    prismaMock.envelope.findUnique.mockResolvedValue({
      id: 'env-1',
      userId: 'someone-else',
      name: 'Santé',
      icon: 'heart-pulse',
      color: 'envelope-1',
      monthlyLimit: 10000,
    } as never);

    const res = await PATCH(makePatch({ monthlyLimit: 60000 }), withParams('env-1'));
    expect(res.status).toBe(404);
    expect(prismaMock.envelope.updateMany).not.toHaveBeenCalled();
  });
});
