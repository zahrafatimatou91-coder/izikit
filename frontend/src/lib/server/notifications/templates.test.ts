import { describe, it, expect } from 'vitest';
import { subscriptionExpiredNotification } from './templates';

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
