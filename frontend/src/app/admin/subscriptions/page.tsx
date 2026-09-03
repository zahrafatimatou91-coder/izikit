'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdmin } from '@/components/admin/AdminContext';
import {
  AdminPageHeader,
  Badge,
  InlineError,
  PlanBadge,
  SubStatusBadge,
} from '@/components/admin/primitives';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { useCursorList } from '@/components/admin/useCursorList';

interface SettingsResponse {
  settings: {
    'subscription.pricing': { value: { monthly: number; annual: number }; isDefault: boolean };
  };
  trialDays: number;
}

interface SubRow {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  status: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  effectivePlan: string;
  isTrial: boolean;
  isComp: boolean;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const { isSuperadmin } = useAdmin();
  const { toast } = useToast();

  const [pricing, setPricing] = useState<{ monthly: number; annual: number } | null>(null);
  const [trialDays, setTrialDays] = useState<number>(7);
  const [pricingIsDefault, setPricingIsDefault] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [draftMonthly, setDraftMonthly] = useState('');
  const [draftAnnual, setDraftAnnual] = useState('');
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filter, setFilter] = useState<'' | 'trial' | 'paid' | 'expiring'>('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await api<SettingsResponse>('/api/admin/settings');
      const p = res.settings['subscription.pricing'].value;
      setPricing(p);
      setPricingIsDefault(res.settings['subscription.pricing'].isDefault);
      setTrialDays(res.trialDays);
      setDraftMonthly(String(p.monthly));
      setDraftAnnual(String(p.annual));
      setSettingsError(null);
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '20' };
    if (filter) p[filter] = '1';
    return p;
  }, [filter]);

  const list = useCursorList<SubRow>('/api/admin/subscriptions', params);

  const monthlyNum = Number(draftMonthly);
  const annualNum = Number(draftAnnual);
  const draftValid =
    Number.isInteger(monthlyNum) &&
    monthlyNum >= 100 &&
    Number.isInteger(annualNum) &&
    annualNum >= 100;
  const draftChanged =
    pricing != null && (monthlyNum !== pricing.monthly || annualNum !== pricing.annual);

  async function savePricing() {
    setSaving(true);
    try {
      await api('/api/admin/settings', {
        method: 'PATCH',
        body: { key: 'subscription.pricing', value: { monthly: monthlyNum, annual: annualNum } },
      });
      toast('Tarifs Pro mis à jour.', 'success');
      await loadSettings();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Enregistrement impossible.', 'error');
    } finally {
      setSaving(false);
      setConfirmSave(false);
    }
  }

  const columns: Column<SubRow>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      width: '200px',
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground">
            {s.userName ?? s.userEmail?.split('@')[0] ?? s.userId}
          </p>
          <p className="truncate text-xs text-muted-foreground">{s.userEmail ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Type',
      render: (s) => <PlanBadge plan={s.effectivePlan} isTrial={s.isTrial} isComp={s.isComp} />,
    },
    { key: 'status', header: 'Statut', render: (s) => <SubStatusBadge status={s.status} /> },
    {
      key: 'start',
      header: 'Début',
      render: (s) => <span className="text-xs text-muted-foreground">{fmtDate(s.createdAt)}</span>,
    },
    {
      key: 'end',
      header: 'Échéance',
      render: (s) => (
        <span className="text-xs text-muted-foreground">{fmtDate(s.currentPeriodEnd)}</span>
      ),
    },
    {
      key: 'go',
      header: '',
      align: 'right',
      render: () => <Icon i="chevron-right" size={16} className="text-muted-foreground" />,
    },
  ];

  return (
    <div>
      <AdminPageHeader title="Abonnements" />

      {settingsError && <InlineError message={settingsError} />}

      {/* Plan cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-input bg-card p-6">
          <h3 className="font-headings text-base font-bold text-foreground">Free</h3>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            Plan par défaut, non modifiable
          </p>
          <p className="mt-4 font-headings text-2xl font-bold text-foreground">0 F</p>
          <ul className="mt-4 space-y-1.5 font-body text-sm text-foreground">
            {['2 enveloppes', 'Historique 2 mois', 'Tableau de bord complet'].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Icon i="check" size={14} className="text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border-2 border-primary bg-primary/5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-headings text-base font-bold text-foreground">Pro</h3>
            <Badge tone="gold" icon="crown">
              Payant
            </Badge>
          </div>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            {pricingIsDefault ? 'Tarif par défaut' : 'Tarif personnalisé'} · essai {trialDays} j
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-body text-xs font-medium text-muted-foreground">
                FCFA / mois
              </span>
              <input
                inputMode="numeric"
                value={draftMonthly}
                onChange={(e) => setDraftMonthly(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={!isSuperadmin || pricing == null}
                className="rounded-lg border border-border bg-card px-3 py-2 font-headings text-lg font-bold text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-body text-xs font-medium text-muted-foreground">FCFA / an</span>
              <input
                inputMode="numeric"
                value={draftAnnual}
                onChange={(e) => setDraftAnnual(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={!isSuperadmin || pricing == null}
                className="rounded-lg border border-border bg-card px-3 py-2 font-headings text-lg font-bold text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </label>
          </div>

          {isSuperadmin ? (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmSave(true)}
                disabled={!draftValid || !draftChanged || saving}
                className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                Enregistrer
              </button>
              {draftChanged && draftValid && (
                <button
                  type="button"
                  onClick={() => {
                    if (!pricing) return;
                    setDraftMonthly(String(pricing.monthly));
                    setDraftAnnual(String(pricing.annual));
                  }}
                  className="font-body text-xs text-muted-foreground underline"
                >
                  Annuler
                </button>
              )}
              {!draftValid && (
                <span className="font-body text-xs text-accent">Minimum 100 FCFA, entier.</span>
              )}
            </div>
          ) : (
            <p className="mt-4 font-body text-xs text-muted-foreground">
              Seul un superadmin peut modifier les tarifs.
            </p>
          )}
        </div>
      </div>

      {/* Active subscriptions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-headings text-base font-bold text-foreground">Abonnements</span>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['', 'Tous'],
              ['paid', 'Payants'],
              ['trial', 'Essais'],
              ['expiring', 'Expirent < 7 j'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`rounded-full px-3 py-1 font-body text-xs font-medium ${
                filter === val
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:bg-input'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.error && <InlineError message={list.error} />}

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(s) => s.id}
        onRowClick={(s) => router.push(`/admin/users/${s.userId}`)}
        emptyLabel="Aucun abonnement."
        busy={list.busy}
        pager={{
          hasPrev: list.hasPrev,
          hasNext: list.hasNext,
          onPrev: list.prev,
          onNext: list.next,
          rangeLabel: list.items ? `${list.items.length} sur cette page` : '',
        }}
      />

      <ConfirmDialog
        open={confirmSave}
        title="Modifier les tarifs Pro ?"
        description="Le nouveau tarif s'applique immédiatement à tout nouveau paiement. Les périodes déjà payées ne changent pas."
        confirmLabel={saving ? 'Enregistrement…' : 'Confirmer'}
        confirming={saving}
        onConfirm={savePricing}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}
