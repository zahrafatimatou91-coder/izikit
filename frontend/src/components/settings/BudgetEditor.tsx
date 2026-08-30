'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';
import { useRipple } from '@/hooks/useRipple';

type Frequency = 'monthly' | 'weekly' | 'daily';

const DEFAULT_BUDGET = 40000;

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
  const ripple = useRipple();
  const [editing, setEditing] = useState(false);
  // Held as a digits-only string so the field can be cleared while typing;
  // parsed back to an integer (FCFA has no decimals) on save.
  const [amountText, setAmountText] = useState(String(totalBudget ?? DEFAULT_BUDGET));
  const [frequency, setFrequency] = useState<Frequency>(asFrequency(budgetFrequency));
  const [saving, setSaving] = useState(false);
  // Sum of envelope limits — fetched when the editor opens, so we can warn
  // (not block) when the new budget would leave the envelopes over-allocated.
  const [allocated, setAllocated] = useState<number | null>(null);

  const amount = Number(amountText || '0');

  const currentLabel =
    totalBudget != null
      ? `${formatPrice(totalBudget)} FCFA / ${PER_LABEL[asFrequency(budgetFrequency)]}`
      : 'Non défini';

  function startEditing() {
    setAmountText(String(totalBudget ?? DEFAULT_BUDGET));
    setFrequency(asFrequency(budgetFrequency));
    setAllocated(null);
    setEditing(true);
    api<{ envelopes: { monthlyLimit: number }[] }>('/api/dashboard')
      .then((d) => setAllocated(d.envelopes.reduce((sum, e) => sum + e.monthlyLimit, 0)))
      .catch(() => {
        /* the warning is best-effort — a failed fetch just means no warning */
      });
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
        <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40">
          <input
            id="budget-amount"
            type="text"
            inputMode="numeric"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ''))}
            placeholder={String(DEFAULT_BUDGET)}
            className="w-full bg-transparent font-headings text-lg font-bold text-foreground outline-none placeholder:font-body placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground"
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
            onPointerDown={ripple}
            aria-pressed={frequency === f.id}
            className={`relative overflow-hidden rounded-lg border px-4 py-2 font-body text-sm font-medium ${
              frequency === f.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {allocated !== null && amount > 0 && amount < allocated && (
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3">
          <Icon i="alert-triangle" size={16} className="mt-0.5 flex-shrink-0 text-accent" />
          <p className="font-body text-xs text-foreground">
            Tes enveloppes totalisent {formatPrice(allocated)} FCFA. En dessous de ce montant, ton
            tableau de bord sera en sur-répartition — pense à ajuster tes enveloppes.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEditing(false)}
          onPointerDown={ripple}
          className="relative overflow-hidden rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          onPointerDown={ripple}
          disabled={saving || amount <= 0}
          className="relative overflow-hidden rounded-lg bg-primary px-5 py-2 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
