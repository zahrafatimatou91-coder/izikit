// EconomyConfirmedDesktop.jsx → /savings/[goalId]/confirmed. Chosen over the
// near-duplicate EconomySavedDesktop.jsx — see "Resolved" section in
// .planning/banani/savings-goals.md for why, and note it's a reversible
// judgment call.
//
// Deviations: "Détails de cette semaine" now lists real SavingsEntry rows
// instead of Banani's fabricated "Lundi / Lundi (ajout rapide)" placeholders.
// The "débloque un nouveau conseil" next-step is dropped (Tips isn't built
// yet — same anti-pattern as the dashboard's dropped "Conseil du jour").
// The "à ce rythme" projection is computed from real entries (only shown
// once there are ≥2, since a rate needs at least two data points) instead of
// Banani's fabricated "5 jours" example.
// Footer collapsed from Banani's 2 buttons ("Retour à ma progression" +
// "Ajouter une autre économie") to 1 — user feedback flagged the pair as
// repetitive; funding a goal again is already one tap away from its card
// on /progress.
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useRipple } from '@/hooks/useRipple';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { formatPrice } from '@/lib/utils';
import { formatRelativeDateTime } from '@/lib/format-date';

interface GoalDetail {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
}

interface EntryRow {
  id: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export default function EconomyConfirmedPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = use(params);
  const user = useUser();
  const router = useRouter();
  const ripple = useRipple();
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ goal: GoalDetail; recentEntries: EntryRow[] }>(`/api/savings-goals/${goalId}`)
      .then((res) => {
        setGoal(res.goal);
        setEntries(res.recentEntries);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Objectif introuvable.'));
  }, [user, goalId]);

  if (!user) return <FormPageSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="font-body text-sm text-accent">{error}</p>
      </div>
    );
  }

  if (!goal) return null;

  const pct =
    goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const lastEntry = entries[0];

  const avgPerEntry =
    entries.length >= 2 ? entries.reduce((s, e) => s + e.amount, 0) / entries.length : null;
  const entriesToGo = avgPerEntry && avgPerEntry > 0 ? Math.ceil(remaining / avgPerEntry) : null;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="progress"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-32 lg:pb-0">
        <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <button
            type="button"
            onClick={() => router.push('/progress')}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon i="arrow-left" size={20} />
          </button>
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
            Économie enregistrée
          </h2>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 lg:gap-8">
            <div className="flex flex-col items-center gap-4 rounded-lg border border-primary/20 bg-primary/10 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Icon i="check" size={32} className="text-white" />
              </div>
              <h2 className="font-headings text-2xl font-bold text-foreground">
                Économie enregistrée !
              </h2>
              {lastEntry && (
                <p className="font-body text-sm text-muted-foreground">
                  Bravo ! Tu as bien enregistré ton économie de {formatPrice(lastEntry.amount)} F
                  pour {goal.name}.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Icon
                      i={goal.icon as IconName}
                      size={18}
                      className="text-secondary-foreground"
                    />
                  </div>
                  <h3 className="font-headings text-sm font-bold text-foreground">{goal.name}</h3>
                </div>
                <div className="text-right">
                  <p className="font-body text-sm font-bold text-primary">
                    <AnimatedNumber value={goal.currentAmount} format={formatPrice} /> F
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    sur {formatPrice(goal.targetAmount)} F
                  </p>
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="transition-bar h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-3 font-body text-xs text-muted-foreground">
                <AnimatedNumber value={pct} />% de ton objectif atteint !
              </p>

              {lastEntry && (
                <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-input p-4">
                  <div>
                    <p className="mb-1 font-body text-xs text-muted-foreground">
                      Ajouté maintenant
                    </p>
                    <p className="font-body font-bold text-foreground">
                      {formatPrice(lastEntry.amount)} F
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 font-body text-xs text-muted-foreground">
                      Reste à économiser
                    </p>
                    <p className="font-body text-primary">{formatPrice(remaining)} F</p>
                  </div>
                </div>
              )}
            </div>

            {entries.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 font-headings text-sm font-bold text-foreground">
                  Économies récentes
                </h3>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <Icon i="check-circle" size={16} className="text-primary" />
                        <span className="font-body text-xs text-foreground">
                          {formatRelativeDateTime(new Date(e.createdAt))}
                          {e.note ? ` — ${e.note}` : ''}
                        </span>
                      </div>
                      <span className="font-body text-xs font-bold text-foreground">
                        {formatPrice(e.amount)} F
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!goal.completed && remaining > 0 && (
              <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-6">
                <h3 className="mb-4 font-headings text-sm font-bold text-foreground">
                  Ce qu&apos;il te reste à faire
                </h3>
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                    <span className="font-body text-xs font-bold text-white">1</span>
                  </div>
                  <div>
                    <p className="font-body text-xs font-medium text-foreground">
                      Économise {formatPrice(remaining)} F de plus
                    </p>
                    <p className="mt-0.5 font-body text-xs text-muted-foreground">
                      Continue comme tu l&apos;as commencé, tu es sur la bonne voie !
                    </p>
                  </div>
                </div>
              </div>
            )}

            {entriesToGo !== null && !goal.completed && (
              <div className="rounded-lg border border-border bg-card p-6 text-center">
                <div className="mb-4 inline-flex gap-2 rounded-lg bg-primary/10 p-3">
                  <Icon i="zap" size={18} className="text-primary" />
                  <span className="font-body text-sm font-bold text-primary">
                    À ce rythme, tu atteindras ton objectif !
                  </span>
                </div>
                <p className="font-body text-xs text-muted-foreground">
                  Continue à ce rythme, il te faudra encore ~{entriesToGo} économie
                  {entriesToGo > 1 ? 's' : ''} comme celle-ci pour atteindre ton objectif.
                </p>
              </div>
            )}

            {goal.completed && (
              <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-6 text-center">
                <p className="font-headings text-lg font-bold text-foreground">
                  Objectif atteint 🎉
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push('/progress')}
              onPointerDown={ripple}
              className="relative w-full overflow-hidden rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground"
            >
              Retour à ma progression
            </button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
