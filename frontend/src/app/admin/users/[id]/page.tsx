'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdmin } from '@/components/admin/AdminContext';
import {
  AdminPageHeader,
  InlineError,
  OrderStatusBadge,
  PlanBadge,
  SectionCard,
  SubStatusBadge,
  UserStatusBadge,
} from '@/components/admin/primitives';

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  country: string | null;
  totalBudget: number | null;
  budgetFrequency: string | null;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    createdAt: string;
    effectivePlan: string;
    isTrial: boolean;
    isComp: boolean;
  } | null;
  counts: {
    envelopes: number;
    envelopesArchived: number;
    savingsGoals: number;
    savingsGoalsArchived: number;
    transactions: number;
    orders: number;
  };
  recentOrders: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    paymentMethod: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="font-body text-sm text-muted-foreground">{label}</span>
      <span className="font-body text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isSuperadmin } = useAdmin();
  const { toast } = useToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'suspend' | 'restore' | 'revoke'>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ user: UserDetail }>(`/api/admin/users/${id}`);
      setUser(res.user);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (key: string, fn: () => Promise<unknown>, successMsg: string) => {
      setPending(key);
      try {
        await fn();
        toast(successMsg, 'success');
        await load();
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Action impossible. Réessaie.', 'error');
      } finally {
        setPending(null);
        setConfirm(null);
      }
    },
    [load, toast],
  );

  const changeRole = (role: string) =>
    runAction(
      `role:${role}`,
      () => api(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
      `Rôle changé en ${role}.`,
    );

  const setStatus = (status: 'ACTIVE' | 'SUSPENDED') =>
    runAction(
      `status:${status}`,
      () => api(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
      status === 'SUSPENDED' ? 'Compte suspendu.' : 'Compte réactivé.',
    );

  const grantPro = (period: 'monthly' | 'annual') =>
    runAction(
      `grant:${period}`,
      () =>
        api(`/api/admin/users/${id}/subscription`, {
          method: 'POST',
          body: { action: 'grant', period },
        }),
      `Pro offert (${period === 'annual' ? '1 an' : '1 mois'}).`,
    );

  const revokePro = () =>
    runAction(
      'revoke',
      () =>
        api(`/api/admin/users/${id}/subscription`, { method: 'POST', body: { action: 'revoke' } }),
      'Abonnement révoqué.',
    );

  if (error) {
    return (
      <div>
        <AdminPageHeader title="Utilisateur" />
        <InlineError message={error} onRetry={load} />
        <Link
          href="/admin/users"
          className="mt-4 inline-block font-body text-sm text-primary underline"
        >
          Retour à la liste
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <AdminPageHeader title="Utilisateur" />
        <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  const sub = user.subscription;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 font-body text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Icon i="arrow-left" size={14} />
          Utilisateurs
        </Link>
      </div>

      <AdminPageHeader title={user.name ?? user.email.split('@')[0] ?? 'Utilisateur'}>
        <UserStatusBadge status={user.status} />
        <PlanBadge
          plan={sub?.effectivePlan ?? 'FREE'}
          isTrial={sub?.isTrial ?? false}
          isComp={sub?.isComp ?? false}
        />
      </AdminPageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Identité">
          <div className="divide-y divide-input">
            <Row label="Email">{user.email}</Row>
            <Row label="Email vérifié">{user.emailVerifiedAt ? 'Oui' : 'Non'}</Row>
            <Row label="Rôle">{user.role}</Row>
            <Row label="Pays">{user.country ?? '—'}</Row>
            <Row label="Budget">
              {user.totalBudget != null
                ? `${formatPrice(user.totalBudget)} F / ${user.budgetFrequency ?? '?'}`
                : '—'}
            </Row>
            <Row label="Inscrit le">{fmtDate(user.createdAt)}</Row>
          </div>
        </SectionCard>

        <SectionCard title="Abonnement">
          <div className="divide-y divide-input">
            {sub ? (
              <>
                <Row label="Plan effectif">
                  <PlanBadge plan={sub.effectivePlan} isTrial={sub.isTrial} isComp={sub.isComp} />
                </Row>
                <Row label="Statut">
                  <SubStatusBadge status={sub.status} />
                </Row>
                <Row label="Échéance">{fmtDate(sub.currentPeriodEnd)}</Row>
                <Row label="Depuis">{fmtDate(sub.createdAt)}</Row>
              </>
            ) : (
              <p className="px-5 py-4 font-body text-sm text-muted-foreground">
                Aucun abonnement — cet utilisateur est sur le plan Free.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Activité">
          <div className="grid grid-cols-2 gap-px bg-input sm:grid-cols-4">
            {[
              {
                label: 'Enveloppes',
                value: user.counts.envelopes,
                archived: user.counts.envelopesArchived,
              },
              {
                label: 'Objectifs',
                value: user.counts.savingsGoals,
                archived: user.counts.savingsGoalsArchived,
              },
              { label: 'Transactions', value: user.counts.transactions, archived: 0 },
              { label: 'Commandes', value: user.counts.orders, archived: 0 },
            ].map((c) => (
              <div key={c.label} className="bg-card px-4 py-4 text-center">
                <p className="font-headings text-xl font-bold text-foreground">{c.value}</p>
                <p className="font-body text-[11px] tracking-wide text-muted-foreground uppercase">
                  {c.label}
                </p>
                {c.archived > 0 && (
                  <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                    +{c.archived} archivée{c.archived > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Derniers paiements">
          {user.recentOrders.length === 0 ? (
            <p className="px-5 py-4 font-body text-sm text-muted-foreground">Aucun paiement.</p>
          ) : (
            <div className="divide-y divide-input">
              {user.recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-body text-sm font-medium text-foreground">
                      {formatPrice(o.amount)} {o.currency}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {o.provider}
                      {o.paymentMethod ? ` · ${o.paymentMethod}` : ''} ·{' '}
                      {fmtDate(o.paidAt ?? o.createdAt)}
                    </p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Actions */}
      <SectionCard title="Actions" className="mt-6">
        <div className="flex flex-col gap-4 px-5 py-5">
          {/* Status */}
          <div className="flex flex-wrap items-center gap-2">
            {user.status === 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => setConfirm('suspend')}
                disabled={pending !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent px-3 py-2 font-body text-sm font-bold text-accent disabled:opacity-50"
              >
                <Icon i="ban" size={15} />
                Suspendre le compte
              </button>
            ) : isSuperadmin ? (
              <button
                type="button"
                onClick={() => setConfirm('restore')}
                disabled={pending !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-2 font-body text-sm font-bold text-primary disabled:opacity-50"
              >
                <Icon i="check" size={15} />
                Réactiver le compte
              </button>
            ) : (
              <p className="font-body text-xs text-muted-foreground">
                Compte suspendu — seul un superadmin peut le réactiver.
              </p>
            )}
          </div>

          {/* Role (SUPERADMIN) */}
          {isSuperadmin && (
            <div className="flex flex-wrap items-center gap-2 border-t border-input pt-4">
              <span className="font-body text-sm text-muted-foreground">Rôle&nbsp;:</span>
              {(['USER', 'ADMIN', 'SUPERADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => changeRole(r)}
                  disabled={pending !== null || user.role === r}
                  className="rounded-lg border border-border px-3 py-2 font-body text-sm font-medium text-foreground disabled:opacity-40 enabled:hover:bg-input"
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Comp Pro (SUPERADMIN) */}
          {isSuperadmin && (
            <div className="flex flex-wrap items-center gap-2 border-t border-input pt-4">
              <span className="font-body text-sm text-muted-foreground">Pro offert&nbsp;:</span>
              <button
                type="button"
                onClick={() => grantPro('monthly')}
                disabled={pending !== null}
                className="rounded-lg border border-secondary px-3 py-2 font-body text-sm font-bold text-secondary-foreground disabled:opacity-50 enabled:hover:bg-secondary/10"
              >
                +1 mois
              </button>
              <button
                type="button"
                onClick={() => grantPro('annual')}
                disabled={pending !== null}
                className="rounded-lg border border-secondary px-3 py-2 font-body text-sm font-bold text-secondary-foreground disabled:opacity-50 enabled:hover:bg-secondary/10"
              >
                +1 an
              </button>
              {sub?.effectivePlan === 'PRO' && (
                <button
                  type="button"
                  onClick={() => setConfirm('revoke')}
                  disabled={pending !== null}
                  className="rounded-lg border border-accent px-3 py-2 font-body text-sm font-bold text-accent disabled:opacity-50"
                >
                  Révoquer
                </button>
              )}
            </div>
          )}

          {!isSuperadmin && (
            <p className="border-t border-input pt-4 font-body text-xs text-muted-foreground">
              Le changement de rôle et la gestion Pro sont réservés aux superadmins.
            </p>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirm === 'suspend'}
        title="Suspendre ce compte ?"
        description="L'utilisateur ne pourra plus se connecter tant qu'un superadmin ne l'a pas réactivé."
        confirmLabel={pending ? 'Suspension…' : 'Suspendre'}
        destructive
        confirming={pending !== null}
        onConfirm={() => setStatus('SUSPENDED')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'restore'}
        title="Réactiver ce compte ?"
        description="L'utilisateur pourra de nouveau se connecter immédiatement."
        confirmLabel={pending ? 'Réactivation…' : 'Réactiver'}
        confirming={pending !== null}
        onConfirm={() => setStatus('ACTIVE')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        title="Révoquer l'abonnement Pro ?"
        description="Le compte repasse en Free immédiatement. Les enveloppes et objectifs au-delà des limites Free sont archivés (non supprimés)."
        confirmLabel={pending ? 'Révocation…' : 'Révoquer'}
        destructive
        confirming={pending !== null}
        onConfirm={revokePro}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
