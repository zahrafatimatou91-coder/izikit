'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';

interface TransactionRowProps {
  id: string;
  label: string;
  category: string;
  amount: number; // signed, smallest unit — negative = expense, positive = income
  time: string;
  icon: IconName;
  /** Opens the parent's ConfirmDialog for this transaction — the parent
   * owns the actual DELETE call + list refresh, this component only
   * decides *when* to ask. */
  onDeleteRequested: (id: string, label: string) => void;
}

/** Single transaction entry in a history list. Tapping the "..." button
 * opens a small menu (Modifier / Supprimer) — used identically on the
 * Dashboard's "Dernières dépenses" and the full /history list, so the
 * action is available everywhere a transaction is shown. */
export function TransactionRow({
  id,
  label,
  category,
  amount,
  time,
  icon,
  onDeleteRequested,
}: TransactionRowProps) {
  const isPositive = amount > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [menuOpen]);

  return (
    <div ref={containerRef} className="relative border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon i={icon} size={16} className="text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-body text-sm font-medium text-foreground">{label}</div>
          <div className="font-body text-xs text-muted-foreground">
            {category} · {time}
          </div>
        </div>
        <span
          className={`font-headings text-base font-bold ${isPositive ? 'text-primary' : 'text-foreground'}`}
        >
          {isPositive ? '+' : ''}
          {formatPrice(amount)} F
        </span>
        <button
          type="button"
          aria-label="Options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <Icon i="more-vertical" size={16} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <Link
            href={`/transactions/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 font-body text-sm text-foreground hover:bg-muted"
          >
            <Icon i="edit-2" size={14} />
            Modifier
          </Link>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDeleteRequested(id, label);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-body text-sm text-accent hover:bg-muted"
          >
            <Icon i="trash-2" size={14} />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
