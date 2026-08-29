import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_PRICES, getDailyEquivalentFcfa } from './subscription-plans';

describe('SUBSCRIPTION_PRICES', () => {
  it('matches the spec prices', () => {
    expect(SUBSCRIPTION_PRICES.monthly).toBe(1500);
    expect(SUBSCRIPTION_PRICES.annual).toBe(13500);
  });
});

describe('getDailyEquivalentFcfa', () => {
  it('rounds 13 500/365 to 37', () => {
    expect(getDailyEquivalentFcfa(13500)).toBe(37);
  });
});
