// /transactions/[id]/edit — reuses TransactionForm (see /transactions/new)
// pre-filled from GET /api/transactions/[id]. Deleting a transaction is
// deliberately NOT duplicated here — it lives in the row's own menu
// (TransactionRow), the single entry point for that action.
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import {
  TransactionForm,
  type TransactionFormInitial,
  type TransactionFormValues,
} from '@/components/transactions/TransactionForm';

interface TransactionDetail {
  id: string;
  amount: number;
  label: string;
  envelope: { id: string; name: string; icon: string } | null;
}

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();
  const [initial, setInitial] = useState<TransactionFormInitial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ transaction: TransactionDetail }>(`/api/transactions/${id}`)
      .then((res) =>
        setInitial({
          amount: res.transaction.amount,
          label: res.transaction.label,
          envelopeId: res.transaction.envelope?.id ?? null,
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Transaction introuvable.'));
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  async function handleUpdate(values: TransactionFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/transactions/${id}`, { method: 'PATCH', body: values });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
          <Icon i="arrow-left" size={20} />
        </Link>
        <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
          Modifier la transaction
        </h2>
      </div>

      <div className="flex flex-1 justify-center px-4 py-8 lg:px-8">
        <div className="flex w-full max-w-lg flex-col gap-4">
          {error && (
            <p role="alert" className="font-body text-sm text-accent">
              {error}
            </p>
          )}
          {initial && (
            <TransactionForm
              initial={initial}
              submitLabel="Enregistrer les modifications"
              submitting={submitting}
              onSubmit={handleUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
