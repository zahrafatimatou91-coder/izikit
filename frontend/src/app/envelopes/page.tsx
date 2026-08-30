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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EnvelopeForm, type EnvelopeFormValues } from '@/components/envelopes/EnvelopeForm';
import { envelopeSwatch, type EnvelopeSwatchKey } from '@/lib/envelope-colors';
import { formatPrice } from '@/lib/utils';
import { computeBudgetSummary } from '@/lib/budget-summary';

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
  // Shown inline under the Nom field of whichever form is open, instead of
  // the page banner above — it's a 2-second fix (retype the name).
  const [nameError, setNameError] = useState<string | null>(null);
  // Same idea, for the "this exceeds your total budget" guard on
  // monthlyLimit.
  const [limitError, setLimitError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'none' | 'create' | string>('none');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Every entry point that opens/closes/switches a form clears stale
  // errors from whichever form was previously open.
  function openForm(mode: 'none' | 'create' | string) {
    setNameError(null);
    setLimitError(null);
    setFormMode(mode);
  }

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

  function handleFormError(err: unknown) {
    // ApiError.message is the stable code (see lib/api.ts) — the friendly
    // French sentence lives in the response body instead.
    const bodyMessage = err instanceof ApiError ? err.body['message'] : null;
    if (err instanceof ApiError && err.code === 'ENVELOPE_NAME_TAKEN') {
      setNameError(typeof bodyMessage === 'string' ? bodyMessage : 'Ce nom est déjà pris.');
      return;
    }
    if (err instanceof ApiError && err.code === 'ENVELOPE_BUDGET_EXCEEDED') {
      setLimitError(
        typeof bodyMessage === 'string' ? bodyMessage : 'Ce montant dépasse ton budget total.',
      );
      return;
    }
    setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
  }

  async function handleCreate(values: EnvelopeFormValues) {
    setSubmitting(true);
    setNameError(null);
    setLimitError(null);
    try {
      await api('/api/envelopes', { method: 'POST', body: values });
      setFormMode('none');
      await load();
    } catch (err) {
      handleFormError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string, values: EnvelopeFormValues) {
    setSubmitting(true);
    setNameError(null);
    setLimitError(null);
    try {
      await api(`/api/envelopes/${id}`, { method: 'PATCH', body: values });
      setFormMode('none');
      await load();
    } catch (err) {
      handleFormError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/envelopes/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setDeleting(false);
    }
  }

  const remaining = summary
    ? computeBudgetSummary({
        totalBudget: summary.totalBudget ?? 0,
        income: summary.income,
        spent: summary.spent,
      }).remaining
    : 0;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="envelopes"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-32 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
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
                      nameError={formMode === e.id ? nameError : null}
                      onNameEdited={() => setNameError(null)}
                      limitError={formMode === e.id ? limitError : null}
                      onLimitEdited={() => setLimitError(null)}
                      onSubmit={(values) => handleUpdate(e.id, values)}
                      onCancel={() => openForm('none')}
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
                            onClick={() => openForm(e.id)}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <Icon i="edit-2" size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="Supprimer"
                            onClick={() => setDeleteTarget({ id: e.id, name: e.name })}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
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
                nameError={nameError}
                onNameEdited={() => setNameError(null)}
                limitError={limitError}
                onLimitEdited={() => setLimitError(null)}
                onSubmit={handleCreate}
                onCancel={() => openForm('none')}
              />
            ) : (
              <button
                type="button"
                onClick={() => openForm('create')}
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
      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget ? `Supprimer « ${deleteTarget.name} » ?` : 'Supprimer cette enveloppe ?'
        }
        description="Les transactions déjà liées resteront dans ton historique."
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        destructive
        confirming={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
