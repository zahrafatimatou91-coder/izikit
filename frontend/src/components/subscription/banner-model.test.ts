import { describe, it, expect } from 'vitest';
import {
  computeModel,
  isDismissed,
  dismissValue,
  CONVERSION_SNOOZE_HOURS,
  type Dismissible,
} from './banner-model';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

function sub(over: Partial<Parameters<typeof computeModel>[0]> = {}) {
  return {
    plan: 'FREE' as const,
    status: 'ACTIVE',
    currentPeriodEnd: null as string | null,
    isTrial: false,
    ...over,
  };
}

describe('computeModel', () => {
  it('Free with no history → dismissible upsell that snoozes (not a permanent hide)', () => {
    const m = computeModel(sub());
    expect(m).toMatchObject({ kind: 'free-upsell' });
    expect(m && 'dismiss' in m && m.dismiss.snoozeHours).toBe(CONVERSION_SNOOZE_HOURS);
  });

  it('Free with a past period end → lapsed banner, also snoozed', () => {
    const m = computeModel(sub({ currentPeriodEnd: inDays(-2) }));
    expect(m).toMatchObject({ kind: 'free-lapsed' });
    expect(m && 'dismiss' in m && m.dismiss.snoozeHours).toBe(CONVERSION_SNOOZE_HOURS);
  });

  it('trial with plenty of time → calm, dismissible for the period (no snooze)', () => {
    const m = computeModel(sub({ plan: 'PRO', isTrial: true, currentPeriodEnd: inDays(6) }));
    expect(m).toMatchObject({ kind: 'trial-calm' });
    expect(m && 'dismiss' in m).toBe(true);
    expect(m && 'dismiss' in m && m.dismiss.snoozeHours).toBeUndefined();
  });

  it('trial in the final stretch → urgent, not dismissible', () => {
    const m = computeModel(sub({ plan: 'PRO', isTrial: true, currentPeriodEnd: inDays(2) }));
    expect(m).toMatchObject({ kind: 'trial-urgent' });
    expect(m && 'dismiss' in m).toBe(false);
  });

  it('paid Pro with weeks left → no banner', () => {
    expect(computeModel(sub({ plan: 'PRO', currentPeriodEnd: inDays(40) }))).toBeNull();
  });

  it('paid Pro within a week of expiry → renewal banner, not dismissible', () => {
    const m = computeModel(sub({ plan: 'PRO', currentPeriodEnd: inDays(4) }));
    expect(m).toMatchObject({ kind: 'renewal-urgent' });
    expect(m && 'dismiss' in m).toBe(false);
  });
});

describe('isDismissed', () => {
  const snooze: Dismissible = { key: 'k', snoozeHours: 24 };
  const sticky: Dismissible = { key: 'k' };
  const now = 1_000_000_000_000;

  it('nothing stored → not dismissed', () => {
    expect(isDismissed(snooze, null, now)).toBe(false);
    expect(isDismissed(sticky, null, now)).toBe(false);
  });

  it('sticky: only "1" counts as dismissed', () => {
    expect(isDismissed(sticky, '1', now)).toBe(true);
    expect(isDismissed(sticky, '123', now)).toBe(false);
  });

  it('snooze: a fresh timestamp hides it, an old one lets it back', () => {
    const justNow = String(now - 60 * 60 * 1000); // 1h ago
    const yesterday = String(now - 25 * 60 * 60 * 1000); // 25h ago
    expect(isDismissed(snooze, justNow, now)).toBe(true);
    expect(isDismissed(snooze, yesterday, now)).toBe(false);
  });

  it('snooze: garbage value is treated as not dismissed', () => {
    expect(isDismissed(snooze, 'nope', now)).toBe(false);
  });

  it('dismissValue matches what isDismissed expects', () => {
    expect(isDismissed(snooze, dismissValue(snooze, now), now)).toBe(true);
    expect(isDismissed(sticky, dismissValue(sticky, now), now)).toBe(true);
  });
});
