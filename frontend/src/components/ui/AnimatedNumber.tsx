'use client';

import { useEffect, useRef, useState } from 'react';
import { tweenValue } from '@/lib/animation';

interface AnimatedNumberProps {
  value: number;
  /** Formats the interpolated value for display, e.g. formatPrice. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

/**
 * Displays a number that tweens to its new value whenever `value` changes,
 * instead of jumping — including on first mount, where it counts up from 0.
 * Every page load is a fresh mount, so this is what actually makes the
 * animation visible in normal navigation (a "only animate on update" version
 * only ever fires while staying on an already-open page — nearly never in
 * practice). Skips the tween entirely under `prefers-reduced-motion: reduce`.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 600,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? value
      : 0,
  );
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const firstMount = !mountedRef.current;
    mountedRef.current = true;

    // Nothing to animate: reduced motion always jumps straight to the
    // target, and an update to the same value (re-render, unrelated prop
    // change) has nothing to tween.
    if (prefersReduced || (!firstMount && fromRef.current === value)) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = firstMount ? 0 : fromRef.current;
    const to = value;
    const start = performance.now();

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = (now - start) / durationMs;
      if (t >= 1) {
        fromRef.current = to;
        setDisplay(to);
        return;
      }
      // Rounded mid-tween too — every value this app displays (FCFA has no
      // decimals, percentages and counts are whole numbers) is an integer,
      // so a fractional intermediate frame (e.g. "43 223,364") would be a
      // display artifact, not a real in-between value.
      setDisplay(Math.round(tweenValue(from, to, t)));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
