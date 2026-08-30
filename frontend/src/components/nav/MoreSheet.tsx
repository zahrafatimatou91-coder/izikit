'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useRipple } from '@/hooks/useRipple';

interface MoreSheetItem {
  href: string;
  icon: Parameters<typeof Icon>[0]['i'];
  label: string;
}

const ITEMS: MoreSheetItem[] = [
  { href: '/insights', icon: 'trending-up', label: 'Tendances' },
  { href: '/tips', icon: 'lightbulb', label: 'Conseils' },
  { href: '/settings', icon: 'settings', label: 'Paramètres' },
];

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Bottom sheet for the `BottomNav` "Plus" tab — houses the destinations
 * that don't fit as their own tab (Tendances, Conseils, Paramètres).
 *
 * This replaces the old hamburger + left-side `MobileDrawerNav`: having a
 * side drawer AND a bottom bar both live on screen read as two competing
 * nav surfaces. A sheet anchored to the bottom bar reads as part of it —
 * one nav system, not two. */
export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();
  const ripple = useRipple();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plus d'options"
        className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-2xl bg-card px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-xl transition-transform duration-200 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mb-2 h-1 w-10 flex-shrink-0 rounded-full bg-border" />
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            onPointerDown={ripple}
            className={`relative flex min-h-12 items-center gap-3 overflow-hidden rounded-lg px-4 font-body text-sm font-medium ${
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Icon i={item.icon} size={18} />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
