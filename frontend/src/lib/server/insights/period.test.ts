import { describe, it, expect } from 'vitest';
import { resolveInsightsPeriod, isInsightsRange } from './period';

// Fri 28 Aug 2026 (confirmed weekday from the app's own screenshots this
// session — used throughout as the fixed "now" for deterministic ranges).
const NOW = new Date(2026, 7, 28, 12, 0, 0);

describe('resolveInsightsPeriod', () => {
  it('this_week: Monday–Sunday of the current ISO week, previous = the week before', () => {
    const p = resolveInsightsPeriod('this_week', NOW);
    expect(p.start.getDay()).toBe(1);
    expect(p.start.toDateString()).toBe(new Date(2026, 7, 24).toDateString());
    expect(p.end.toDateString()).toBe(new Date(2026, 7, 30).toDateString());
    expect(p.previousStart.toDateString()).toBe(new Date(2026, 7, 17).toDateString());
    expect(p.previousEnd.toDateString()).toBe(new Date(2026, 7, 23).toDateString());
  });

  it('this_month: full current calendar month, previous = full prior month', () => {
    const p = resolveInsightsPeriod('this_month', NOW);
    expect(p.start.getDate()).toBe(1);
    expect(p.start.getMonth()).toBe(7); // August
    expect(p.end.getMonth()).toBe(7);
    expect(p.end.getDate()).toBe(31);
    expect(p.previousStart.getMonth()).toBe(6); // July
    expect(p.previousEnd.getMonth()).toBe(6);
  });

  it('last_month: full prior calendar month, previous = the month before that', () => {
    const p = resolveInsightsPeriod('last_month', NOW);
    expect(p.start.getMonth()).toBe(6); // July
    expect(p.end.getMonth()).toBe(6);
    expect(p.previousStart.getMonth()).toBe(5); // June
  });

  it('last_3_months: current month + 2 prior, previous = the 3 months before that', () => {
    const p = resolveInsightsPeriod('last_3_months', NOW);
    expect(p.start.getMonth()).toBe(5); // June
    expect(p.start.getDate()).toBe(1);
    expect(p.end.getMonth()).toBe(7); // August
    expect(p.previousStart.getMonth()).toBe(2); // March
    expect(p.previousEnd.getMonth()).toBe(4); // May
  });

  it('handles year wraparound (January) without crashing', () => {
    const jan = new Date(2026, 0, 15);
    const p = resolveInsightsPeriod('this_month', jan);
    expect(p.previousStart.getFullYear()).toBe(2025);
    expect(p.previousStart.getMonth()).toBe(11); // December
  });
});

describe('isInsightsRange', () => {
  it('accepts the 4 valid presets', () => {
    expect(isInsightsRange('this_week')).toBe(true);
    expect(isInsightsRange('this_month')).toBe(true);
    expect(isInsightsRange('last_month')).toBe(true);
    expect(isInsightsRange('last_3_months')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isInsightsRange('yesterday')).toBe(false);
    expect(isInsightsRange('')).toBe(false);
  });
});
