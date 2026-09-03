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

export interface ConfettiPiece {
  /** Horizontal start position, 0-100 (vw %). */
  left: number;
  color: string;
  /** Selects which `.animate-confetti-fall-N` keyframe (globals.css) this
   * piece uses — each variant bakes in a different drift/rotation so pieces
   * don't all fall in a dead-straight line, without needing per-instance
   * CSS custom properties (kept out of React's typed inline-style object). */
  variant: number;
  delayMs: number;
  durationMs: number;
  /** Width in px; rendered height is size * 0.4 (a confetti-strip look). */
  size: number;
}

/** Number of `.animate-confetti-fall-N` keyframe variants defined in
 * globals.css — keep in sync if more are added there. */
export const CONFETTI_VARIANT_COUNT = 5;

/**
 * One-shot confetti burst for the payment-success page. Pure/seedable (the
 * `rand` param defaults to Math.random but tests pass a fixed sequence) so
 * the distribution logic is unit-testable without touching the DOM — the
 * component (ConfettiBurst.tsx) just renders whatever this returns.
 */
export function computeConfettiPieces(
  count: number,
  colors: readonly string[],
  rand: () => number = Math.random,
): ConfettiPiece[] {
  return Array.from({ length: count }, () => {
    const colorIdx = Math.min(colors.length - 1, Math.floor(rand() * colors.length));
    return {
      left: rand() * 100,
      color: colors[colorIdx] ?? colors[0] ?? '#f5c842',
      variant: Math.floor(rand() * CONFETTI_VARIANT_COUNT),
      delayMs: Math.floor(rand() * 500),
      durationMs: 2200 + Math.floor(rand() * 1600),
      size: 6 + Math.floor(rand() * 6),
    };
  });
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
