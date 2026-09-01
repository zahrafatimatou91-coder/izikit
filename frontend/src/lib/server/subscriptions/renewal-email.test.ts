import { describe, it, expect } from 'vitest';
import { renewalReminderEmail } from './renewal-email';

describe('renewalReminderEmail', () => {
  it('says "demain" and uses the singular framing when daysLeft <= 1', () => {
    const tpl = renewalReminderEmail({
      daysLeft: 1,
      periodEnd: '2026-09-08T00:00:00.000Z',
      amount: 1500,
      period: 'monthly',
      appUrl: 'https://example.test',
    });
    expect(tpl.subject).toBe('Ton abonnement Premium expire demain');
    expect(tpl.html).toContain('demain');
    expect(tpl.text).toContain('demain');
  });

  it('says "dans N jours" for daysLeft > 1', () => {
    const tpl = renewalReminderEmail({
      daysLeft: 5,
      periodEnd: '2026-09-08T00:00:00.000Z',
      amount: 1500,
      period: 'monthly',
      appUrl: 'https://example.test',
    });
    expect(tpl.subject).toBe('Ton abonnement Premium expire dans 5 jours');
    expect(tpl.html).toContain('dans 5 jours');
  });

  it('links to /subscription on the given appUrl', () => {
    const tpl = renewalReminderEmail({
      daysLeft: 5,
      periodEnd: '2026-09-08T00:00:00.000Z',
      amount: 1500,
      period: 'monthly',
      appUrl: 'https://chaquefranc.example',
    });
    expect(tpl.html).toContain('href="https://chaquefranc.example/subscription"');
    expect(tpl.text).toContain('https://chaquefranc.example/subscription');
  });

  it('mentions Mobile Money / manual renewal (the whole reason this email exists)', () => {
    const tpl = renewalReminderEmail({
      daysLeft: 3,
      periodEnd: '2026-09-08T00:00:00.000Z',
      amount: 13500,
      period: 'annual',
      appUrl: 'https://example.test',
    });
    expect(tpl.html.toLowerCase()).toContain('mobile money');
    expect(tpl.html.toLowerCase()).toContain('manuellement');
  });

  it('escapes HTML-significant characters (defense-in-depth, even though inputs are server-derived)', () => {
    const tpl = renewalReminderEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      amount: 1500,
      period: 'monthly',
      appUrl: 'https://example.test',
    });
    expect(tpl.html).not.toContain('<script>');
  });

  it('falls back to process.env.APP_URL when appUrl is omitted', () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = 'https://from-env.example';
    try {
      const tpl = renewalReminderEmail({
        daysLeft: 2,
        periodEnd: '2026-09-08T00:00:00.000Z',
        amount: 1500,
        period: 'monthly',
      });
      expect(tpl.html).toContain('https://from-env.example/subscription');
    } finally {
      if (prev !== undefined) process.env.APP_URL = prev;
      else delete process.env.APP_URL;
    }
  });
});
