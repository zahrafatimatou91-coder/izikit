import { describe, it, expect } from 'vitest';
import {
  resolveInsightsPeriod,
  isInsightsRange,
  parseDateOnly,
  resolveCustomInsightsPeriod,
} from './period';

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

describe('parseDateOnly', () => {
  it('parses a valid YYYY-MM-DD string into a local midnight Date', () => {
    const d = parseDateOnly('2026-08-28');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7); // August
    expect(d?.getDate()).toBe(28);
  });

  it('rejects malformed input', () => {
    expect(parseDateOnly('28-08-2026')).toBeNull();
    expect(parseDateOnly('2026/08/28')).toBeNull();
    expect(parseDateOnly('not-a-date')).toBeNull();
    expect(parseDateOnly('')).toBeNull();
  });

  it('rejects a calendar overflow instead of silently rolling into the next month', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
  });
});

describe('resolveCustomInsightsPeriod', () => {
  it('a single day: previous period is the single day immediately before', () => {
    const day = new Date(2026, 7, 28);
    const p = resolveCustomInsightsPeriod(day, day);
    expect(p).not.toBeNull();
    expect(p?.start.toDateString()).toBe(new Date(2026, 7, 28).toDateString());
    expect(p?.previousStart.toDateString()).toBe(new Date(2026, 7, 27).toDateString());
    expect(p?.previousEnd.toDateString()).toBe(new Date(2026, 7, 27).toDateString());
  });

  it('a 7-day range: previous period is the 7 days immediately before', () => {
    const from = new Date(2026, 7, 1);
    const to = new Date(2026, 7, 7);
    const p = resolveCustomInsightsPeriod(from, to);
    expect(p).not.toBeNull();
    expect(p?.previousStart.toDateString()).toBe(new Date(2026, 6, 25).toDateString());
    expect(p?.previousEnd.toDateString()).toBe(new Date(2026, 6, 31).toDateString());
  });

  it('resolves `end` to end-of-day so same-day transactions are included', () => {
    const day = new Date(2026, 7, 28);
    const p = resolveCustomInsightsPeriod(day, day);
    expect(p?.end.getHours()).toBe(23);
    expect(p?.end.getMinutes()).toBe(59);
  });

  it('builds a French date-range label', () => {
    const p = resolveCustomInsightsPeriod(new Date(2026, 0, 3), new Date(2026, 2, 15));
    expect(p?.label).toBe('3 janvier 2026 – 15 mars 2026');
  });

  it('rejects a range where `to` is before `from`', () => {
    const p = resolveCustomInsightsPeriod(new Date(2026, 7, 28), new Date(2026, 7, 1));
    expect(p).toBeNull();
  });

  it('rejects a pathologically wide range (> ~3 years)', () => {
    const p = resolveCustomInsightsPeriod(new Date(2000, 0, 1), new Date(2026, 7, 28));
    expect(p).toBeNull();
  });

  it('handles year wraparound for the previous period without crashing', () => {
    const p = resolveCustomInsightsPeriod(new Date(2026, 0, 1), new Date(2026, 0, 5));
    expect(p).not.toBeNull();
    expect(p?.previousStart.getFullYear()).toBe(2025);
    expect(p?.previousStart.getMonth()).toBe(11); // December
  });
});
