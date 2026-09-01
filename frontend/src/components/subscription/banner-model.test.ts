import { describe, it, expect } from 'vitest';
import { computeModel } from './banner-model';

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
  it('Free with no history → dismissible upsell (regression: used to render nothing)', () => {
    expect(computeModel(sub())).toMatchObject({ kind: 'free-upsell' });
  });

  it('Free with a past period end → lapsed banner', () => {
    expect(computeModel(sub({ currentPeriodEnd: inDays(-2) }))).toMatchObject({
      kind: 'free-lapsed',
    });
  });

  it('trial with plenty of time → calm, dismissible', () => {
    const m = computeModel(sub({ plan: 'PRO', isTrial: true, currentPeriodEnd: inDays(6) }));
    expect(m).toMatchObject({ kind: 'trial-calm' });
    expect(m && 'dismissKey' in m).toBe(true);
  });

  it('trial in the final stretch → urgent, not dismissible', () => {
    const m = computeModel(sub({ plan: 'PRO', isTrial: true, currentPeriodEnd: inDays(2) }));
    expect(m).toMatchObject({ kind: 'trial-urgent' });
    expect(m && 'dismissKey' in m).toBe(false);
  });

  it('paid Pro with weeks left → no banner', () => {
    expect(computeModel(sub({ plan: 'PRO', currentPeriodEnd: inDays(40) }))).toBeNull();
  });

  it('paid Pro within a week of expiry → renewal banner', () => {
    expect(computeModel(sub({ plan: 'PRO', currentPeriodEnd: inDays(4) }))).toMatchObject({
      kind: 'renewal-urgent',
    });
  });
});
