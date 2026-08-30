// AddEconomyDesktop.jsx → /savings/[goalId]/add.
// Deviation from the Banani source: dropped the "Jour de l'économie" day
// picker and "Type d'action" radio group — SavingsEntry only ever stores
// amount + createdAt (auto-now, no backdating anywhere else in the app) and
// no reporting consumes a controlled action-type vocabulary. Replaced both
// with a single optional Note field (mirrors Transaction.label). See
// .planning/banani/savings-goals.md.
'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { paceLabel } from '@/lib/savings-pace-label';

interface GoalDetail {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
  paceAmount: number | null;
  completed: boolean;
}

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export default function AddEconomyPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = use(params);
  const user = useUser();
  const router = useRouter();
  const ripple = useRipple();
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ goal: GoalDetail }>(`/api/savings-goals/${goalId}`)
      .then((res) => setGoal(res.goal))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Objectif introuvable.'));
  }, [user, goalId]);

  if (!user) return <FormPageSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/savings-goals/${goalId}/entries`, {
        method: 'POST',
        body: { amount, note: note.trim() || undefined },
      });
      router.push(`/savings/${goalId}/confirmed`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  const pct =
    goal && goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      : 0;

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
          <Link href="/progress" className="text-muted-foreground hover:text-foreground">
            <Icon i="arrow-left" size={20} />
          </Link>
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
            Ajouter une économie
          </h2>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            {goal && (
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon
                        i={goal.icon as IconName}
                        size={18}
                        className="text-secondary-foreground"
                      />
                    </div>
                    <div>
                      <h3 className="font-headings text-sm font-bold text-foreground">
                        {goal.name}
                      </h3>
                      {paceLabel(goal.period, goal.paceAmount) && (
                        <p className="font-body text-xs text-muted-foreground">
                          {paceLabel(goal.period, goal.paceAmount)}
                        </p>
                      )}
                    </div>
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
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="transition-bar h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="rounded-lg border border-border bg-card p-8">
              <h3 className="mb-6 font-headings text-lg font-bold text-foreground">
                Enregistrer une nouvelle économie
              </h3>

              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-3 font-body text-sm font-medium text-foreground">
                    Montants rapides
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(q)}
                        onPointerDown={ripple}
                        className={`relative overflow-hidden rounded-lg border px-4 py-3 font-body text-sm font-medium ${
                          amount === q
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-input text-foreground'
                        }`}
                      >
                        {q} F
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="amount"
                    className="mb-2 block font-body text-sm font-medium text-foreground"
                  >
                    Ou saisis un montant personnalisé
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-4 py-3">
                    <input
                      id="amount"
                      type="number"
                      min={1}
                      value={amount || ''}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full bg-transparent font-body text-lg text-foreground outline-none"
                    />
                    <span className="font-body font-medium text-muted-foreground">FCFA</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="note"
                    className="mb-2 block font-body text-sm font-medium text-foreground"
                  >
                    Note (optionnel)
                  </label>
                  <textarea
                    id="note"
                    rows={3}
                    maxLength={200}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="ex: Trajet du matin + soir, ai pris le bus"
                    className="w-full resize-none rounded-lg border border-border bg-input px-4 py-3 font-body text-foreground outline-none"
                  />
                </div>

                {amount > 0 && goal && (
                  <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4">
                    <div className="flex items-start gap-3">
                      <Icon i="info" size={18} className="mt-0.5 flex-shrink-0 text-primary" />
                      <p className="font-body text-xs text-foreground">
                        Tu vas ajouter {formatPrice(amount)} F à {goal.name}. Cette action te
                        rapproche de ton objectif !
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <p role="alert" className="font-body text-sm text-accent">
                    {error}
                  </p>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => router.push('/progress')}
                    onPointerDown={ripple}
                    className="relative flex-1 overflow-hidden rounded-lg border border-primary bg-transparent px-6 py-3 font-body text-sm font-medium text-primary"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || amount <= 0}
                    onPointerDown={ripple}
                    className="relative flex-1 overflow-hidden rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {submitting ? 'Enregistrement…' : "Enregistrer l'économie"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
