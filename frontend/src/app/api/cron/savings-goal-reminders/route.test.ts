import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const findMany = vi.fn();
const aggregate = vi.fn();
const notifPrefsFindMany = vi.fn();
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    savingsGoal: { findMany: (...args: unknown[]) => findMany(...args) },
    savingsEntry: { aggregate: (...args: unknown[]) => aggregate(...args) },
    notificationPreferences: { findMany: (...args: unknown[]) => notifPrefsFindMany(...args) },
  },
}));

const createNotificationMock = vi.fn();
vi.mock('@/lib/server/notifications', () => ({
  createNotification: (...args: unknown[]) => createNotificationMock(...args),
}));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  findMany.mockReset();
  aggregate.mockReset();
  notifPrefsFindMany.mockReset();
  notifPrefsFindMany.mockResolvedValue([]);
  createNotificationMock.mockReset();
  createNotificationMock.mockResolvedValue({ id: 'notif-1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/savings-goal-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('POST /api/cron/savings-goal-reminders', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('reminds a daily-pace goal that saved less than its pace amount yesterday', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0)); // Friday — daily always due

    findMany.mockResolvedValueOnce([
      {
        id: 'goal-1',
        userId: 'user-1',
        name: 'biscuit',
        period: 'daily',
        paceAmount: 500,
        targetAmount: 5000,
        currentAmount: 1000,
      },
    ]);
    aggregate.mockResolvedValueOnce({ _sum: { amount: 100 } }); // saved 100, wanted 500

    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checked: 1, reminded: 1 });
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('does not remind when the user disabled SAVINGS_GOAL_PACE_MISSED (checked before the entries query)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));

    findMany.mockResolvedValueOnce([
      {
        id: 'goal-off',
        userId: 'user-1',
        name: 'silence',
        period: 'daily',
        paceAmount: 500,
        targetAmount: 5000,
        currentAmount: 1000,
      },
    ]);
    notifPrefsFindMany.mockResolvedValueOnce([
      { userId: 'user-1', prefs: { SAVINGS_GOAL_PACE_MISSED: { inApp: false } } },
    ]);

    const { POST } = await import('./route');
    const res = await POST(makeReq());

    expect(await res.json()).toEqual({ ok: true, checked: 1, reminded: 0 });
    expect(aggregate).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
    expect(notifPrefsFindMany.mock.calls[0]?.[0]).toEqual({
      where: { userId: { in: ['user-1'] } },
      select: { userId: true, prefs: true },
    });
  });

  it('does not remind a goal that met its pace', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));

    findMany.mockResolvedValueOnce([
      {
        id: 'goal-2',
        userId: 'user-1',
        name: 'fleur',
        period: 'daily',
        paceAmount: 500,
        targetAmount: 5000,
        currentAmount: 1000,
      },
    ]);
    aggregate.mockResolvedValueOnce({ _sum: { amount: 600 } }); // saved more than pace

    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, checked: 1, reminded: 0 });
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('skips an already-completed goal without even checking its entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));

    findMany.mockResolvedValueOnce([
      {
        id: 'goal-3',
        userId: 'user-1',
        name: 'done',
        period: 'daily',
        paceAmount: 500,
        targetAmount: 1000,
        currentAmount: 1000,
      },
    ]);

    const { POST } = await import('./route');
    await POST(makeReq());
    expect(aggregate).not.toHaveBeenCalled();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('only queries weekly/monthly goals on their check day (skips entirely on an off day)', async () => {
    vi.useFakeTimers();
    // Friday: weekly (Monday-only) and monthly (1st-only) are both off.
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));

    findMany.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, checked: 0, reminded: 0 });
    const where = findMany.mock.calls[0]![0] as { where: { period: { in: string[] } } };
    expect(where.where.period.in).toEqual(['daily']);
  });

  it('includes weekly and monthly on a Monday-the-1st', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0)); // Tue 1 Sep 2026 — not Monday

    findMany.mockResolvedValueOnce([]);
    const { POST } = await import('./route');
    await POST(makeReq());
    const where = findMany.mock.calls[0]![0] as { where: { period: { in: string[] } } };
    // Sep 1 2026 is a Tuesday, so only daily + monthly are due, not weekly.
    expect(where.where.period.in).toEqual(['daily', 'monthly']);
  });
});
