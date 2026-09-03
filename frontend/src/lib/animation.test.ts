import { describe, expect, it } from 'vitest';
import {
  computeConfettiPieces,
  computeRippleGeometry,
  CONFETTI_VARIANT_COUNT,
  easeOutCubic,
  tweenValue,
} from './animation';

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('front-loads the motion (past the midpoint before t=0.5)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps out-of-range input', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('tweenValue', () => {
  it('returns the start value at t=0 and the end value at t=1', () => {
    expect(tweenValue(70000, 102000, 0)).toBe(70000);
    expect(tweenValue(70000, 102000, 1)).toBe(102000);
  });

  it('is monotonic between two increasing values', () => {
    const a = tweenValue(1000, 2000, 0.3);
    const b = tweenValue(1000, 2000, 0.6);
    expect(b).toBeGreaterThan(a);
  });

  it('handles a decreasing value (spend eating into remaining budget)', () => {
    const mid = tweenValue(48000, 12000, 0.5);
    expect(mid).toBeLessThan(48000);
    expect(mid).toBeGreaterThan(12000);
  });
});

describe('computeRippleGeometry', () => {
  it('centers a circle large enough to cover the whole element on the click point', () => {
    const rect = { width: 100, height: 40, left: 200, top: 50 };
    const geo = computeRippleGeometry(rect, 220, 60);
    // Diameter must be at least the longer side so the ripple fully covers a
    // click near any corner.
    expect(geo.size).toBeGreaterThanOrEqual(100);
    // The circle is centered on the click point: click - rect origin - half size.
    expect(geo.x).toBe(220 - 200 - geo.size / 2);
    expect(geo.y).toBe(60 - 50 - geo.size / 2);
  });

  it('scales with the larger of width/height for non-square elements', () => {
    const wide = computeRippleGeometry({ width: 300, height: 20, left: 0, top: 0 }, 10, 10);
    expect(wide.size).toBe(600);
  });
});

describe('computeConfettiPieces', () => {
  const colors = ['#f5c842', '#1e6b45', '#e8612a'];

  it('returns exactly `count` pieces', () => {
    const pieces = computeConfettiPieces(70, colors, () => 0.5);
    expect(pieces).toHaveLength(70);
  });

  it('returns an empty array for count 0', () => {
    expect(computeConfettiPieces(0, colors, () => 0.5)).toEqual([]);
  });

  it('keeps every piece within its valid ranges', () => {
    // Sweep a spread of "random" values, including the edges 0 and just
    // under 1, to catch off-by-one bugs in the index math.
    const seq = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.999];
    let i = 0;
    const rand = () => seq[i++ % seq.length]!;
    const pieces = computeConfettiPieces(50, colors, rand);
    for (const piece of pieces) {
      expect(piece.left).toBeGreaterThanOrEqual(0);
      expect(piece.left).toBeLessThan(100);
      expect(colors).toContain(piece.color);
      expect(piece.variant).toBeGreaterThanOrEqual(0);
      expect(piece.variant).toBeLessThan(CONFETTI_VARIANT_COUNT);
      expect(piece.delayMs).toBeGreaterThanOrEqual(0);
      expect(piece.delayMs).toBeLessThan(500);
      expect(piece.durationMs).toBeGreaterThanOrEqual(2200);
      expect(piece.durationMs).toBeLessThan(3800);
      expect(piece.size).toBeGreaterThanOrEqual(6);
      expect(piece.size).toBeLessThan(12);
    }
  });

  it('never picks past the last color even when rand approaches 1', () => {
    const pieces = computeConfettiPieces(5, colors, () => 0.999999);
    for (const piece of pieces) {
      expect(piece.color).toBe(colors[colors.length - 1]);
    }
  });

  it('is deterministic for a fixed rand source', () => {
    const rand1 = (() => {
      let i = 0;
      const seq = [0.1, 0.2, 0.3, 0.4, 0.5];
      return () => seq[i++ % seq.length]!;
    })();
    const rand2 = (() => {
      let i = 0;
      const seq = [0.1, 0.2, 0.3, 0.4, 0.5];
      return () => seq[i++ % seq.length]!;
    })();
    expect(computeConfettiPieces(10, colors, rand1)).toEqual(
      computeConfettiPieces(10, colors, rand2),
    );
  });
});
