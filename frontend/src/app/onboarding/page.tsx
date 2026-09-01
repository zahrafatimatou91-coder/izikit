// Onboarding is a 4-step wizard in the product design (Bienvenue → Ton
// budget → Tes enveloppes → Premier objectif), but only step 2 has a real
// screen + backend today — envelope creation (Phase 2) and the first
// savings goal (Phase 3) haven't shipped yet. Steps 3-4 render as visibly
// upcoming (not yet reachable), matching the source design's own step
// tracker rather than faking screens that don't exist yet.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useRipple } from '@/hooks/useRipple';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { COUNTRY_GROUPS } from '@/lib/countries';

const BUDGET_SUGGESTIONS = [
  { amount: 40000, label: 'Bourse standard' },
  { amount: 70000, label: 'Bourse + job' },
  { amount: 100000, label: 'Famille + bourse' },
] as const;

const FREQUENCIES = [
  { id: 'monthly', icon: 'calendar', label: 'Mensuel', sub: 'Reçu une fois par mois' },
  { id: 'weekly', icon: 'calendar-days', label: 'Hebdomadaire', sub: 'Reçu chaque semaine' },
  { id: 'daily', icon: 'sun', label: 'Quotidien', sub: 'Allocation journalière' },
] as const;

const STEPS = [
  { label: 'Bienvenue', done: true, active: false },
  { label: 'Ton budget', done: false, active: true },
  { label: 'Tes enveloppes', done: false, active: false },
  { label: 'Premier objectif', done: false, active: false },
];

