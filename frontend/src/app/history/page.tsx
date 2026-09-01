'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { HistorySkeleton } from '@/components/skeletons/HistorySkeleton';
import { api, ApiError } from '@/lib/api';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Icon } from '@/components/ui/Icon';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { formatRelativeDateTime } from '@/lib/format-date';
import { useRipple } from '@/hooks/useRipple';
import { useRevalidateOnRestore } from '@/hooks/useRevalidateOnRestore';

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
  const ripple = useRipple();
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPage = useCallback(async (after: string | null) => {
    const qs = after ? `?cursor=${encodeURIComponent(after)}` : '';
    return api<{ items: TransactionItem[]; nextCursor: string | null }>(`/api/transactions${qs}`);
  }, []);

  const reloadFirstPage = useCallback(() => {
    loadPage(null)
      .then((res) => {
        setItems(res.items);
        setCursor(res.nextCursor);
        setHasLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'));
  }, [loadPage]);

  useEffect(() => {
    if (user) reloadFirstPage();
  }, [user, reloadFirstPage]);
  useRevalidateOnRestore(reloadFirstPage);

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

  async function confirmDeleteTransaction() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/transactions/${deleteTarget.id}`, { method: 'DELETE' });
      // Remove locally rather than refetching — the cursor-paginated list
      // has no simple "just reload the current window" call.
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return <HistorySkeleton />;
  if (!hasLoaded && !error) return <HistorySkeleton />;

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

      <div className="flex flex-1 flex-col pb-32 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <h2 className="min-w-0 flex-1 truncate font-headings text-lg font-bold text-foreground lg:flex-none lg:text-xl">
            <span className="lg:hidden">Historique</span>
            <span className="hidden lg:inline">Historique des transactions</span>
          </h2>
          <div className="flex flex-shrink-0 items-center gap-3">
            <Link
              href="/transactions/new"
              aria-label="Ajouter une transaction"
              onPointerDown={ripple}
              className="relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-primary px-3 py-2 font-body text-sm font-bold text-primary-foreground lg:gap-2 lg:px-4"
            >
              <Icon i="plus" size={16} />
              <span className="lg:hidden">Ajouter</span>
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
              <div className="rounded-lg border border-dashed border-border bg-card p-5 text-center sm:p-8">
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
                      id={t.id}
                      label={t.label}
                      category={t.envelope?.name ?? (t.amount > 0 ? 'Revenu' : 'Dépense')}
                      amount={t.amount}
                      time={formatRelativeDateTime(new Date(t.occurredAt))}
                      icon={
                        (t.envelope?.icon as IconName) ??
                        (t.amount > 0 ? 'arrow-down-left' : 'arrow-up-right')
                      }
                      onDeleteRequested={(id, label) => setDeleteTarget({ id, label })}
                    />
                  ))}
                </div>
              </div>
            ))}

            {cursor && (
              <button
                type="button"
                onClick={loadMore}
                onPointerDown={ripple}
                disabled={loadingMore}
                className="relative mx-auto overflow-hidden rounded-lg border border-border px-6 py-2.5 font-body text-sm font-medium text-foreground disabled:opacity-50"
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
      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget ? `Supprimer « ${deleteTarget.label} » ?` : 'Supprimer cette transaction ?'
        }
        description="Cette action est irréversible."
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        destructive
        confirming={deleting}
        onConfirm={confirmDeleteTransaction}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
