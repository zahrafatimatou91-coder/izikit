'use client';

import { useCallback } from 'react';
import { computeRippleGeometry } from '@/lib/animation';

/**
 * Material-style ripple on pointer-down, from the exact click point.
 * Pure DOM manipulation (no React state, no re-render) so it drops onto any
 * existing button/link with a single prop — the element just needs
 * `relative overflow-hidden` in its className so the ripple is clipped.
 *
 * Skips entirely when the user has requested reduced motion, and on
 * disabled elements.
 */
export function useRipple() {
  return useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== undefined && event.button !== 0) return; // left-click / touch only
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = event.currentTarget;
    if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') {
      return;
    }

    const rect = target.getBoundingClientRect();
    const { size, x, y } = computeRippleGeometry(rect, event.clientX, event.clientY);

    const span = document.createElement('span');
    span.className =
      'pointer-events-none absolute rounded-full bg-current opacity-25 animate-ripple';
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${x}px`;
    span.style.top = `${y}px`;

    target.appendChild(span);
    const cleanup = () => span.remove();
    span.addEventListener('animationend', cleanup, { once: true });
    // Safety net: if the element unmounts mid-animation, animationend never
    // fires and the span would otherwise leak.
    setTimeout(cleanup, 700);
  }, []);
}