export default function OnboardingPage() {
  const user = useUser();
  const router = useRouter();
  const ripple = useRipple();
  const [amount, setAmount] = useState(40000);
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]['id']>('monthly');
  // Drives payment-provider routing at checkout (Bictorys/XOF for UEMOA,
  // Moneroo/XAF for CEMAC) — see lib/server/payments/country-routing.ts.
  // Defaults to Sénégal, the app's original single-market default.
  const [country, setCountry] = useState('SN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [prefilledFromUser, setPrefilledFromUser] = useState(false);

  // Settings → "Modifier" links here to change an already-set budget.
  // `user` is null on the first render (AuthContext still loading), so a
  // useState lazy initializer would miss it — sync once via effect instead,
  // guarded so it never clobbers an in-progress edit on a later user refetch.
  useEffect(() => {
    if (user && !prefilledFromUser && user.totalBudget != null) {
      setAmount(user.totalBudget);
      if (user.budgetFrequency) {
        setFrequency(user.budgetFrequency as (typeof FREQUENCIES)[number]['id']);
      }
      if (user.country) {
        setCountry(user.country);
      }
      setPrefilledFromUser(true);
    }
  }, [user, prefilledFromUser]);

  if (!user) return <FormPageSkeleton />; // useUser() redirects to /login

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;
  const perDay = Math.round(amount / 30);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/onboarding', {
        method: 'POST',
        body: { totalBudget: amount, budgetFrequency: frequency, country },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 font-body">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Icon i="check" size={32} className="text-primary-foreground" />
          </div>
          <h1 className="font-headings text-2xl font-bold text-foreground">Budget enregistré !</h1>
          <p className="font-body text-sm text-muted-foreground">
            Crée tes enveloppes et suis tes dépenses dès maintenant depuis ton tableau de bord.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            onPointerDown={ripple}
            className="relative mt-2 flex items-center gap-2 overflow-hidden rounded-lg bg-primary px-8 py-3 font-body text-sm font-bold text-primary-foreground"
          >
            Aller au tableau de bord
            <Icon i="arrow-right" size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-body lg:flex-row">
      <div className="hidden w-72 flex-col border-r border-border bg-card px-8 py-10 lg:flex">
        <div className="mb-12">
          <BrandLogo size="md" />
        </div>

        <div className="mb-auto flex flex-col gap-2">
          {STEPS.map((step) => (
            <div key={step.label} className="flex items-center gap-4 rounded-lg px-3 py-3">
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  step.done
                    ? 'bg-primary'
                    : step.active
                      ? 'border-2 border-primary bg-secondary'
                      : 'border-2 border-border bg-background'
                }`}
              >
                {step.done ? (
                  <Icon i="check" size={14} className="text-primary-foreground" />
                ) : (
                  <span
                    className={`font-headings text-xs font-bold ${step.active ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {STEPS.indexOf(step) + 1}
                  </span>
                )}
              </div>
              <span
                className={`font-body text-sm font-medium ${step.active ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-6">
          <UserAvatar
            name={displayName}
            avatarUrl={user.avatarUrl}
            className="h-10 w-10 flex-shrink-0 rounded-lg"
          />
          <div>
            <p className="font-body text-sm font-medium text-foreground">{displayName}</p>
            <p className="font-body text-xs text-muted-foreground">Nouvel utilisateur</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4 lg:px-10">
          <p className="font-body text-xs text-muted-foreground">Étape 2 sur 4</p>
          <div className="mx-4 h-2 flex-1 overflow-hidden rounded-full bg-muted lg:mx-8">
            <div className="h-full rounded-full bg-primary" style={{ width: '40%' }} />
          </div>
          <p className="font-body text-xs font-medium text-primary">40%</p>
        </div>

        <div className="flex flex-1 items-start justify-center px-5 py-8 lg:px-16 lg:py-12">
          <div className="flex w-full max-w-2xl flex-col gap-8 lg:gap-10">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 font-body text-xs font-medium text-secondary-foreground">
                <Icon i="sparkles" size={14} />
                Configuration rapide — 2 min
              </div>
              <h2 className="mb-2 font-headings text-2xl font-bold leading-tight text-foreground lg:text-3xl">
                Quel est ton budget mensuel, <span className="text-primary">{displayName} ?</span>
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                C&apos;est le montant total que tu reçois chaque mois (bourse, famille, job...). Tu
                pourras le modifier plus tard.
              </p>
            </div>

            <div>
              <p className="mb-3 font-body text-xs font-medium text-muted-foreground">
                Suggestions rapides
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {BUDGET_SUGGESTIONS.map((s) => (
                  <button
                    key={s.amount}
                    type="button"
                    onClick={() => setAmount(s.amount)}
                    onPointerDown={ripple}
                    className={`relative overflow-hidden rounded-lg border p-4 text-left ${
                      amount === s.amount ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <p
                      className={`font-headings text-xl font-bold ${amount === s.amount ? 'text-primary' : 'text-foreground'}`}
                    >
                      {s.amount.toLocaleString('fr-FR')} F
                    </p>
                    <p className="font-body text-xs text-muted-foreground">{s.label}</p>
                    {amount === s.amount && (
                      <div className="mt-2 inline-flex items-center gap-1 font-body text-xs font-medium text-primary">
                        <Icon i="check-circle" size={12} />
                        Sélectionné
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="amount"
                className="mb-2 block font-body text-xs font-medium text-muted-foreground"
              >
                Ou saisis ton montant exact
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-primary bg-input px-4 py-4">
                <input
                  id="amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-transparent font-headings text-3xl font-bold text-foreground outline-none"
                />
                <span className="font-body text-sm font-medium text-muted-foreground">FCFA</span>
              </div>
            </div>

            <div>
              <p className="mb-3 font-body text-xs font-medium text-muted-foreground">
                À quelle fréquence reçois-tu cet argent ?
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id)}
                    onPointerDown={ripple}
                    className={`relative flex flex-col gap-2 overflow-hidden rounded-lg border p-4 text-left ${
                      frequency === f.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <Icon
                      i={f.icon}
                      size={20}
                      className={frequency === f.id ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <div>
                      <p
                        className={`font-body text-sm font-bold ${frequency === f.id ? 'text-primary' : 'text-foreground'}`}
                      >
                        {f.label}
                      </p>
                      <p className="mt-0.5 font-body text-xs text-muted-foreground">{f.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="country"
                className="mb-2 block font-body text-xs font-medium text-muted-foreground"
              >
                Dans quel pays es-tu ?
              </label>
              <div className="relative">
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-input px-4 py-3.5 font-body text-sm font-medium text-foreground outline-none focus:border-primary"
                >
                  {COUNTRY_GROUPS.map((group) => (
                    <optgroup key={group.zone} label={`${group.zone} (${group.currency})`}>
                      {group.countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Icon
                  i="chevron-down"
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              <p className="mt-2 font-body text-xs text-muted-foreground">
                Ça détermine les moyens de paiement disponibles pour ton abonnement Premium.
              </p>
            </div>

            <div className="flex gap-4 rounded-lg border border-secondary/30 bg-secondary/20 p-5">
              <Icon
                i="lightbulb"
                size={20}
                className="mt-0.5 flex-shrink-0 text-secondary-foreground"
              />
              <div>
                <p className="mb-1 font-body text-sm font-bold text-foreground">Bon à savoir</p>
                <p className="font-body text-xs leading-relaxed text-muted-foreground">
                  Avec {amount.toLocaleString('fr-FR')} FCFA/mois, tu disposes de ~
                  <AnimatedNumber
                    value={perDay}
                    format={(n) => Math.round(n).toLocaleString('fr-FR')}
                  />{' '}
                  F/jour. Chaque Franc va t&apos;aider à optimiser chaque centime.
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onSubmit}
                onPointerDown={ripple}
                disabled={submitting || amount <= 0}
                className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-primary px-8 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {submitting ? 'Enregistrement…' : 'Continuer'}
                <Icon i="arrow-right" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
