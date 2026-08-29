'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { formatPrice } from '@/lib/utils';

type Frequency = 'monthly' | 'weekly' | 'daily';

const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'monthly', label: 'Mensuel' },
  { id: 'weekly', label: 'Hebdo' },
  { id: 'daily', label: 'Quotidien' },
];

const PER_LABEL: Record<Frequency, string> = { monthly: 'mois', weekly: 'semaine', daily: 'jour' };

function asFrequency(value: string | null): Frequency {
  return value === 'weekly' || value === 'daily' ? value : 'monthly';
}

interface BudgetEditorProps {
  totalBudget: number | null;
  budgetFrequency: string | null;
  onSaved: () => Promise<void>;
}

/** "Budget" section: inline amount + frequency edit (was a jump to /onboarding). */
export function BudgetEditor({ totalBudget, budgetFrequency, onSaved }: BudgetEditorProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(totalBudget ?? 40000);
  const [frequency, setFrequency] = useState<Frequency>(asFrequency(budgetFrequency));
  const [saving, setSaving] = useState(false);

  const currentLabel =
    totalBudget != null
      ? `${formatPrice(totalBudget)} FCFA / ${PER_LABEL[asFrequency(budgetFrequency)]}`
      : 'Non défini';

  function startEditing() {
    setAmount(totalBudget ?? 40000);
    setFrequency(asFrequency(budgetFrequency));
    setEditing(true);
  }

  async function save() {
    if (amount <= 0) return;
    setSaving(true);
    try {
      await api('/api/onboarding', {
        method: 'POST',
        body: { totalBudget: amount, budgetFrequency: frequency },
      });
      await onSaved();
      toast('Budget mis à jour.', 'success');
      setEditing(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
        <div className="min-w-0">
          <p className="font-body text-sm font-medium text-foreground">Budget</p>
          <p className="truncate font-body text-xs text-muted-foreground">{currentLabel}</p>
        </div>
        <button
          type="button"
          onClick={startEditing}
          className="flex-shrink-0 font-body text-sm font-medium text-primary"
        >
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4 lg:px-6">
      <p className="font-body text-sm font-medium text-foreground">Budget</p>

      <div>
        <label
          htmlFor="budget-amount"
          className="mb-1 block font-body text-xs text-muted-foreground"
        >
          Montant reçu
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2.5">
          <input
            id="budget-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-full bg-transparent font-headings text-lg font-bold text-foreground outline-none"
          />
          <span className="font-body text-sm text-muted-foreground">FCFA</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FREQUENCIES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFrequency(f.id)}
            className={`rounded-lg border px-4 py-2 font-body text-sm font-medium ${
              frequency === f.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || amount <= 0}
          className="rounded-lg bg-primary px-5 py-2 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
