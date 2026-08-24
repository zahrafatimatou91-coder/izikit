// No Banani source for this screen — AddEconomyDesktop.jsx assumes a goal
// already exists ("Transport malin" is hardcoded). We design the creation
// flow ourselves, following the same focused-task layout as
// /transactions/new (top bar + centered form, no app shell).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { SavingsGoalForm, type SavingsGoalFormValues } from '@/components/savings/SavingsGoalForm';

export default function NewSavingsGoalPage() {
  const user = useUser();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  async function handleCreate(values: SavingsGoalFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ goal: { id: string } }>('/api/savings-goals', {
        method: 'POST',
        body: values,
      });
      router.push(`/savings/${res.goal.id}/add`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-body">
      <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
        <Link href="/progress" className="text-muted-foreground hover:text-foreground">
          <Icon i="arrow-left" size={20} />
        </Link>
        <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
          Créer un objectif
        </h2>
      </div>

      <div className="flex flex-1 justify-center px-4 py-8 lg:px-8">
        <div className="flex w-full max-w-lg flex-col gap-4">
          {error && (
            <p role="alert" className="font-body text-sm text-accent">
              {error}
            </p>
          )}
          <SavingsGoalForm
            submitLabel="Créer l'objectif"
            submitting={submitting}
            onSubmit={handleCreate}
            onCancel={() => router.push('/progress')}
          />
        </div>
      </div>
    </div>
  );
}
