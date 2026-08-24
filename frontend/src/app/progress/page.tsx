// MyProgressDesktop.jsx → /progress.
//
// Deviations (see .planning/banani/savings-goals.md for the full list):
// - "Active objective" (Banani hardcodes exactly one goal, "Transport
//   malin") generalized into a real list over the user's SavingsGoal[] —
//   same translation Phase 2 did for the dashboard's envelope grid.
// - "Détail par jour" generalized from a per-goal Mon-Sun list into a real
//   global week strip (sum of all entries per day, across every goal) —
//   doesn't cleanly generalize per-goal without becoming unwieldy, and
//   directly backs the "Jours actifs" stat above it.
// - Insights: dropped "débloque des nouveaux conseils" (Tips isn't built
//   yet) and "ton objectif se réinitialise chaque mois" (no monthly-reset
//   cron exists — claiming it would be the same over-promising-copy issue
//   already flagged for the AI-tips mismatch in the roadmap).
// - Bottom CTA changed from a single "Ajouter une économie" (ambiguous with
//   0 or 2+ goals) to "Créer un objectif" — each goal card carries its own
//   "Ajouter une économie" action instead.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { SavingsGoalCard } from '@/components/savings/SavingsGoalCard';
import { formatPrice } from '@/lib/utils';

interface Goal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  period: 'weekly' | 'monthly';
  completed: boolean;
}

interface Summary {
  activeGoals: number;
  savedThisWeek: number;
  activeDays: number;
}

interface DayBucket {
  date: string;
  total: number;
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function ProgressPage() {
  const user = useUser();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<DayBucket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ goals: Goal[]; summary: Summary; weeklyBreakdown: DayBucket[] }>('/api/savings-goals')
      .then((res) => {
        setGoals(res.goals);
        setSummary(res.summary);
        setBreakdown(res.weeklyBreakdown);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'));
  }, [user]);

  if (!user) return null;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;
  const today = new Date();

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="progress"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
            Ma Progression
          </h2>
          <NotificationBell />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:gap-8">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            {summary && (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Objectifs actifs</p>
                  <p className="font-headings text-3xl font-bold text-primary">
                    {summary.activeGoals}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <p className="mb-2 font-body text-sm text-muted-foreground">
                    Économisé cette semaine
                  </p>
                  <p className="font-headings text-3xl font-bold text-foreground">
                    {formatPrice(summary.savedThisWeek)} F
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Jours actifs</p>
                  <p className="font-headings text-3xl font-bold text-foreground">
                    {summary.activeDays}
                  </p>
                </div>
              </div>
            )}

            {goals && goals.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {goals.map((g) => (
                  <SavingsGoalCard
                    key={g.id}
                    id={g.id}
                    name={g.name}
                    icon={g.icon as IconName}
                    currentAmount={g.currentAmount}
                    targetAmount={g.targetAmount}
                    period={g.period}
                    completed={g.completed}
                  />
                ))}
              </div>
            )}

            {goals && goals.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">
                  Tu n&apos;as pas encore d&apos;objectif d&apos;épargne.
                </p>
              </div>
            )}

            {breakdown.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-8">
                <h3 className="mb-6 font-headings text-lg font-bold text-foreground">
                  Détail par jour (cette semaine)
                </h3>
                <div className="space-y-3">
                  {breakdown.map((b, i) => {
                    const date = new Date(b.date);
                    const isFuture = date > today && date.toDateString() !== today.toDateString();
                    return (
                      <div
                        key={b.date}
                        className="flex items-center justify-between rounded-lg bg-input p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            i={b.total > 0 ? 'check-circle' : 'circle'}
                            size={20}
                            className={b.total > 0 ? 'text-primary' : 'text-muted'}
                          />
                          <span
                            className={`font-body ${b.total > 0 ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            {DAY_LABELS[i]}
                          </span>
                        </div>
                        <span
                          className={`font-body ${b.total > 0 ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                        >
                          {isFuture ? '—' : b.total > 0 ? `${formatPrice(b.total)} F` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-8">
              <h3 className="mb-4 font-headings text-lg font-bold text-foreground">
                Ce qu&apos;il faut savoir
              </h3>
              <div className="flex gap-3">
                <div className="mt-0.5 flex-shrink-0 text-primary">
                  <Icon i="info" size={18} />
                </div>
                <span className="font-body text-sm text-foreground">
                  Tu peux enregistrer tes économies n&apos;importe quand.
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="flex-1 rounded-lg border border-primary bg-transparent px-6 py-3 text-center font-body text-sm font-medium text-primary"
              >
                Retour
              </Link>
              <Link
                href="/savings/new"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-white"
              >
                <Icon i="plus" size={18} />
                Créer un objectif
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
