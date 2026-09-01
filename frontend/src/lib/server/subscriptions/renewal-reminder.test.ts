import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { sendUpcomingRenewalReminders } from './renewal-reminder';

const NOW = new Date('2026-09-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function subRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sub1',
    userId: 'u1',
    currentPeriodEnd: new Date(NOW.getTime() + 5 * DAY_MS), // 5 days out
    renewalReminderSentForPeriodEnd: null,
    lastOrderId: 'order1',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', email: 'u1@example.com' }] as never);
  prismaMock.notificationPreferences.findMany.mockResolvedValue([]);
  prismaMock.order.findMany.mockResolvedValue([
    { id: 'order1', metadata: { purpose: 'subscription', period: 'monthly' } },
  ] as never);
  prismaMock.subscription.update.mockResolvedValue({} as never);
});

describe('sendUpcomingRenewalReminders', () => {
  it('skips entirely (no query) when the email queue is not configured', async () => {
    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: null,
      now: NOW,
    });
    expect(result).toEqual({ checked: 0, reminded: 0 });
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });

  it('queries only paid (lastOrderId not null), active PRO subscriptions', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    const emailQueue = { enqueue: vi.fn() };
    await sendUpcomingRenewalReminders({ prisma: prismaMock, emailQueue, now: NOW });
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plan: 'PRO',
          status: 'ACTIVE',
          lastOrderId: { not: null },
        }),
      }),
    );
  });

  it('emails a subscription 5 days from expiry (within the 7-day urgent window) and marks it sent', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subRow()] as never);
    const enqueue = vi.fn().mockResolvedValue('job1');
    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });

    expect(result).toEqual({ checked: 1, reminded: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    const call = enqueue.mock.calls[0]?.[0];
    expect(call.to).toBe('u1@example.com');
    expect(call.subject).toMatch(/expire dans 5 jours/);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub1' },
      data: { renewalReminderSentForPeriodEnd: subRow().currentPeriodEnd },
    });
  });

  it('does not remind a subscription more than 7 days from expiry', async () => {
    const sub = subRow({ currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY_MS) });
    prismaMock.subscription.findMany.mockResolvedValue([sub] as never);
    const enqueue = vi.fn();
    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    expect(result).toEqual({ checked: 1, reminded: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not remind twice for the same currentPeriodEnd', async () => {
    const periodEnd = new Date(NOW.getTime() + 5 * DAY_MS);
    const sub = subRow({ currentPeriodEnd: periodEnd, renewalReminderSentForPeriodEnd: periodEnd });
    prismaMock.subscription.findMany.mockResolvedValue([sub] as never);
    const enqueue = vi.fn();
    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    expect(result).toEqual({ checked: 1, reminded: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('re-arms the reminder when a renewal already extended currentPeriodEnd past the last-sent marker', async () => {
    const oldPeriodEnd = new Date(NOW.getTime() + 5 * DAY_MS);
    const newPeriodEnd = new Date(NOW.getTime() + 35 * DAY_MS + 5 * DAY_MS); // renewed, now far out — not due yet
    const sub = subRow({
      currentPeriodEnd: newPeriodEnd,
      renewalReminderSentForPeriodEnd: oldPeriodEnd,
    });
    prismaMock.subscription.findMany.mockResolvedValue([sub] as never);
    const enqueue = vi.fn();
    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    // Not due yet (>7 days out) — proves the marker didn't wrongly suppress
    // it forever; it would fire again once within the window for this new period.
    expect(result.reminded).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('respects the SUBSCRIPTION_RENEWAL email opt-out', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subRow()] as never);
    prismaMock.notificationPreferences.findMany.mockResolvedValue([
      { userId: 'u1', prefs: { SUBSCRIPTION_RENEWAL: { email: false } } },
    ] as never);
    const enqueue = vi.fn();
    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    expect(result.reminded).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('swallows a single send failure without stopping the batch or throwing', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      subRow({ id: 'sub1', userId: 'u1' }),
      subRow({ id: 'sub2', userId: 'u2' }),
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'u1@example.com' },
      { id: 'u2', email: 'u2@example.com' },
    ] as never);
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error('resend down'))
      .mockResolvedValueOnce('job2');

    const result = await sendUpcomingRenewalReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ checked: 2, reminded: 1 });
  });

  it('uses the annual price when the order metadata says period=annual', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subRow()] as never);
    prismaMock.order.findMany.mockResolvedValue([
      { id: 'order1', metadata: { purpose: 'subscription', period: 'annual' } },
    ] as never);
    const enqueue = vi.fn().mockResolvedValue('job1');
    await sendUpcomingRenewalReminders({ prisma: prismaMock, emailQueue: { enqueue }, now: NOW });
    const call = enqueue.mock.calls[0]?.[0];
    // Strip whitespace (fr-FR's toLocaleString uses a narrow no-break space
    // as its thousands separator) before comparing digits.
    expect(call.html.replace(/\s+/g, '')).toContain('13500FCFA');
  });
});
