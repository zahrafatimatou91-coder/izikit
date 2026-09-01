import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeFireEnvelopeThreshold } from './envelope-threshold';

// The 50% / 80% tiers were removed — this locks in "only fires once the
// envelope is actually over its limit".

function seedEnvelope(monthlyLimit: number) {
  prismaMock.envelope.findUnique.mockResolvedValue({
    id: 'env-1',
    name: 'Café',
    monthlyLimit,
  } as never);
  prismaMock.notificationPreferences.findUnique.mockResolvedValue(null as never);
  prismaMock.user.findUnique.mockResolvedValue({ budgetFrequency: 'monthly' } as never);
  prismaMock.notification.create.mockResolvedValue({} as never);
}

function seedSpend(totalNegativeAmount: number) {
  prismaMock.transaction.aggregate.mockResolvedValue({
    _sum: { amount: totalNegativeAmount },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('maybeFireEnvelopeThreshold', () => {
  it('fires the over-limit notification once spend reaches the limit', async () => {
    seedEnvelope(10_000);
    seedSpend(-10_000);

    await maybeFireEnvelopeThreshold('user-1', 'env-1');

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    const arg = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(arg?.data?.type).toBe('ENVELOPE_THRESHOLD');
    expect(arg?.data?.title).toContain('dépassée');
  });

  it('does NOT fire at 80% of the limit (old tier, now gone)', async () => {
    seedEnvelope(10_000);
    seedSpend(-8_000);

    await maybeFireEnvelopeThreshold('user-1', 'env-1');

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('does nothing when the alert channel is muted', async () => {
    seedEnvelope(10_000);
    seedSpend(-12_000);
    prismaMock.notificationPreferences.findUnique.mockResolvedValue({
      prefs: { ENVELOPE_THRESHOLD: { inApp: false } },
    } as never);

    await maybeFireEnvelopeThreshold('user-1', 'env-1');

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('does nothing for an envelope with no limit set', async () => {
    seedEnvelope(0);
    seedSpend(-5_000);

    await maybeFireEnvelopeThreshold('user-1', 'env-1');

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});
