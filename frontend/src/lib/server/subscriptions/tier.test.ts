import { describe, it, expect } from 'vitest';
import {
  getEffectivePlan,
  isTrial,
  getHistoryFloor,
  FREE_MAX_ENVELOPES,
  FREE_MAX_SAVINGS_GOALS,
  SUBSCRIPTION_TRIAL_DAYS,
  SUBSCRIPTION_PERIOD_DAYS,
  parseSubscriptionOrderMetadata,
} from './tier';

describe('getEffectivePlan', () => {
  it('returns FREE when there is no subscription row', () => {
    expect(getEffectivePlan(null)).toBe('FREE');
  });

  it('returns FREE when plan is FREE', () => {
    expect(getEffectivePlan({ plan: 'FREE', currentPeriodEnd: null })).toBe('FREE');
  });

  it('returns FREE for the unused PLUS tier (defensive default)', () => {
    expect(getEffectivePlan({ plan: 'PLUS', currentPeriodEnd: null })).toBe('FREE');
  });

  it('returns PRO when plan is PRO and currentPeriodEnd is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(getEffectivePlan({ plan: 'PRO', currentPeriodEnd: future })).toBe('PRO');
  });

  it('returns FREE when plan is PRO but currentPeriodEnd has passed', () => {
    const past = new Date(Date.now() - 60_000);
    expect(getEffectivePlan({ plan: 'PRO', currentPeriodEnd: past })).toBe('FREE');
  });

  it('returns PRO when plan is PRO and currentPeriodEnd is null (defensive — no expiry set)', () => {
    expect(getEffectivePlan({ plan: 'PRO', currentPeriodEnd: null })).toBe('PRO');
  });
});

describe('isTrial', () => {
  it('is true for an active PRO subscription with no lastOrderId', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTrial({ plan: 'PRO', currentPeriodEnd: future, lastOrderId: null })).toBe(true);
  });

  it('is false once a real order has paid for the period', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isTrial({ plan: 'PRO', currentPeriodEnd: future, lastOrderId: 'order-1' })).toBe(false);
  });

  it('is false for a lapsed trial (effective plan is FREE)', () => {
    const past = new Date(Date.now() - 60_000);
    expect(isTrial({ plan: 'PRO', currentPeriodEnd: past, lastOrderId: null })).toBe(false);
  });
});

describe('getHistoryFloor', () => {
  it('returns null (no floor) for PRO', () => {
    expect(getHistoryFloor('PRO')).toBeNull();
  });

  it('returns the first instant of the previous calendar month for FREE', () => {
    const now = new Date(Date.UTC(2026, 8, 29)); // 2026-09-29
    const floor = getHistoryFloor('FREE', now);
    expect(floor?.toISOString()).toBe(new Date(Date.UTC(2026, 7, 1)).toISOString()); // 2026-08-01
  });

  it('handles the January edge case (rolls back to previous December)', () => {
    const now = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15
    const floor = getHistoryFloor('FREE', now);
    expect(floor?.toISOString()).toBe(new Date(Date.UTC(2025, 11, 1)).toISOString()); // 2025-12-01
  });
});

describe('tier constants', () => {
  it('match the spec', () => {
    expect(FREE_MAX_ENVELOPES).toBe(2);
    expect(FREE_MAX_SAVINGS_GOALS).toBe(0);
  });
});

describe('SUBSCRIPTION_TRIAL_DAYS / SUBSCRIPTION_PERIOD_DAYS', () => {
  it('trial is 7 days', () => {
    expect(SUBSCRIPTION_TRIAL_DAYS).toBe(7);
  });

  it('monthly is 30 days, annual is 365 days', () => {
    expect(SUBSCRIPTION_PERIOD_DAYS.monthly).toBe(30);
    expect(SUBSCRIPTION_PERIOD_DAYS.annual).toBe(365);
  });
});

describe('parseSubscriptionOrderMetadata', () => {
  it('returns null for null/non-object metadata', () => {
    expect(parseSubscriptionOrderMetadata(null)).toBeNull();
    expect(parseSubscriptionOrderMetadata('subscription')).toBeNull();
  });

  it('returns null when purpose is not "subscription"', () => {
    expect(parseSubscriptionOrderMetadata({ purpose: 'donation', period: 'monthly' })).toBeNull();
  });

  it('returns null when period is missing or invalid', () => {
    expect(parseSubscriptionOrderMetadata({ purpose: 'subscription' })).toBeNull();
    expect(
      parseSubscriptionOrderMetadata({ purpose: 'subscription', period: 'weekly' }),
    ).toBeNull();
  });

  it('parses a valid subscription metadata object', () => {
    expect(parseSubscriptionOrderMetadata({ purpose: 'subscription', period: 'annual' })).toEqual({
      purpose: 'subscription',
      period: 'annual',
    });
  });
});
