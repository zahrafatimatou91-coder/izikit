'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { ListPageSkeleton } from '@/components/skeletons/ListPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Icon } from '@/components/ui/Icon';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { MobileDrawerNav } from '@/components/nav/MobileDrawerNav';
import { formatRelativeDateTime } from '@/lib/format-date';

interface TransactionItem {
  id: string;
  amount: number;
  label: string;
  occurredAt: string;
  envelope: { name: string; icon: string } | null;
}

const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function groupByMonth(items: TransactionItem[]): { label: string; items: TransactionItem[] }[] {
  const groups: { label: string; items: TransactionItem[] }[] = [];
  for (const item of items) {
    const d = new Date(item.occurredAt);
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

export default function HistoryPage() {
  const user = useUser();
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadPage = useCallback(async (after: string | null) => {
    const qs = after ? `?cursor=${encodeURIComponent(after)}` : '';
    return api<{ items: TransactionItem[]; nextCursor: string | null }>(`/api/transactions${qs}`);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPage(null)
      .then((res) => {
        setItems(res.items);
        setCursor(res.nextCursor);
        setHasLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'));
  }, [user, loadPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await loadPage(cursor);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (!user) return <ListPageSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;
  const groups = groupByMonth(items);

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="history"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="text-foreground lg:hidden"
            >
              <Icon i="menu" size={22} />
            </button>
            <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
              Historique des transactions
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/transactions/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm font-bold text-primary-foreground"
            >
              <Icon i="plus" size={16} />
              <span className="hidden lg:inline">Ajouter une transaction</span>
            </Link>
            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            {hasLoaded && items.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <p className="mb-3 font-body text-sm text-muted-foreground">
                  Aucune transaction pour l&apos;instant.
                </p>
                <Link
                  href="/transactions/new"
                  className="font-body text-sm font-medium text-primary"
                >
                  Ajouter ta première transaction
                </Link>
              </div>
            )}

            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="mb-3 px-1 font-headings text-sm font-bold uppercase text-muted-foreground">
                  {group.label}
                </h3>
                <div className="rounded-lg border border-border bg-card px-4 lg:px-6">
                  {group.items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      label={t.label}
                      category={t.envelope?.name ?? (t.amount > 0 ? 'Revenu' : 'Dépense')}
                      amount={t.amount}
                      time={formatRelativeDateTime(new Date(t.occurredAt))}
                      icon={
                        (t.envelope?.icon as IconName) ??
                        (t.amount > 0 ? 'arrow-down-left' : 'arrow-up-right')
                      }
                    />
                  ))}
                </div>
              </div>
            ))}

            {cursor && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mx-auto rounded-lg border border-border px-6 py-2.5 font-body text-sm font-medium text-foreground disabled:opacity-50"
              >
                {loadingMore ? 'Chargement…' : 'Charger plus'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>

      <MobileDrawerNav
        active="history"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
