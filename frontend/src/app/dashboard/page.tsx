'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { EnvelopeCard } from '@/components/envelopes/EnvelopeCard';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import type { EnvelopeSwatchKey } from '@/lib/envelope-colors';
import { formatPrice } from '@/lib/utils';
import { budgetPeriodLabel } from '@/lib/budget-period-label';
import { formatRelativeDateTime } from '@/lib/format-date';
import { dailyTagline, firstName, timeOfDayEmoji, timeOfDayGreeting } from '@/lib/greeting';

interface DashboardEnvelope {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyLimit: number;
  spent: number;
}

interface DashboardTransaction {
  id: string;
  amount: number;
  label: string;
  occurredAt: string;
  envelope: { name: string; icon: string } | null;
}

interface DashboardData {
  totalBudget: number | null;
  budgetFrequency: string | null;
  spent: number;
  income: number;
  daysLeft: number;
  envelopes: DashboardEnvelope[];
  recentTransactions: DashboardTransaction[];
}

export default function DashboardPage() {
  const user = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function confirmDeleteTransaction() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/transactions/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return <DashboardSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 font-body">
        <p className="font-body text-sm text-accent">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <DashboardSkeleton />;
  }

  if (data.totalBudget === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center font-body">
        <p className="font-headings text-xl font-bold text-foreground">
          Configure ton budget d&apos;abord
        </p>
        <p className="max-w-sm font-body text-sm text-muted-foreground">
          Tu dois définir ton budget mensuel avant de voir ton tableau de bord.
        </p>
        <Link
          href="/onboarding"
          className="rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground"
        >
          Configurer mon budget
        </Link>
      </div>
    );
  }

  const mostUrgentEnvelope = data.envelopes
    .map((e) => ({
      ...e,
      pct: e.monthlyLimit > 0 ? Math.round((e.spent / e.monthlyLimit) * 100) : 0,
    }))
    .filter((e) => e.pct >= 85)
    .sort((a, b) => b.pct - a.pct)[0];

  // Income restocks the period's available budget — "remaining" isn't just
  // the original allowance draining down, a logged income bumps it back up.
  const available = data.totalBudget + data.income;
  const remaining = available - data.spent;
  const perDay = data.daysLeft > 0 ? Math.round(remaining / data.daysLeft) : 0;
  const pctUsed = available > 0 ? Math.round((data.spent / available) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="dashboard"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="lg:hidden">
          <DashboardHeader
            name={displayName}
            totalBudget={data.totalBudget}
            spent={data.spent}
            income={data.income}
            daysLeft={data.daysLeft}
            budgetFrequency={data.budgetFrequency}
            avatarUrl={user.avatarUrl}
          />
        </div>

        {/* Desktop top bar */}
        <div className="hidden items-center justify-between border-b border-border bg-card px-8 py-6 lg:flex">
          <h2 className="font-headings text-xl font-bold text-foreground">Tableau de bord</h2>
          <NotificationBell />
        </div>

        <div className="flex-1 px-4 pb-32 pt-6 lg:overflow-y-auto lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            {/* Desktop greeting — mobile gets its own inside DashboardHeader */}
            <div className="hidden lg:block">
              <h1 className="font-headings text-2xl font-bold text-foreground">
                {timeOfDayGreeting()}, {firstName(displayName)} {timeOfDayEmoji()}
              </h1>
              <p className="mt-1 font-body text-sm text-muted-foreground">{dailyTagline()}</p>
            </div>

            {/* Mobile alert nudge */}
            {mostUrgentEnvelope && (
              <div className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 lg:hidden">
                <Icon
                  i="alert-triangle"
                  size={18}
                  className="mt-0.5 flex-shrink-0 text-accent-foreground"
                />
                <p className="font-body text-sm leading-snug text-accent-foreground">
                  {mostUrgentEnvelope.name} à {mostUrgentEnvelope.pct}% —{' '}
                  {mostUrgentEnvelope.pct >= 100
                    ? 'budget déjà dépassé.'
                    : 'tu risques de dépasser le budget.'}
                </p>
              </div>
            )}

            {/* Desktop stat cards */}
            <div className="hidden grid-cols-3 gap-6 lg:grid">
              <div className="col-span-2 rounded-lg bg-primary p-8 text-primary-foreground">
                <p className="mb-2 font-body text-sm opacity-70">
                  Reste {budgetPeriodLabel(data.budgetFrequency)}
                </p>
                <p className="mb-1 font-headings text-5xl font-bold leading-none">
                  {formatPrice(remaining)}
                  <span className="ml-3 font-body text-2xl font-normal opacity-80">FCFA</span>
                </p>
                <p className="mb-2 font-body text-sm opacity-70">
                  sur {formatPrice(data.totalBudget)} FCFA au total
                </p>
                <p className="mb-6 font-body text-xs opacity-60">
                  Soit {formatPrice(perDay)} FCFA / jour
                </p>
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-sm opacity-70">
                    <span>{formatPrice(data.spent)} F dépensés</span>
                    <span>{data.daysLeft} j. restants</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${Math.min(pctUsed, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs opacity-70">{pctUsed}% du budget utilisé</p>
              </div>

              <div className="flex flex-col gap-6">
                {mostUrgentEnvelope ? (
                  <div className="flex flex-1 flex-col justify-center rounded-lg bg-accent p-6 text-accent-foreground">
                    <div className="mb-4 flex gap-2">
                      <Icon i="alert-triangle" size={18} className="mt-0.5 flex-shrink-0" />
                      <p className="font-body text-sm leading-snug">
                        {mostUrgentEnvelope.name} à {mostUrgentEnvelope.pct}%
                      </p>
                    </div>
                    <p className="font-body text-xs opacity-80">
                      {mostUrgentEnvelope.pct >= 100
                        ? 'Budget déjà dépassé pour cette enveloppe.'
                        : 'Tu risques de dépasser avant la fin de la période.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-center rounded-lg border border-border bg-card p-6">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon i="check-circle" size={18} className="text-primary" />
                      <p className="font-body text-sm font-medium text-foreground">Tout va bien</p>
                    </div>
                    <p className="font-body text-xs text-muted-foreground">
                      Aucune enveloppe proche de sa limite.
                    </p>
                  </div>
                )}

                <Link
                  href="/envelopes"
                  className="flex flex-1 flex-col justify-center rounded-lg border border-dashed border-border bg-card p-6 text-center hover:border-primary"
                >
                  <Icon i="plus-circle" size={20} className="mx-auto mb-2 text-primary" />
                  <p className="font-body text-xs font-medium text-primary">Gérer mes enveloppes</p>
                </Link>
              </div>
            </div>

            <Link
              href="/insights"
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary lg:p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                  <Icon i="trending-up" size={18} className="text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-body text-sm font-medium text-foreground">
                    Voir tes tendances
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    Comparaisons, répartition par enveloppe, projections d&apos;objectifs
                  </p>
                </div>
              </div>
              <Icon i="chevron-right" size={18} className="flex-shrink-0 text-muted-foreground" />
            </Link>

            {/* Envelopes */}
            <div>
              <div className="mb-3 flex items-center justify-between lg:mb-4">
                <h2 className="font-headings text-base font-bold text-foreground lg:text-lg">
                  Mes enveloppes
                </h2>
                <Link
                  href="/envelopes"
                  className="font-body text-xs font-medium text-primary lg:text-sm"
                >
                  Voir tout
                </Link>
              </div>
              {data.envelopes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                  <p className="mb-3 font-body text-sm text-muted-foreground">
                    Tu n&apos;as pas encore d&apos;enveloppe.
                  </p>
                  <Link href="/envelopes" className="font-body text-sm font-medium text-primary">
                    Crée ta première enveloppe
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                  {data.envelopes.map((e) => (
                    <EnvelopeCard
                      key={e.id}
                      name={e.name}
                      icon={e.icon as IconName}
                      spent={e.spent}
                      total={e.monthlyLimit}
                      color={e.color as EnvelopeSwatchKey}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recent transactions */}
            <div>
              <div className="mb-1 flex items-center justify-between lg:mb-4">
                <h2 className="font-headings text-base font-bold text-foreground lg:text-lg">
                  Dernières dépenses
                </h2>
                <div className="flex items-center gap-3">
                  <Link
                    href="/transactions/new"
                    aria-label="Ajouter une transaction"
                    className="flex items-center gap-1 font-body text-xs font-medium text-primary lg:text-sm"
                  >
                    <Icon i="plus-circle" size={16} />
                    Ajouter
                  </Link>
                  <Link
                    href="/history"
                    className="font-body text-xs font-medium text-primary lg:text-sm"
                  >
                    Tout voir
                  </Link>
                </div>
              </div>
              {data.recentTransactions.length === 0 ? (
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
              ) : (
                <div className="rounded-lg border border-border bg-card px-4 lg:px-6 lg:divide-y lg:divide-border">
                  {data.recentTransactions.map((t) => (
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
              )}
            </div>
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
