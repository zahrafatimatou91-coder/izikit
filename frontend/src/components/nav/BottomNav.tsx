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

const ITEMS: NavItem[] = [
  { id: 'dashboard', href: '/dashboard', icon: 'layout-dashboard', label: 'Tableau' },
  { id: 'envelopes', href: '/envelopes', icon: 'package', label: 'Enveloppes' },
  { id: 'add', href: '/transactions/new', icon: 'plus', label: null, cta: true },
  { id: 'progress', href: '/progress', icon: 'target', label: 'Objectifs' },
  { id: 'history', href: '/history', icon: 'clock', label: 'Historique' },
  { id: 'profile', href: '/settings', icon: 'user', label: 'Profil' },
];

/** Mobile bottom navigation bar — highlights the current route. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-2 py-3">
      {ITEMS.map((item) =>
        item.cta ? (
          <Link
            key={item.id}
            href={item.href}
            aria-label="Ajouter"
            className="-mt-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          >
            <Icon i="plus" size={22} />
          </Link>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 ${
              pathname === item.href ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon i={item.icon} size={20} />
            <span className="font-body text-xs">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
