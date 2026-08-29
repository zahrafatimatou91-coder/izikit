import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/server/cron/auth', () => ({ verifyCronSecret: vi.fn(() => null) }));
vi.mock('@/lib/server/leader-lease', () => ({
  withLease: vi.fn(async (_r: unknown, _n: string, _t: number, fn: () => Promise<void>) => fn()),
}));
vi.mock('@/lib/server/redis', () => ({ redis: null }));

const userFindMany = vi.fn();
const transactionFindMany = vi.fn();
const savingsEntryFindMany = vi.fn();
const prefsFindMany = vi.fn();
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    user: { findMany: (...args: unknown[]) => userFindMany(...args) },
    transaction: { findMany: (...args: unknown[]) => transactionFindMany(...args) },
    savingsEntry: { findMany: (...args: unknown[]) => savingsEntryFindMany(...args) },
    notificationPreferences: { findMany: (...args: unknown[]) => prefsFindMany(...args) },
  },
}));

const createNotificationMock = vi.fn();
vi.mock('@/lib/server/notifications', () => ({
  createNotification: (...args: unknown[]) => createNotificationMock(...args),
}));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  userFindMany.mockReset();
  transactionFindMany.mockReset();
  savingsEntryFindMany.mockReset();
  prefsFindMany.mockReset();
  createNotificationMock.mockReset();
  createNotificationMock.mockResolvedValue({ id: 'notif-1' });
  prefsFindMany.mockResolvedValue([]);
  savingsEntryFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/cron/inactivity-nudges', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('POST /api/cron/inactivity-nudges', () => {
  it('returns 401 when verifyCronSecret fails', async () => {
    const { verifyCronSecret } = await import('@/lib/server/cron/auth');
    (verifyCronSecret as Mock).mockReturnValueOnce(
      NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }),
    );
    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('nudges an onboarded user with no activity today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T13:00:00.000Z')); // midday slot

    userFindMany.mockResolvedValueOnce([{ id: 'user-1' }]);
    transactionFindMany.mockResolvedValueOnce([]);

    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checked: 1, nudged: 1 });
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
    const [, input] = createNotificationMock.mock.calls[0]!;
    expect(input.type).toBe('INACTIVITY_NUDGE');
    expect(input.dedupeKey).toBe('inactivity-nudge:user-1:2026-08-28:midday');
  });

  it('does not nudge a user who already logged a transaction today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T13:00:00.000Z'));

    userFindMany.mockResolvedValueOnce([{ id: 'user-1' }]);
    transactionFindMany.mockResolvedValueOnce([{ userId: 'user-1' }]);

    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, checked: 1, nudged: 0 });
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('does not nudge a user who already logged a savings entry today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T13:00:00.000Z'));

    userFindMany.mockResolvedValueOnce([{ id: 'user-1' }]);
    transactionFindMany.mockResolvedValueOnce([]);
    savingsEntryFindMany.mockResolvedValueOnce([{ savingsGoal: { userId: 'user-1' } }]);

    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, checked: 1, nudged: 0 });
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('skips a user who opted out of INACTIVITY_NUDGE in-app notifications', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T13:00:00.000Z'));

    userFindMany.mockResolvedValueOnce([{ id: 'user-1' }]);
    transactionFindMany.mockResolvedValueOnce([]);
    prefsFindMany.mockResolvedValueOnce([
      { userId: 'user-1', prefs: { INACTIVITY_NUDGE: { inApp: false } } },
    ]);

    const { POST } = await import('./route');
    const res = await POST(makeReq());
    expect(await res.json()).toEqual({ ok: true, checked: 1, nudged: 0 });
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it('uses the evening slot and a distinct dedupeKey after the threshold hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T20:00:00.000Z'));

    userFindMany.mockResolvedValueOnce([{ id: 'user-1' }]);
    transactionFindMany.mockResolvedValueOnce([]);

    const { POST } = await import('./route');
    await POST(makeReq());
    const [, input] = createNotificationMock.mock.calls[0]!;
    expect(input.dedupeKey).toBe('inactivity-nudge:user-1:2026-08-28:evening');
  });
});
