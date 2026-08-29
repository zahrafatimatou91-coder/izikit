import { describe, it, expect } from 'vitest';
import {
  subscriptionTrialEndingNotification,
  subscriptionRenewalReminderNotification,
  subscriptionExpiredNotification,
} from './templates';

describe('subscriptionTrialEndingNotification', () => {
  it('mentions the real envelope and goal counts', () => {
    const end = new Date('2026-09-05T00:00:00.000Z');
    const n = subscriptionTrialEndingNotification('u1', {
      currentPeriodEnd: end,
      envelopeCount: 4,
      goalCount: 2,
    });
    expect(n.type).toBe('SUBSCRIPTION_TRIAL_ENDING');
    expect(n.body).toContain('4 enveloppes');
    expect(n.body).toContain("2 objectifs d'épargne");
    expect(n.dedupeKey).toBe(`subscription-trial-ending:u1:${end.toISOString()}`);
  });

  it('omits a count clause when both counts are 0', () => {
    const end = new Date('2026-09-05T00:00:00.000Z');
    const n = subscriptionTrialEndingNotification('u1', {
      currentPeriodEnd: end,
      envelopeCount: 0,
      goalCount: 0,
    });
    expect(n.body).not.toContain('actifs :');
  });
});

describe('subscriptionRenewalReminderNotification', () => {
  it('has a deterministic dedupeKey scoped to the period end', () => {
    const end = new Date('2026-10-01T00:00:00.000Z');
    const n = subscriptionRenewalReminderNotification('u1', { currentPeriodEnd: end });
    expect(n.type).toBe('SUBSCRIPTION_RENEWAL_REMINDER');
    expect(n.dedupeKey).toBe(`subscription-renewal-reminder:u1:${end.toISOString()}`);
  });
});

describe('subscriptionExpiredNotification', () => {
  it('uses trial-specific copy when wasTrial is true', () => {
    const end = new Date('2026-09-07T00:00:00.000Z');
    const n = subscriptionExpiredNotification('u1', { wasTrial: true, currentPeriodEnd: end });
    expect(n.title).toContain('essai');
    expect(n.body).not.toContain('garder tes données');
  });

  it('uses paid-lapse copy when wasTrial is false', () => {
    const end = new Date('2026-09-07T00:00:00.000Z');
    const n = subscriptionExpiredNotification('u1', { wasTrial: false, currentPeriodEnd: end });
    expect(n.title).toContain('abonnement');
  });

  it('dedupeKey is scoped to the period that lapsed, not to execution time', () => {
    const end = new Date('2026-09-07T00:00:00.000Z');
    const n = subscriptionExpiredNotification('u1', { wasTrial: true, currentPeriodEnd: end });
    expect(n.dedupeKey).toBe(`subscription-expired:u1:${end.toISOString()}`);
  });
});
