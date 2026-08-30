import { describe, it, expect } from 'vitest';
import { computeBudgetSummary } from './budget-summary';

describe('computeBudgetSummary', () => {
  it('with no income, available equals the raw totalBudget', () => {
    const s = computeBudgetSummary({ totalBudget: 70_000, income: 0, spent: 54_000, daysLeft: 1 });
    expect(s.available).toBe(70_000);
    expect(s.remaining).toBe(16_000);
  });

  it('regression: income restocks available, so every figure reconciles (reported bug)', () => {
    // Real report: totalBudget 70 000 (hebdomadaire), 54 000 dépensés, and
    // a logged income of 32 000 — the dashboard showed "48 000 restant sur
    // 70 000 au total" with "54 000 dépensés", which doesn't add up
    // (48 000 + 54 000 = 102 000 ≠ 70 000). available must be the figure
    // shown as "au total", not the raw totalBudget.
    const s = computeBudgetSummary({
      totalBudget: 70_000,
      income: 32_000,
      spent: 54_000,
      daysLeft: 1,
    });
    expect(s.available).toBe(102_000);
    expect(s.remaining).toBe(48_000);
    // remaining + spent must always equal available — the invariant the
    // reported bug violated (it compared remaining/spent against the raw
    // totalBudget instead).
    expect(s.remaining + 54_000).toBe(s.available);
    expect(s.pctUsed).toBe(53); // round(54000/102000 * 100)
  });

  it('perDay is remaining spread over the days left in the period', () => {
    const s = computeBudgetSummary({ totalBudget: 70_000, income: 0, spent: 22_000, daysLeft: 4 });
    expect(s.perDay).toBe(Math.round((70_000 - 22_000) / 4));
  });

  it('perDay falls back to 0 when daysLeft is omitted or zero (never a stale/garbage value)', () => {
    expect(computeBudgetSummary({ totalBudget: 50_000, income: 0, spent: 10_000 }).perDay).toBe(0);
    expect(
      computeBudgetSummary({ totalBudget: 50_000, income: 0, spent: 10_000, daysLeft: 0 }).perDay,
    ).toBe(0);
  });

  it('pctUsed is 0 when available is 0 (no divide-by-zero)', () => {
    const s = computeBudgetSummary({ totalBudget: 0, income: 0, spent: 0, daysLeft: 1 });
    expect(s.pctUsed).toBe(0);
  });
});
