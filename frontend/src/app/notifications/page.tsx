// NotificationsDesktop.jsx → /notifications.
//
// Deviations (see .planning/banani/notifications-settings.md):
// - Top-bar "x" navigates to /dashboard (fixed target) instead of an
//   ambiguous router.back() — predictable regardless of entry point.
// - Filter pills are real (?type= server-side filter, new on
//   GET /api/notifications) — Banani's mock has them but wires nothing.
// - Unread dot + tap-to-mark-read added — Banani's static mock renders
//   every card identically regardless of read state, which would make
//   "Marquer tout comme lu" a button with no visible effect.
// - Only 3 of Banani's ~6 notification "flavors" have a real trigger
//   behind them (Alertes/Conseils/Réalisations) — budget-set, identity
//   verification, and weekly-streak cards were not built (no real feature
//   backs them; see plan file).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { NotificationsSkeleton } from '@/components/skeletons/NotificationsSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { MobileDrawerNav } from '@/components/nav/MobileDrawerNav';
import { formatRelativeDateTime } from '@/lib/format-date';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

type FilterId = 'all' | 'ENVELOPE_THRESHOLD' | 'TIP_APPLIED' | 'GOAL_MILESTONE';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'ENVELOPE_THRESHOLD', label: 'Alertes' },
  { id: 'TIP_APPLIED', label: 'Conseils' },
  { id: 'GOAL_MILESTONE', label: 'Réalisations' },
];

const TYPE_STYLE: Record<
  string,
  { icon: IconName; wrap: string; iconWrap: string; iconColor: string }
> = {
  ENVELOPE_THRESHOLD: {
    icon: 'alert-triangle',
    wrap: 'bg-accent/10 border-accent/20',
    iconWrap: 'bg-accent',
    iconColor: 'text-accent-foreground',
  },
  TIP_APPLIED: {
    icon: 'lightbulb',
    wrap: 'bg-secondary/10 border-secondary/20',
    iconWrap: 'bg-secondary',
    iconColor: 'text-secondary-foreground',
  },
  GOAL_MILESTONE: {
    icon: 'trophy',
    wrap: 'bg-primary/10 border-primary/20',
    iconWrap: 'bg-primary',
    iconColor: 'text-primary-foreground',
  },
  SAVINGS_GOAL_PACE_MISSED: {
    icon: 'alarm-clock',
    wrap: 'bg-accent/10 border-accent/20',
    iconWrap: 'bg-accent',
    iconColor: 'text-accent-foreground',
  },
};
const DEFAULT_STYLE = {
  icon: 'bell' as IconName,
  wrap: 'bg-card border-border',
  iconWrap: 'bg-muted',
  iconColor: 'text-muted-foreground',
};

export default function NotificationsPage() {
  const user = useUser();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadPage = useCallback(async (activeFilter: FilterId, after: string | null) => {
    const params = new URLSearchParams();
    if (activeFilter !== 'all') params.set('type', activeFilter);
    if (after) params.set('cursor', after);
    const qs = params.toString();
    return api<{ items: NotificationItem[]; nextCursor: string | null }>(
      `/api/notifications${qs ? `?${qs}` : ''}`,
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    setHasLoaded(false);
    loadPage(filter, null)
      .then((res) => {
        setItems(res.items);
        setCursor(res.nextCursor);
        setHasLoaded(true);
        setInitialLoadDone(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'));
  }, [user, filter, loadPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await loadPage(filter, cursor);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(ids: string[] | 'all') {
    try {
      await api('/api/notifications', { method: 'PATCH', body: { ids } });
      const readIds = ids === 'all' ? new Set(items.map((n) => n.id)) : new Set(ids);
      setItems((prev) =>
        prev.map((n) =>
          readIds.has(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
        ),
      );
    } catch {
      // Non-critical — the unread dot just doesn't clear this time.
    }
  }

  if (!user) return <NotificationsSkeleton />;
  if (!initialLoadDone && !error) return <NotificationsSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="notifications"
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
              Notifications
            </h2>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            aria-label="Fermer"
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon i="x" size={20} />
          </button>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 font-body text-xs font-medium ${
                    filter === f.id
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {hasLoaded && items.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">Aucune notification.</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {items.map((n) => {
                const style = TYPE_STYLE[n.type] ?? DEFAULT_STYLE;
                const unread = !n.readAt;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => unread && markRead([n.id])}
                    className={`flex gap-4 rounded-lg border p-4 text-left ${style.wrap} ${unread ? '' : 'opacity-70'}`}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${style.iconWrap}`}
                    >
                      <Icon i={style.icon} size={18} className={style.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-body text-sm font-medium text-foreground">{n.title}</p>
                        {unread && (
                          <span
                            className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-1 font-body text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-2 font-body text-xs text-muted-foreground">
                        {formatRelativeDateTime(new Date(n.createdAt))}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

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

            {items.length > 0 && (
              <div className="mt-2 flex justify-center border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => markRead('all')}
                  disabled={!hasUnread}
                  className="font-body text-sm font-medium text-primary disabled:opacity-40"
                >
                  Marquer tout comme lu
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>

      <MobileDrawerNav
        active="notifications"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
