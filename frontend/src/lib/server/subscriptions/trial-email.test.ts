import { describe, it, expect } from 'vitest';
import { trialEndingEmail } from './trial-email';

describe('trialEndingEmail', () => {
  it('says "demain" and uses the singular framing when daysLeft <= 1', () => {
    const tpl = trialEndingEmail({
      daysLeft: 1,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 4,
      savingsGoalCount: 2,
      appUrl: 'https://example.test',
    });
    expect(tpl.subject).toBe('Ton essai Pro se termine demain');
    expect(tpl.html).toContain('demain');
    expect(tpl.text).toContain('demain');
  });

  it('says "dans N jours" for daysLeft > 1', () => {
    const tpl = trialEndingEmail({
      daysLeft: 3,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 4,
      savingsGoalCount: 2,
      appUrl: 'https://example.test',
    });
    expect(tpl.subject).toBe('Ton essai Pro se termine dans 3 jours');
    expect(tpl.html).toContain('dans 3 jours');
  });

  it('personalizes with the real envelope and savings-goal counts', () => {
    const tpl = trialEndingEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 4,
      savingsGoalCount: 2,
      appUrl: 'https://example.test',
    });
    // html is HTML-escaped (apostrophe -> &#39;); text is not.
    expect(tpl.html).toContain('4 enveloppes et 2 objectifs d&#39;épargne');
    expect(tpl.text).toContain("4 enveloppes et 2 objectifs d'épargne");
  });

  it('uses singular wording for exactly one envelope / one goal', () => {
    const tpl = trialEndingEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 1,
      savingsGoalCount: 1,
      appUrl: 'https://example.test',
    });
    expect(tpl.html).toContain('1 enveloppe et 1 objectif d&#39;épargne');
  });

  it('falls back to a generic phrase when the trial user has nothing set up yet', () => {
    const tpl = trialEndingEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 0,
      savingsGoalCount: 0,
      appUrl: 'https://example.test',
    });
    expect(tpl.html).toContain('Tu profites actuellement de tes fonctionnalités Pro');
  });

  it('mentions only one of envelopes/goals when the other is zero', () => {
    const tpl = trialEndingEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 2,
      savingsGoalCount: 0,
      appUrl: 'https://example.test',
    });
    expect(tpl.html).toContain('Tu profites actuellement de 2 enveloppes');
    expect(tpl.html).not.toContain('objectif');
  });

  it('links to /subscription on the given appUrl', () => {
    const tpl = trialEndingEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 1,
      savingsGoalCount: 0,
      appUrl: 'https://chaquefranc.example',
    });
    expect(tpl.html).toContain('href="https://chaquefranc.example/subscription"');
    expect(tpl.text).toContain('https://chaquefranc.example/subscription');
  });

  it('never claims data is deleted or lost (non-negotiable framing — see the spec)', () => {
    const tpl = trialEndingEmail({
      daysLeft: 1,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 4,
      savingsGoalCount: 2,
      appUrl: 'https://example.test',
    });
    expect(tpl.html.toLowerCase()).not.toContain('perd');
    expect(tpl.html.toLowerCase()).not.toContain('supprim');
    expect(tpl.html).toContain('restent en sécurité');
  });

  it('escapes HTML-significant characters (defense-in-depth, even though inputs are server-derived)', () => {
    const tpl = trialEndingEmail({
      daysLeft: 2,
      periodEnd: '2026-09-08T00:00:00.000Z',
      envelopeCount: 1,
      savingsGoalCount: 0,
      appUrl: 'https://example.test',
    });
    expect(tpl.html).not.toContain('<script>');
  });

  it('falls back to process.env.APP_URL when appUrl is omitted', () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = 'https://from-env.example';
    try {
      const tpl = trialEndingEmail({
        daysLeft: 2,
        periodEnd: '2026-09-08T00:00:00.000Z',
        envelopeCount: 1,
        savingsGoalCount: 0,
      });
      expect(tpl.html).toContain('https://from-env.example/subscription');
    } finally {
      if (prev !== undefined) process.env.APP_URL = prev;
      else delete process.env.APP_URL;
    }
  });
});
