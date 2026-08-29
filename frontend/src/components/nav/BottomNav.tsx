'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { MoreSheet } from './MoreSheet';
import type { IconName } from 'lucide-react/dynamic';

interface NavItem {
  id: string;
  href: string;
  icon: IconName;
  label: string;
  more?: boolean;
}

// 4 labeled route tabs + 1 "Plus" tab, split 2/3 around the center FAB.
// Every non-FAB slot carries `min-w-0` + `truncate`, guarding against the
// old overflow bug (flex items default to `min-width: auto`, so text like
// "Historique" used to refuse to shrink and the bar overflowed past the
// right edge on phones under ~430px wide).
//
// Conseils, Tendances and Paramètres don't get their own tab — they open
// via the "Plus" sheet (see MoreSheet.tsx). They used to live behind a
// hamburger button that opened a full left-side drawer, redundant with
// this bar (two nav surfaces fighting for attention on the same screen).
// The sheet anchors to this bar instead, so it reads as one nav system.
const LEFT_ITEMS: NavItem[] = [
  { id: 'dashboard', href: '/dashboard', icon: 'layout-dashboard', label: 'Tableau' },
  { id: 'envelopes', href: '/envelopes', icon: 'package', label: 'Enveloppes' },
];
const RIGHT_ITEMS: NavItem[] = [
  { id: 'progress', href: '/progress', icon: 'target', label: 'Objectifs' },
  { id: 'history', href: '/history', icon: 'clock', label: 'Historique' },
  { id: 'more', href: '', icon: 'ellipsis', label: 'Plus', more: true },
];

/** Mobile bottom navigation bar — highlights the current route. */
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  function renderItem(item: NavItem) {
    if (item.more) {
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Plus d'options"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 ${
            moreOpen ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon i={item.icon} size={20} />
          <span className="w-full truncate text-center font-body text-[11px]">{item.label}</span>
        </button>
      );
    }
    return (
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
    );
  }

  return (
    <>
      {/* `relative` + an absolutely-centered FAB, instead of the FAB just
       * sitting inline as the 3rd of N items — with an odd item split (2
       * labeled tabs + Plus on one side, only Objectifs/Historique/Plus on
       * the other) an inline FAB drifts visibly off-center. Anchoring it to
       * the bar's true midpoint keeps it centered regardless of how the
       * remaining tabs are split, and the two side groups each still get
       * their own `justify`-free even split via `flex-1` children. */}
      <nav className="relative flex items-center border-t border-border bg-card px-2 py-3">
        <div className="flex flex-1 items-center gap-1">{LEFT_ITEMS.map(renderItem)}</div>
        <div className="w-16 flex-shrink-0" aria-hidden="true" />
        <div className="flex flex-1 items-center gap-1">{RIGHT_ITEMS.map(renderItem)}</div>
        <Link
          href="/transactions/new"
          aria-label="Ajouter"
          className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
        >
          <Icon i="plus" size={22} />
        </Link>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
