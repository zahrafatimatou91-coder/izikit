'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { EnvelopesSkeleton } from '@/components/skeletons/EnvelopesSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { MobileDrawerNav } from '@/components/nav/MobileDrawerNav';
import { EnvelopeForm, type EnvelopeFormValues } from '@/components/envelopes/EnvelopeForm';
import { envelopeSwatch, type EnvelopeSwatchKey } from '@/lib/envelope-colors';
import { formatPrice } from '@/lib/utils';

interface EnvelopeRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyLimit: number;
  spent: number;
}

export default function EnvelopesPage() {
  const user = useUser();
  const [envelopes, setEnvelopes] = useState<EnvelopeRow[] | null>(null);
  const [summary, setSummary] = useState<{
    totalBudget: number | null;
    spent: number;
    income: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'none' | 'create' | string>('none');
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [envRes, dashRes] = await Promise.all([
        api<{ envelopes: EnvelopeRow[] }>('/api/envelopes'),
        api<{ totalBudget: number | null; spent: number; income: number }>('/api/dashboard'),
      ]);
      setEnvelopes(envRes.envelopes);
      setSummary({
        totalBudget: dashRes.totalBudget,
        spent: dashRes.spent,
        income: dashRes.income,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user) return <EnvelopesSkeleton />;
  if (envelopes === null && !error) return <EnvelopesSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  async function handleCreate(values: EnvelopeFormValues) {
    setSubmitting(true);
    try {
      await api('/api/envelopes', { method: 'POST', body: values });
      setFormMode('none');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string, values: EnvelopeFormValues) {
    setSubmitting(true);
    try {
      await api(`/api/envelopes/${id}`, { method: 'PATCH', body: values });
      setFormMode('none');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        'Supprimer cette enveloppe ? Les transactions liées resteront dans ton historique.',
      )
    )
      return;
    try {
      await api(`/api/envelopes/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    }
  }

  const remaining = summary ? (summary.totalBudget ?? 0) + summary.income - summary.spent : 0;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="envelopes"
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
              Mes enveloppes
            </h2>
          </div>
          <NotificationBell />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            {summary && (
              <div className="flex flex-col gap-4 rounded-lg bg-input p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 font-body text-sm text-muted-foreground">Budget total</p>
                  <p className="font-headings text-2xl font-bold text-foreground lg:text-3xl">
                    {formatPrice(summary.totalBudget ?? 0)}{' '}
                    <span className="font-body text-base font-normal text-muted-foreground">
                      FCFA
                    </span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="mb-1 font-body text-sm text-muted-foreground">Dépensé ce mois</p>
                  <p className="font-headings text-2xl font-bold text-muted-foreground lg:text-3xl">
                    {formatPrice(summary.spent)}{' '}
                    <span className="font-body text-base font-normal">FCFA</span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="mb-1 font-body text-sm text-muted-foreground">Restant</p>
                  <p className="font-headings text-2xl font-bold text-primary lg:text-3xl">
                    {formatPrice(remaining)}{' '}
                    <span className="font-body text-base font-normal text-muted-foreground">
                      FCFA
                    </span>
                  </p>
                </div>
              </div>
            )}

            {envelopes && envelopes.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
                {envelopes.map((e) =>
                  formMode === e.id ? (
                    <EnvelopeForm
                      key={e.id}
                      initial={{
                        name: e.name,
                        icon: e.icon as IconName,
                        color: e.color as EnvelopeSwatchKey,
                        monthlyLimit: e.monthlyLimit,
                      }}
                      submitLabel="Enregistrer"
                      submitting={submitting}
                      onSubmit={(values) => handleUpdate(e.id, values)}
                      onCancel={() => setFormMode('none')}
                    />
                  ) : (
                    <div key={e.id} className="rounded-lg border border-border bg-card p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${envelopeSwatch(e.color).bg}`}
                          >
                            <Icon
                              i={e.icon as IconName}
                              size={18}
                              className={envelopeSwatch(e.color).text}
                            />
                          </div>
                          <h4 className="font-headings text-base font-bold text-foreground">
                            {e.name}
                          </h4>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label="Modifier"
                            onClick={() => setFormMode(e.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <Icon i="edit-2" size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="Supprimer"
                            onClick={() => handleDelete(e.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <Icon i="trash-2" size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="mb-2 flex justify-between">
                            <span className="font-body text-sm text-foreground">Dépensé</span>
                            <span className="font-body text-sm font-medium text-foreground">
                              {formatPrice(e.spent)} F
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${envelopeSwatch(e.color).bg}`}
                              style={{
                                width: `${e.monthlyLimit > 0 ? Math.min(Math.round((e.spent / e.monthlyLimit) * 100), 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total budgété</span>
                          <span className="font-body font-medium text-foreground">
                            {formatPrice(e.monthlyLimit)} F
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            {envelopes && envelopes.length === 0 && formMode === 'none' && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">
                  Tu n&apos;as pas encore d&apos;enveloppe.
                </p>
              </div>
            )}

            {formMode === 'create' ? (
              <EnvelopeForm
                submitLabel="Ajouter"
                submitting={submitting}
                onSubmit={handleCreate}
                onCancel={() => setFormMode('none')}
              />
            ) : (
              <button
                type="button"
                onClick={() => setFormMode('create')}
                className="flex w-fit items-center gap-2 rounded-lg bg-primary px-6 py-3 font-body text-sm font-medium text-primary-foreground"
              >
                <Icon i="plus" size={18} />
                Ajouter une enveloppe
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>

      <MobileDrawerNav
        active="envelopes"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
