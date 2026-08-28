import { describe, it, expect } from 'vitest';
import { previousPacePeriod, isPaceCheckDay } from './pace';

describe('previousPacePeriod', () => {
  it('daily: returns yesterday, 00:00–23:59:59.999', () => {
    const now = new Date(2026, 7, 28, 10, 0, 0); // Fri 28 Aug 2026, 10:00
    const { start, end } = previousPacePeriod('daily', now);
    expect(start.toDateString()).toBe(new Date(2026, 7, 27).toDateString());
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('weekly: returns the full ISO week (Mon–Sun) before the current one', () => {
    // 28 Aug 2026 is a Friday; current ISO week starts Mon 24 Aug.
    const now = new Date(2026, 7, 28, 10, 0, 0);
    const { start, end } = previousPacePeriod('weekly', now);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.toDateString()).toBe(new Date(2026, 7, 17).toDateString());
    expect(end.getDay()).toBe(0); // Sunday
    expect(end.toDateString()).toBe(new Date(2026, 7, 23).toDateString());
  });

  it('monthly: returns the full previous calendar month', () => {
    const now = new Date(2026, 7, 28); // Aug 2026
    const { start, end } = previousPacePeriod('monthly', now);
    expect(start.getMonth()).toBe(6); // July
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(6); // still July
    expect(end.getDate()).toBe(31);
  });

  it('monthly: handles January correctly (wraps to previous year)', () => {
    const now = new Date(2026, 0, 15); // Jan 2026
    const { start, end } = previousPacePeriod('monthly', now);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11); // December
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });
});

describe('isPaceCheckDay', () => {
  it('daily pace is checked every day', () => {
    expect(isPaceCheckDay('daily', new Date(2026, 7, 28))).toBe(true);
    expect(isPaceCheckDay('daily', new Date(2026, 7, 24))).toBe(true);
  });

  it('weekly pace is only checked on Monday', () => {
    expect(isPaceCheckDay('weekly', new Date(2026, 7, 24))).toBe(true); // Monday
    expect(isPaceCheckDay('weekly', new Date(2026, 7, 28))).toBe(false); // Friday
  });

  it('monthly pace is only checked on the 1st', () => {
    expect(isPaceCheckDay('monthly', new Date(2026, 7, 1))).toBe(true);
    expect(isPaceCheckDay('monthly', new Date(2026, 7, 15))).toBe(false);
  });
});
