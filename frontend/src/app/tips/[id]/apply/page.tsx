// ApplyTipDesktop.jsx → /tips/[id]/apply. Visiting this page performs the
// apply action (POST /api/tips/[id]/apply is idempotent — safe on refresh,
// returns the existing goal if already applied).
//
// Deviations (see .planning/banani/tips.md):
// - Day-by-day checkboxes dropped — Banani's own mock ships them
//   uncontrolled (no onChange, no state), so even the source design never
//   wired them to anything. An inert checkbox that looks interactive but
//   does nothing is a broken affordance, not a faithful port. Rendered as a
//   plain reference list instead, labeled "Jour N" sequentially (not actual
//   weekday names) since the number of steps varies per tip — Banani's
//   Lundi/Mardi/Mercredi/Jeudi-Dimanche grouping only fit the one 4-step
//   example (Transport malin); the other 8 tips have 3 steps each.
// - The inline "Enregistrer ton économie" form dropped — it's the same
//   amount+note+submit form already built and tested in Phase 3
//   (/savings/[goalId]/add). Routes there instead of duplicating it.
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { formatPrice } from '@/lib/utils';

interface GoalResult {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  period: 'weekly' | 'monthly';
  completed: boolean;
}

interface TipDetail {
  id: string;
  title: string;
  icon: string;
  steps: string[];
}

const SUCCESS_TIPS = [
  'Crée une alerte sur ton téléphone pour rester régulier.',
  'Partage ton objectif avec un ami pour te motiver.',
  'Suis ta progression toutes les semaines.',
];

export default function ApplyTipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();
  const [goal, setGoal] = useState<GoalResult | null>(null);
  const [tip, setTip] = useState<TipDetail | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api<{ goal: GoalResult; alreadyApplied: boolean }>(`/api/tips/${id}/apply`, {
        method: 'POST',
      }),
      api<{ tip: TipDetail }>(`/api/tips/${id}`),
    ])
      .then(([applyRes, tipRes]) => {
        setGoal(applyRes.goal);
        setAlreadyApplied(applyRes.alreadyApplied);
        setTip(tipRes.tip);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'));
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="font-body text-sm text-accent">{error}</p>
      </div>
    );
  }

  if (!goal || !tip) return null;

  const pct =
    goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      : 0;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="tips"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <button
            type="button"
            onClick={() => router.push(`/tips/${id}`)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon i="arrow-left" size={20} />
          </button>
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
            Appliquer le conseil
          </h2>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 lg:gap-8">
            <div className="flex items-start gap-4 rounded-lg border border-primary/20 bg-primary/10 p-6">
              <Icon i="check-circle-2" size={24} className="flex-shrink-0 text-primary" />
              <div>
                <h3 className="mb-1 font-headings font-bold text-foreground">
                  {alreadyApplied
                    ? 'Tu as déjà appliqué ce conseil'
                    : 'Conseil appliqué avec succès !'}
                </h3>
                <p className="font-body text-xs text-muted-foreground">
                  {alreadyApplied
                    ? `Cet objectif d'épargne, « ${goal.name} », avait déjà été créé à partir de ce conseil — voici où tu en es.`
                    : `Un nouvel objectif d'épargne, « ${goal.name} », vient d'être créé à partir de ce conseil.`}{' '}
                  Suis sa progression ci-dessous et ajoute ta première économie quand tu es prête.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-8">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <Icon i={goal.icon as IconName} size={24} className="text-primary" />
                    <h2 className="font-headings text-2xl font-bold text-foreground">
                      {goal.name}
                    </h2>
                  </div>
                  <p className="font-body text-sm text-muted-foreground">
                    Objectif mensuel : économiser ~{formatPrice(goal.targetAmount)} FCFA
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 font-headings text-3xl font-bold text-primary">
                    {formatPrice(goal.currentAmount)} F
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    sur {formatPrice(goal.targetAmount)} FCFA
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-body text-xs font-medium text-muted-foreground">Progression</p>
                  <p className="font-body text-xs font-bold text-foreground">{pct}%</p>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                {goal.completed
                  ? 'Objectif atteint 🎉'
                  : "Commence dès aujourd'hui pour voir les résultats !"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-8">
              <h3 className="mb-6 font-headings text-lg font-bold text-foreground">
                Plan d&apos;action
              </h3>
              <div className="space-y-4">
                {tip.steps.map((step, i) => (
                  <div key={i} className="flex gap-4 rounded-lg bg-input p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon i="calendar" size={16} className="text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-start justify-between">
                        <span className="font-body text-xs font-medium text-foreground">
                          Jour {i + 1}
                        </span>
                      </div>
                      <p className="font-body text-sm text-foreground">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-8">
              <h3 className="mb-4 font-headings text-lg font-bold text-foreground">
                Conseils pour réussir
              </h3>
              <ul className="space-y-3">
                {SUCCESS_TIPS.map((s) => (
                  <li key={s} className="flex gap-3">
                    <Icon
                      i="check-circle"
                      size={18}
                      className="mt-0.5 flex-shrink-0 text-primary"
                    />
                    <span className="font-body text-sm text-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/tips')}
                className="flex-1 rounded-lg border border-primary bg-transparent px-6 py-3 font-body text-sm font-medium text-primary"
              >
                Revenir aux conseils
              </button>
              <button
                type="button"
                onClick={() => router.push(`/savings/${goal.id}/add`)}
                className="flex-1 rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground"
              >
                Ajouter une économie
              </button>
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
