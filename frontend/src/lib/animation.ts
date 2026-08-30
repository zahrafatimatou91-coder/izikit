/**
 * Pure math helpers behind the app's two micro-animation primitives
 * (useRipple, AnimatedNumber). Kept dependency-free and side-effect-free so
 * they're trivially unit-testable — the DOM-touching parts (hooks/
 * components) stay thin wrappers around these.
 */

/** Cubic ease-out: fast start, gentle settle. Used for number tweens. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

/** Interpolates from `from` to `to` at progress `t` (0..1), eased. */
export function tweenValue(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutCubic(t);
}

export interface RippleGeometry {
  size: number;
  x: number;
  y: number;
}

/**
 * Computes the size/position of a ripple circle so it fully covers
 * `rect` when centered on the click point (clientX/clientY, in the same
 * coordinate space as `rect`).
 */
export function computeRippleGeometry(
  rect: { width: number; height: number; left: number; top: number },
  clientX: number,
  clientY: number,
): RippleGeometry {
  const size = Math.max(rect.width, rect.height) * 2;
  return {
    size,
    x: clientX - rect.left - size / 2,
    y: clientY - rect.top - size / 2,
  };
}
