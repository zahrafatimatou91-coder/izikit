import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test-utils/prisma-mock';
import { sendTrialEndingReminders } from './trial-reminder';

const NOW = new Date('2026-09-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function subRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sub1',
    userId: 'u1',
    currentPeriodEnd: new Date(NOW.getTime() + 2 * DAY_MS), // 2 days out — within the 3-day trial window
    renewalReminderSentForPeriodEnd: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', email: 'u1@example.com' }] as never);
  prismaMock.notificationPreferences.findMany.mockResolvedValue([]);
  prismaMock.envelope.count.mockResolvedValue(4);
  prismaMock.savingsGoal.count.mockResolvedValue(2);
  prismaMock.subscription.update.mockResolvedValue({} as never);
});

describe('sendTrialEndingReminders', () => {
  it('skips entirely (no query) when the email queue is not configured', async () => {
    const result = await sendTrialEndingReminders({
      prisma: prismaMock,
      emailQueue: null,
      now: NOW,
    });
    expect(result).toEqual({ checked: 0, reminded: 0 });
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });

  it('queries only trial (lastOrderId null), active PRO subscriptions', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    const emailQueue = { enqueue: vi.fn() };
    await sendTrialEndingReminders({ prisma: prismaMock, emailQueue, now: NOW });
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plan: 'PRO',
          status: 'ACTIVE',
          lastOrderId: null,
        }),
      }),
    );
  });

  it('emails a trial 2 days from expiry (within the 3-day urgent window), personalized, and marks it sent', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subRow()] as never);
    const enqueue = vi.fn().mockResolvedValue('job1');
    const result = await sendTrialEndingReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });

    expect(result).toEqual({ checked: 1, reminded: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    const call = enqueue.mock.calls[0]?.[0];
    expect(call.to).toBe('u1@example.com');
    expect(call.subject).toMatch(/se termine dans 2 jours/);
    // html is HTML-escaped (apostrophe -> &#39;).
    expect(call.html).toContain('4 enveloppes et 2 objectifs d&#39;épargne');
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub1' },
      data: { renewalReminderSentForPeriodEnd: subRow().currentPeriodEnd },
    });
  });

  it('does not remind a trial more than 3 days from expiry', async () => {
    const sub = subRow({ currentPeriodEnd: new Date(NOW.getTime() + 5 * DAY_MS) });
    prismaMock.subscription.findMany.mockResolvedValue([sub] as never);
    const enqueue = vi.fn();
    const result = await sendTrialEndingReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    expect(result).toEqual({ checked: 1, reminded: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not remind twice for the same currentPeriodEnd', async () => {
    const periodEnd = new Date(NOW.getTime() + 2 * DAY_MS);
    const sub = subRow({ currentPeriodEnd: periodEnd, renewalReminderSentForPeriodEnd: periodEnd });
    prismaMock.subscription.findMany.mockResolvedValue([sub] as never);
    const enqueue = vi.fn();
    const result = await sendTrialEndingReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    expect(result).toEqual({ checked: 1, reminded: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('respects the SUBSCRIPTION_TRIAL_ENDING email opt-out', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([subRow()] as never);
    prismaMock.notificationPreferences.findMany.mockResolvedValue([
      { userId: 'u1', prefs: { SUBSCRIPTION_TRIAL_ENDING: { email: false } } },
    ] as never);
    const enqueue = vi.fn();
    const result = await sendTrialEndingReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });
    expect(result.reminded).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('falls back to the generic phrasing when the trial user has no envelopes/goals yet', async () => {
    prismaMock.envelope.count.mockResolvedValue(0);
    prismaMock.savingsGoal.count.mockResolvedValue(0);
    prismaMock.subscription.findMany.mockResolvedValue([subRow()] as never);
    const enqueue = vi.fn().mockResolvedValue('job1');
    await sendTrialEndingReminders({ prisma: prismaMock, emailQueue: { enqueue }, now: NOW });
    const call = enqueue.mock.calls[0]?.[0];
    expect(call.html).toContain('tes fonctionnalités Pro');
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

    const result = await sendTrialEndingReminders({
      prisma: prismaMock,
      emailQueue: { enqueue },
      now: NOW,
    });

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ checked: 2, reminded: 1 });
  });
});
