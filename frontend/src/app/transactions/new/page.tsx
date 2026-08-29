// No Banani source for this screen — the design only covers "Ajouter une
// économie" (savings). We design "Ajouter une transaction" ourselves,
// mobile-first, following the same interaction pattern (top bar with back
// button, card-based form, quick amount buttons).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import {
  TransactionForm,
  type TransactionFormValues,
} from '@/components/transactions/TransactionForm';

export default function NewTransactionPage() {
  const user = useUser();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <FormPageSkeleton />;

  async function handleCreate(values: TransactionFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/transactions', { method: 'POST', body: values });
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
        <Link
          href="/dashboard"
          aria-label="Retour"
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon i="arrow-left" size={20} />
        </Link>
        <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
          Ajouter une transaction
        </h2>
      </div>

      <div className="flex flex-1 justify-center px-4 py-8 lg:px-8">
        <div className="flex w-full max-w-lg flex-col gap-4">
          {error && (
            <p role="alert" className="font-body text-sm text-accent">
              {error}
            </p>
          )}
          <TransactionForm
            submitLabel="Enregistrer"
            submitting={submitting}
            onSubmit={handleCreate}
          />
        </div>
      </div>
    </div>
  );
}
