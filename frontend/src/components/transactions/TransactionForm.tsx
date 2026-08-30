'use client';

import { useEffect, useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { envelopeSwatch } from '@/lib/envelope-colors';
import { useRipple } from '@/hooks/useRipple';

interface EnvelopeOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

type Kind = 'expense' | 'income';

export interface TransactionFormValues {
  amount: number; // signed, smallest unit
  label: string;
  envelopeId: string | null;
}

export interface TransactionFormInitial {
  amount: number; // signed — sign determines the initial Dépense/Revenu toggle
  label: string;
  envelopeId: string | null;
}

interface TransactionFormProps {
  initial?: TransactionFormInitial;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: TransactionFormValues) => void;
}

/** Shared by /transactions/new and /transactions/[id]/edit — extracted so
 * editing a transaction doesn't duplicate the whole form. */
export function TransactionForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: TransactionFormProps) {
  const ripple = useRipple();
  const [kind, setKind] = useState<Kind>(initial && initial.amount > 0 ? 'income' : 'expense');
  const [amount, setAmount] = useState(initial ? Math.abs(initial.amount) : 0);
  const [label, setLabel] = useState(initial?.label ?? '');
  const [envelopeId, setEnvelopeId] = useState<string | null>(initial?.envelopeId ?? null);
  const [envelopes, setEnvelopes] = useState<EnvelopeOption[]>([]);

  useEffect(() => {
    api<{ envelopes: EnvelopeOption[] }>('/api/envelopes')
      .then((res) => setEnvelopes(res.envelopes))
      .catch(() => {
        /* Envelope picker is optional — silently degrade to "no envelope" if this fails. */
      });
  }, []);

  function handleSubmit() {
    if (amount <= 0 || !label.trim()) return;
    onSubmit({
      amount: kind === 'expense' ? -amount : amount,
      label: label.trim(),
      envelopeId: kind === 'expense' ? envelopeId : null,
    });
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="flex gap-2 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setKind('expense')}
          onPointerDown={ripple}
          className={`relative flex-1 overflow-hidden rounded-md py-2.5 font-body text-sm font-bold ${
            kind === 'expense' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          Dépense
        </button>
        <button
          type="button"
          onClick={() => setKind('income')}
          onPointerDown={ripple}
          className={`relative flex-1 overflow-hidden rounded-md py-2.5 font-body text-sm font-bold ${
            kind === 'income' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
          }`}
        >
          Revenu
        </button>
      </div>

      <div>
        <label
          htmlFor="amount"
          className="mb-2 block font-body text-xs font-medium text-muted-foreground"
        >
          Montant
        </label>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-input px-4 py-4">
          <input
            id="amount"
            type="number"
            min={1}
            required
            value={amount || ''}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            placeholder="0"
            className="w-full bg-transparent font-headings text-3xl font-bold text-foreground outline-none"
          />
          <span className="font-body text-sm font-medium text-muted-foreground">FCFA</span>
        </div>
      </div>

      <div>
        <label htmlFor="label" className="mb-1 block font-body text-xs font-medium text-foreground">
          Description
        </label>
        <input
          id="label"
          type="text"
          required
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === 'expense' ? 'ex: Marché Mokolo' : 'ex: Virement MTN'}
          className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
        />
      </div>

      {kind === 'expense' && envelopes.length > 0 && (
        <div>
          <p className="mb-2 font-body text-xs font-medium text-foreground">
            Enveloppe (optionnel)
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEnvelopeId(null)}
              onPointerDown={ripple}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 font-body text-xs font-medium ${
                envelopeId === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              Aucune
            </button>
            {envelopes.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => setEnvelopeId(env.id)}
                onPointerDown={ripple}
                className={`relative flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 font-body text-xs font-medium ${
                  envelopeId === env.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded ${envelopeSwatch(env.color).bg}`}
                >
                  <Icon
                    i={env.icon as IconName}
                    size={11}
                    className={envelopeSwatch(env.color).text}
                  />
                </span>
                {env.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        onPointerDown={ripple}
        disabled={submitting || amount <= 0 || !label.trim()}
        className="relative overflow-hidden rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? 'Enregistrement…' : submitLabel}
      </button>
    </div>
  );
}
