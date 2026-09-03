'use client';

import { useEffect, useState } from 'react';
import { computeConfettiPieces } from '@/lib/animation';

const PIECE_COUNT = 70;

// Same palette as the envelope swatches + brand colors (globals.css @theme)
// so the burst reads as "this app's colors", not a generic rainbow.
const CONFETTI_COLORS = [
  '#1e6b45', // primary
  '#f5c842', // secondary
  '#e8612a', // accent
  '#5da0d0', // envelope-2
  '#a855a0', // envelope-5
  '#6b7fd7', // envelope-6
];

// Longest possible piece lifetime is durationMs (up to 3800ms) + delayMs (up
// to 500ms) — see computeConfettiPieces. Unmount a beat after that so the
// overlay <div> and its 70 spans don't linger in the DOM once nothing is
// visibly falling.
const AUTO_UNMOUNT_MS = 4500;

/**
 * One-shot confetti burst — falls from just above the viewport once on
 * mount, then removes itself. Pure DOM/CSS (no canvas, no new dependency),
 * matching useRipple's philosophy of dependency-free micro-animations.
 *
 * Mount it conditionally (e.g. `{confirmed && <ConfettiBurst />}`) rather
 * than always-rendering-but-hidden — mounting is what triggers the burst,
 * and `useState`'s lazy initializer guarantees the piece layout is computed
 * exactly once even if the parent re-renders while it's up.
 */
export function ConfettiBurst() {
  const [pieces] = useState(() => computeConfettiPieces(PIECE_COUNT, CONFETTI_COLORS));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(false), AUTO_UNMOUNT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className={`confetti-piece animate-confetti-fall-${piece.variant}`}
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size * 0.4}px`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delayMs}ms`,
            animationDuration: `${piece.durationMs}ms`,
          }}
        />
      ))}
    </div>
  );
}
