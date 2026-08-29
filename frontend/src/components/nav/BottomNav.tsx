'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from 'lucide-react/dynamic';

interface NavItem {
  id: string;
  href: string;
  icon: IconName;
  label: string | null;
  cta?: boolean;
}

// Capped at 5 slots (4 labeled + 1 FAB) — the standard mobile tab-bar
// ceiling. This used to carry 6 labeled items + the FAB, which never
// actually fit: flex items default to `min-width: auto`, so text like
// "Historique" refused to shrink below its own single-line width, and
// the bar quietly overflowed past the right edge on every phone under
// ~430px wide (confirmed on iPhone 12 Pro/15 Pro Max, Pixel 10, Galaxy
// S20 Ultra — "Historique" and/or "Profil" clipped clean off-screen).
// Conseils and Profil (Paramètres) are dropped here, not deleted — both
// stay one tap away via the hamburger → MobileDrawerNav, which already
// lists every destination (see nav-items.ts).
const ITEMS: NavItem[] = [
  { id: 'dashboard', href: '/dashboard', icon: 'layout-dashboard', label: 'Tableau' },
  { id: 'envelopes', href: '/envelopes', icon: 'package', label: 'Enveloppes' },
  { id: 'add', href: '/transactions/new', icon: 'plus', label: null, cta: true },
  { id: 'progress', href: '/progress', icon: 'target', label: 'Objectifs' },
  { id: 'history', href: '/history', icon: 'clock', label: 'Historique' },
];

/** Mobile bottom navigation bar — highlights the current route. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-1 py-3">
      {ITEMS.map((item) =>
        item.cta ? (
          <Link
            key={item.id}
            href={item.href}
            aria-label="Ajouter"
            className="-mt-6 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          >
            <Icon i="plus" size={22} />
          </Link>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 ${
              pathname === item.href ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon i={item.icon} size={20} />
            <span className="w-full truncate text-center font-body text-[11px]">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
