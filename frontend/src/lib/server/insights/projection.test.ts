import { describe, it, expect } from 'vitest';
import { projectGoalCompletion } from './projection';

const NOW = new Date(2026, 7, 28);

describe('projectGoalCompletion', () => {
  it('returns no projection with fewer than 2 entries', () => {
    const p = projectGoalCompletion(
      [{ amount: 500, createdAt: new Date(2026, 7, 20) }],
      5000,
      500,
      NOW,
    );
    expect(p.ratePerDay).toBeNull();
    expect(p.projectedDate).toBeNull();
  });

  it('returns no projection when the goal is already completed', () => {
    const entries = [
      { amount: 500, createdAt: new Date(2026, 7, 10) },
      { amount: 600, createdAt: new Date(2026, 7, 20) },
    ];
    const p = projectGoalCompletion(entries, 1000, 1100, NOW);
    expect(p.projectedDate).toBeNull();
  });

  it('computes a rate and a future date for a steady saver', () => {
    // 200 F saved every 10 days → 20 F/day. Remaining 800 F → 40 days.
    const entries = [
      { amount: 200, createdAt: new Date(2026, 7, 8) },
      { amount: 200, createdAt: new Date(2026, 7, 18) },
    ];
    const p = projectGoalCompletion(entries, 1200, 400, NOW);
    expect(p.ratePerDay).toBeCloseTo(40, 0); // 400 F over 10 days = 40 F/day
    expect(p.projectedDate).not.toBeNull();
    const daysUntil = Math.round((p.projectedDate!.getTime() - NOW.getTime()) / 86_400_000);
    expect(daysUntil).toBeGreaterThan(0);
  });

  it('handles entries given out of chronological order', () => {
    const entries = [
      { amount: 100, createdAt: new Date(2026, 7, 20) },
      { amount: 100, createdAt: new Date(2026, 7, 10) },
    ];
    const p = projectGoalCompletion(entries, 1000, 200, NOW);
    expect(p.ratePerDay).toBeCloseTo(20, 0); // 200 F over 10 days
  });

  it('returns no projected date when the computed rate is zero or negative', () => {
    // Same-day entries collapse the span to the 1-day floor but amounts
    // could still be non-positive in a pathological case (defensive).
    const entries = [
      { amount: 0, createdAt: new Date(2026, 7, 10) },
      { amount: 0, createdAt: new Date(2026, 7, 20) },
    ];
    const p = projectGoalCompletion(entries, 1000, 0, NOW);
    expect(p.ratePerDay).toBe(0);
    expect(p.projectedDate).toBeNull();
  });
});
