'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';
import {
  AdminPageHeader,
  InlineError,
  PlanBadge,
  SectionCard,
  StatCard,
} from '@/components/admin/primitives';

interface Overview {
  users: {
    total: number;
    byPlan: { free: number; pro: number };
    activeTrials: number;
    newLast30d: number;
  };
  signups: { month: string; count: number }[];
  revenue: { mrrFcfa: number; paidSubs: number; arpuFcfa: number };
  system: { db: boolean; redis: boolean; email: boolean; payments: boolean };
  recentUsers: {
    id: string;
    name: string | null;
    email: string;
    plan: string;
    createdAt: string;
  }[];
}

const MONTH_LABELS = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'aoû',
  'sep',
  'oct',
  'nov',
  'déc',
];

function monthLabel(key: string): string {
  const m = Number(key.split('-')[1]);
  return MONTH_LABELS[m - 1] ?? key;
}

function SystemRow({
  label,
  ok,
  offLabel = 'Non configuré',
}: {
  label: string;
  ok: boolean;
  offLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-primary' : 'bg-muted-foreground'}`} />
        <p className="font-body text-sm text-foreground">{label}</p>
      </div>
      <p className={`font-body text-xs font-bold ${ok ? 'text-primary' : 'text-muted-foreground'}`}>
        {ok ? 'OK' : offLabel}
      </p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<Overview>('/api/admin/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxSignups = data ? Math.max(1, ...data.signups.map((s) => s.count)) : 1;

  return (
    <div>
      <AdminPageHeader title="Vue d'ensemble" />

      {error && <InlineError message={error} onRetry={load} />}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Utilisateurs"
          icon="users"
          loading={!data}
          value={data ? data.users.total.toLocaleString('fr-FR') : ''}
          hint={data ? `+${data.users.newLast30d} sur 30 j` : undefined}
        />
        <StatCard
          label="Abonnés Pro"
          icon="crown"
          loading={!data}
          value={data ? data.users.byPlan.pro.toLocaleString('fr-FR') : ''}
          hint={data ? `${data.users.activeTrials} en essai` : undefined}
        />
        <StatCard
          label="MRR estimé"
          icon="trending-up"
          loading={!data}
          value={data ? `${formatPrice(data.revenue.mrrFcfa)} F` : ''}
          hint={data ? `${data.revenue.paidSubs} abonnements payants` : undefined}
        />
        <StatCard
          label="ARPU"
          icon="gauge"
          loading={!data}
          value={data ? `${formatPrice(data.revenue.arpuFcfa)} F` : ''}
          hint="par abonné payant / mois"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Inscriptions" description="6 derniers mois">
          <div className="flex h-44 items-end justify-between gap-2 px-5 py-5">
            {(data?.signups ?? Array.from({ length: 6 }, () => ({ month: '', count: 0 }))).map(
              (s, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <span className="font-body text-[11px] font-medium text-muted-foreground">
                    {s.count || ''}
                  </span>
                  <div
                    className="w-full rounded bg-primary/30"
                    style={{ height: `${data ? (s.count / maxSignups) * 100 : 0}%`, minHeight: 4 }}
                  />
                  <p className="font-body text-[11px] text-muted-foreground">
                    {s.month ? monthLabel(s.month) : ''}
                  </p>
                </div>
              ),
            )}
          </div>
        </SectionCard>

        <SectionCard title="État du système">
          <div className="space-y-4 px-5 py-5">
            <SystemRow label="Base de données" ok={data?.system.db ?? false} offLabel="HS" />
            <SystemRow label="Redis (cache / rate-limit)" ok={data?.system.redis ?? false} />
            <SystemRow label="Emails (Resend)" ok={data?.system.email ?? false} />
            <SystemRow label="Paiements" ok={data?.system.payments ?? false} />
            <p className="border-t border-input pt-3 font-body text-xs text-muted-foreground">
              Présence des clés d&apos;environnement uniquement — aucune valeur secrète n&apos;est
              lue. Gère la bannière d&apos;annonce dans{' '}
              <Link href="/admin/config" className="text-primary underline">
                Configuration
              </Link>
              .
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Nouveaux utilisateurs"
        action={
          <Link
            href="/admin/users"
            className="font-body text-xs font-medium text-primary hover:underline"
          >
            Voir tout
          </Link>
        }
      >
        <div className="divide-y divide-input">
          {!data &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse bg-muted/40" />
            ))}
          {data?.recentUsers.length === 0 && (
            <p className="px-5 py-8 text-center font-body text-sm text-muted-foreground">
              Aucun utilisateur pour l&apos;instant.
            </p>
          )}
          {data?.recentUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => router.push(`/admin/users/${u.id}`)}
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-input"
            >
              <div className="min-w-0">
                <p className="truncate font-body text-sm font-bold text-foreground">
                  {u.name ?? u.email.split('@')[0]}
                </p>
                <p className="truncate font-body text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <PlanBadge plan={u.plan} />
                <span className="hidden font-body text-xs text-muted-foreground sm:inline">
                  {new Date(u.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <Icon i="chevron-right" size={14} className="text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
