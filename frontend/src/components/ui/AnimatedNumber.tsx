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
 * instead of jumping. Shows the value immediately on first mount (nothing to
 * animate from yet) and skips the tween entirely under
 * `prefers-reduced-motion: reduce`.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 600,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
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
      setDisplay(tweenValue(from, to, t));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
