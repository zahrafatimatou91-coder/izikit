import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { expireLapsedSubscriptions, sendUpcomingSubscriptionReminders } from './expire';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: unknown) => {
    if (typeof cb === 'function') {
      return (cb as (tx: typeof prismaMock) => unknown)(prismaMock) as Promise<unknown>;
    }
    return Promise.resolve(cb);
  });
});

describe('expireLapsedSubscriptions', () => {
  it('flips a lapsed PRO subscription to FREE and archives surplus', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub1',
        userId: 'u1',
        lastOrderId: null,
        currentPeriodEnd: new Date('2026-08-30T00:00:00.000Z'),
      },
    ] as never);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.envelope.findMany.mockResolvedValue([]);
    prismaMock.savingsGoal.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await expireLapsedSubscriptions({ prisma: prismaMock, now });

    expect(result.expired).toBe(1);
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'sub1', plan: 'PRO' },
      data: { plan: 'FREE' },
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.type).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('skips the notification when the row was renewed concurrently (updateMany count 0)', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub1',
        userId: 'u1',
        lastOrderId: 'o1',
        currentPeriodEnd: new Date('2026-08-30T00:00:00.000Z'),
      },
    ] as never);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 0 }); // raced with a renewal

    const result = await expireLapsedSubscriptions({ prisma: prismaMock, now });

    expect(result.expired).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('returns 0 when there is nothing to expire', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    const result = await expireLapsedSubscriptions({ prisma: prismaMock });
    expect(result.expired).toBe(0);
  });
});

describe('sendUpcomingSubscriptionReminders', () => {
  it('sends the trial-ending reminder with real envelope/goal counts within 2 days of a trial ending', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        userId: 'u1',
        lastOrderId: null,
        currentPeriodEnd: new Date('2026-09-02T12:00:00.000Z'), // ~1.5 days out
      },
    ] as never);
    prismaMock.envelope.count.mockResolvedValue(3);
    prismaMock.savingsGoal.count.mockResolvedValue(1);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await sendUpcomingSubscriptionReminders({ prisma: prismaMock, now });

    expect(result.trialReminded).toBe(1);
    expect(result.renewalReminded).toBe(0);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.type).toBe('SUBSCRIPTION_TRIAL_ENDING');
  });

  it('sends the renewal reminder within 3 days of a PAID subscription ending', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        userId: 'u2',
        lastOrderId: 'o1',
        currentPeriodEnd: new Date('2026-09-03T00:00:00.000Z'), // 2 days out
      },
    ] as never);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await sendUpcomingSubscriptionReminders({ prisma: prismaMock, now });

    expect(result.renewalReminded).toBe(1);
    expect(result.trialReminded).toBe(0);
    const notifArg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(notifArg?.data?.type).toBe('SUBSCRIPTION_RENEWAL_REMINDER');
  });

  it('does not remind a subscription outside the reminder window', async () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    prismaMock.subscription.findMany.mockResolvedValue([
      { userId: 'u3', lastOrderId: 'o1', currentPeriodEnd: new Date('2026-09-20T00:00:00.000Z') },
    ] as never);

    const result = await sendUpcomingSubscriptionReminders({ prisma: prismaMock, now });

    expect(result.trialReminded).toBe(0);
    expect(result.renewalReminded).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});
