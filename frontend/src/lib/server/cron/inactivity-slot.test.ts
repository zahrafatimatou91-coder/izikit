import { describe, it, expect } from 'vitest';
import { resolveInactivitySlot } from './inactivity-slot';

describe('resolveInactivitySlot', () => {
  it('resolves to midday before the evening threshold (13:00 UTC scheduled fire)', () => {
    expect(resolveInactivitySlot(new Date('2026-08-28T13:00:00.000Z'))).toBe('midday');
  });

  it('resolves to evening at/after the threshold (20:00 UTC scheduled fire)', () => {
    expect(resolveInactivitySlot(new Date('2026-08-28T20:00:00.000Z'))).toBe('evening');
  });

  it('stays correct a few minutes late (Vercel cron jitter)', () => {
    expect(resolveInactivitySlot(new Date('2026-08-28T13:07:00.000Z'))).toBe('midday');
    expect(resolveInactivitySlot(new Date('2026-08-28T20:04:00.000Z'))).toBe('evening');
  });

  it('is exactly midday at the threshold hour boundary', () => {
    expect(resolveInactivitySlot(new Date('2026-08-28T16:59:00.000Z'))).toBe('midday');
    expect(resolveInactivitySlot(new Date('2026-08-28T17:00:00.000Z'))).toBe('evening');
  });
});
