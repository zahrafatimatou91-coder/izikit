// POST /api/tips/[id]/apply tests.
//
// Pattern mirrors transactions/route.test.ts: prismaMock first (auto-hoists
// vi.mock for '@/lib/server/prisma'), mockNextCookies() for the async
// cookies() store, vi.mock('@/lib/server/middleware') so requireAuth is
// controlled per test. verifyCsrf is exercised for real (matching header +
// cookie) rather than mocked, same as transactions/route.test.ts.
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

function makeApplyRequest(): NextRequest {
  return new NextRequest('http://test/api/tips/tip-1/apply', {
    method: 'POST',
    headers: { 'x-csrf-token': 'csrf-tok', cookie: 'app-csrf=csrf-tok' },
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const tip = {
  id: 'tip-1',
  title: "Fonds d'urgence",
  body: 'body',
  icon: 'piggy-bank',
  category: 'epargne',
  estimatedSavingsFcfa: 2500,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
  prismaMock.tip.findUnique.mockResolvedValue(tip as never);
});

describe('POST /api/tips/[id]/apply', () => {
  it('creates a new goal seeded from the tip when nothing matches', async () => {
    prismaMock.savingsGoal.findFirst.mockResolvedValue(null);
    prismaMock.savingsGoal.findMany.mockResolvedValue([]);
    prismaMock.savingsGoal.create.mockResolvedValue({
      id: 'goal-1',
      name: "Fonds d'urgence",
      icon: 'piggy-bank',
      targetAmount: 2500,
      currentAmount: 0,
      period: 'monthly',
    } as never);

    const res = await POST(makeApplyRequest(), withParams('tip-1'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.alreadyApplied).toBe(false);
    expect(body.linkedExistingGoal).toBe(false);
    expect(prismaMock.savingsGoal.create).toHaveBeenCalled();
  });

  it('returns the existing goal when this exact tip was already applied (no duplicate)', async () => {
    prismaMock.savingsGoal.findFirst.mockResolvedValue({
      id: 'goal-1',
      name: "Fonds d'urgence",
      icon: 'piggy-bank',
      targetAmount: 2500,
      currentAmount: 100,
      period: 'monthly',
    } as never);

    const res = await POST(makeApplyRequest(), withParams('tip-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyApplied).toBe(true);
    expect(body.linkedExistingGoal).toBe(false);
    expect(prismaMock.savingsGoal.create).not.toHaveBeenCalled();
  });

  // Regression: applying "Fonds d'urgence" when the user already manually
  // created a goal named "Fonds d'urgence" (tipId: null) used to spawn a
  // second, rival "Fonds d'urgence" card instead of recognizing it as the
  // same objective.
  it('links to an existing unlinked goal with a matching name instead of creating a duplicate', async () => {
    prismaMock.savingsGoal.findFirst.mockResolvedValue(null);
    prismaMock.savingsGoal.findMany.mockResolvedValue([
      {
        id: 'manual-goal',
        name: "Fonds d'urgence",
        icon: 'piggy-bank',
        targetAmount: 5000,
        currentAmount: 1500,
        period: 'monthly',
        tipId: null,
      } as never,
    ]);
    prismaMock.savingsGoal.update.mockResolvedValue({
      id: 'manual-goal',
      name: "Fonds d'urgence",
      icon: 'piggy-bank',
      targetAmount: 5000,
      currentAmount: 1500,
      period: 'monthly',
      tipId: 'tip-1',
    } as never);

    const res = await POST(makeApplyRequest(), withParams('tip-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal.id).toBe('manual-goal');
    expect(body.goal.currentAmount).toBe(1500); // the manually-tracked progress is preserved
    expect(body.alreadyApplied).toBe(true);
    expect(body.linkedExistingGoal).toBe(true);
    expect(prismaMock.savingsGoal.update).toHaveBeenCalledWith({
      where: { id: 'manual-goal' },
      data: { tipId: 'tip-1' },
    });
    expect(prismaMock.savingsGoal.create).not.toHaveBeenCalled();
  });

  it('matches an existing goal name accent/case-insensitively', async () => {
    prismaMock.savingsGoal.findFirst.mockResolvedValue(null);
    prismaMock.savingsGoal.findMany.mockResolvedValue([
      {
        id: 'manual-goal',
        name: 'FONDS D’URGENCE'.replace('’', "'"), // uppercase variant
        icon: 'piggy-bank',
        targetAmount: 5000,
        currentAmount: 0,
        period: 'monthly',
        tipId: null,
      } as never,
    ]);
    prismaMock.savingsGoal.update.mockResolvedValue({
      id: 'manual-goal',
      name: "Fonds d'urgence",
      icon: 'piggy-bank',
      targetAmount: 5000,
      currentAmount: 0,
      period: 'monthly',
      tipId: 'tip-1',
    } as never);

    const res = await POST(makeApplyRequest(), withParams('tip-1'));
    const body = await res.json();
    expect(body.linkedExistingGoal).toBe(true);
    expect(prismaMock.savingsGoal.update).toHaveBeenCalled();
  });

  it('returns TIP_NOT_FOUND for an unknown tip id', async () => {
    prismaMock.tip.findUnique.mockResolvedValue(null);

    const res = await POST(makeApplyRequest(), withParams('missing'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('TIP_NOT_FOUND');
  });
});
