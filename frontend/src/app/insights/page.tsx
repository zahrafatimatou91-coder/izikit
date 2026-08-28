// /insights — "Tendances". Deliberately NOT a duplicate of Notifications:
// notifications push a one-off alert the moment a threshold/pace event
// happens; this page is a standing, browsable view of trends notifications
// never show — period-over-period comparison, per-envelope breakdown for
// an arbitrary (not just "current") period, and a projected completion
// date per savings goal. See .planning conversation log — built to
// replace the value "Conseils" (static generic tips) was meant to provide,
// with real data instead of editorial content.
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { InsightsSkeleton } from '@/components/skeletons/InsightsSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { MobileDrawerNav } from '@/components/nav/MobileDrawerNav';
import { formatPrice } from '@/lib/utils';

type Range = 'this_week' | 'this_month' | 'last_month' | 'last_3_months';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'this_week', label: 'Cette semaine' },
  { value: 'this_month', label: 'Ce mois-ci' },
  { value: 'last_month', label: 'Le mois dernier' },
  { value: 'last_3_months', label: '3 derniers mois' },
];

const MONTHS_FR_FULL = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

interface EnvelopeBreakdown {
  id: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  monthlyLimit: number;
  pctOfLimit: number;
}

interface GoalProjection {
  id: string;
  name: string;
  icon: string;
  currentAmount: number;
  targetAmount: number;
  completed: boolean;
  ratePerDay: number | null;
  projectedDate: string | null;
}

interface InsightsData {
  range: Range;
  period: { label: string; start: string; end: string };
  totalBudget: number | null;
  totalSpent: number;
  totalIncome: number;
  previousSpent: number;
  previousIncome: number;
  savedInPeriod: number;
  byEnvelope: EnvelopeBreakdown[];
  goalProjections: GoalProjection[];
}

/** null when there's nothing sensible to compare against (no spend/income
 * at all in the previous period) — showing "+∞%" would be meaningless. */
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function InsightsPage() {
  const user = useUser();
  const [range, setRange] = useState<Range>('this_month');
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async (r: Range) => {
    try {
      const res = await api<InsightsData>(`/api/insights?range=${r}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    if (user) void load(range);
  }, [user, range, load]);

  if (!user) return <InsightsSkeleton />;
  if (data === null && !error) return <InsightsSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  const spentDelta = data ? delta(data.totalSpent, data.previousSpent) : null;
  const incomeDelta = data ? delta(data.totalIncome, data.previousIncome) : null;
  const hasActivity = data ? data.totalSpent > 0 || data.totalIncome > 0 : false;
  const topEnvelope = data?.byEnvelope.find((e) => e.spent > 0) ?? null;
  const underused = data?.byEnvelope.find((e) => e.monthlyLimit > 0 && e.pctOfLimit <= 20) ?? null;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="insights"
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
              Tendances
            </h2>
          </div>
          <NotificationBell />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:gap-8">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            {/* Date-range selector — presets rather than a free calendar
                picker, matching the app's existing budget-period / savings-
                pace convention. */}
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={`rounded-lg border px-4 py-2 font-body text-sm font-medium ${
                    range === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-input text-muted-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {data && !hasActivity && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">
                  Aucune transaction sur {data.period.label.toLowerCase()}.
                </p>
              </div>
            )}

            {data && hasActivity && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border bg-card p-6">
                    <p className="mb-1 font-body text-xs text-muted-foreground">Dépensé</p>
                    <p className="font-headings text-xl font-bold text-foreground lg:text-2xl">
                      {formatPrice(data.totalSpent)} F
                    </p>
                    {spentDelta !== null && (
                      <p
                        className={`mt-1 font-body text-xs font-medium ${spentDelta > 0 ? 'text-accent' : 'text-primary'}`}
                      >
                        {spentDelta > 0 ? '+' : ''}
                        {spentDelta}% vs période précédente
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-card p-6">
                    <p className="mb-1 font-body text-xs text-muted-foreground">Revenu</p>
                    <p className="font-headings text-xl font-bold text-foreground lg:text-2xl">
                      {formatPrice(data.totalIncome)} F
                    </p>
                    {incomeDelta !== null && (
                      <p
                        className={`mt-1 font-body text-xs font-medium ${incomeDelta < 0 ? 'text-accent' : 'text-primary'}`}
                      >
                        {incomeDelta > 0 ? '+' : ''}
                        {incomeDelta}% vs période précédente
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-card p-6">
                    <p className="mb-1 font-body text-xs text-muted-foreground">Épargné</p>
                    <p className="font-headings text-xl font-bold text-primary lg:text-2xl">
                      {formatPrice(data.savedInPeriod)} F
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="mb-4 font-headings text-base font-bold text-foreground">
                    Répartition par enveloppe
                  </h3>
                  {data.byEnvelope.filter((e) => e.spent > 0).length === 0 ? (
                    <p className="font-body text-sm text-muted-foreground">
                      Aucune dépense catégorisée sur cette période.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {data.byEnvelope
                        .filter((e) => e.spent > 0)
                        .map((e) => (
                          <div key={e.id}>
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon
                                  i={e.icon as IconName}
                                  size={14}
                                  className="text-muted-foreground"
                                />
                                <span className="font-body text-sm text-foreground">{e.name}</span>
                                {topEnvelope?.id === e.id && (
                                  <span className="rounded-full bg-accent/10 px-2 py-0.5 font-body text-[10px] font-medium text-accent">
                                    Plus grosse dépense
                                  </span>
                                )}
                              </div>
                              <span className="font-body text-sm font-medium text-foreground">
                                {formatPrice(e.spent)} F
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(e.pctOfLimit, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  {underused && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-secondary/10 p-3">
                      <Icon i="info" size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                      <p className="font-body text-xs text-foreground">
                        {underused.name} n&apos;utilise que {underused.pctOfLimit}% de son budget —
                        de la marge à rediriger vers un objectif d&apos;épargne, si tu veux.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 font-headings text-base font-bold text-foreground">
                Projection de tes objectifs
              </h3>
              {!data || data.goalProjections.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">
                  Tu n&apos;as pas encore d&apos;objectif d&apos;épargne.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {data.goalProjections.map((g) => {
                    const pct =
                      g.targetAmount > 0
                        ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
                        : 0;
                    return (
                      <div key={g.id} className="rounded-lg bg-input p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon i={g.icon as IconName} size={16} className="text-foreground" />
                            <span className="font-body text-sm font-medium text-foreground">
                              {g.name}
                            </span>
                          </div>
                          <span className="font-body text-xs font-bold text-foreground">
                            {pct}%
                          </span>
                        </div>
                        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${g.completed ? 'bg-secondary' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="font-body text-xs text-muted-foreground">
                          {g.completed
                            ? 'Objectif atteint 🎉'
                            : g.projectedDate
                              ? `À ce rythme, atteint vers le ${formatLongDate(g.projectedDate)}`
                              : "Pas encore assez d'économies enregistrées pour estimer une date."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>

      <MobileDrawerNav
        active="insights"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
