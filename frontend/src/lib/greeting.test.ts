import { describe, it, expect } from 'vitest';
import { firstName, timeOfDayGreeting, timeOfDayEmoji, dailyTagline } from './greeting';

// Constructed via the local Date constructor (not an ISO/UTC string) so
// .getHours() returns exactly the hour we ask for, regardless of the
// machine/CI runner's timezone.
function at(hour: number, day = 15): Date {
  return new Date(2026, 7, day, hour, 0, 0);
}

describe('firstName', () => {
  it('returns the first token of a full name', () => {
    expect(firstName('Fatima Ahmat')).toBe('Fatima');
  });

  it('returns the whole string when already a single word', () => {
    expect(firstName('Momo')).toBe('Momo');
  });

  it('trims surrounding whitespace before splitting', () => {
    expect(firstName('  Awa Diop  ')).toBe('Awa');
  });
});

describe('timeOfDayGreeting', () => {
  it('says Bonjour in the morning (5h-11h59)', () => {
    expect(timeOfDayGreeting(at(5))).toBe('Bonjour');
    expect(timeOfDayGreeting(at(11))).toBe('Bonjour');
  });

  it('says Bon après-midi in the afternoon (12h-17h59)', () => {
    expect(timeOfDayGreeting(at(12))).toBe('Bon après-midi');
    expect(timeOfDayGreeting(at(17))).toBe('Bon après-midi');
  });

  it('says Bonsoir in the evening (18h-22h59)', () => {
    expect(timeOfDayGreeting(at(18))).toBe('Bonsoir');
    expect(timeOfDayGreeting(at(22))).toBe('Bonsoir');
  });

  it('switches to the night-owl phrase from 23h to 4h59 — never "Bonsoir" at 3am', () => {
    expect(timeOfDayGreeting(at(23))).toBe('Encore debout à cette heure');
    expect(timeOfDayGreeting(at(0))).toBe('Encore debout à cette heure');
    expect(timeOfDayGreeting(at(2))).toBe('Encore debout à cette heure');
    expect(timeOfDayGreeting(at(4))).toBe('Encore debout à cette heure');
  });
});

describe('timeOfDayEmoji', () => {
  it('is a moon during the night-owl slot (23h-4h59)', () => {
    expect(timeOfDayEmoji(at(23))).toBe('🌙');
    expect(timeOfDayEmoji(at(0))).toBe('🌙');
    expect(timeOfDayEmoji(at(4))).toBe('🌙');
  });

  it('is a wave the rest of the day', () => {
    expect(timeOfDayEmoji(at(9))).toBe('👋');
    expect(timeOfDayEmoji(at(20))).toBe('👋');
  });
});

describe('dailyTagline', () => {
  it('picks from the gentler night pool during the night-owl slot', () => {
    expect(dailyTagline(at(2))).toMatch(/🌙|😴/);
  });

  it('picks from the daytime motivational pool otherwise', () => {
    expect(dailyTagline(at(9))).not.toMatch(/reposer|sommeil|Repose-toi/);
  });

  it('is stable for the same date and time-of-day bucket', () => {
    expect(dailyTagline(at(9))).toBe(dailyTagline(at(9)));
  });

  it('varies across different days', () => {
    const a = dailyTagline(new Date(2026, 0, 1, 9));
    const b = dailyTagline(new Date(2026, 0, 2, 9));
    expect(a).not.toBe(b);
  });
});
