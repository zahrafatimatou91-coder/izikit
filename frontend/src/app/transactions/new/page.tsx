// No Banani source for this screen — the design only covers "Ajouter une
// économie" (savings). We design "Ajouter une transaction" ourselves,
// mobile-first, following the same interaction pattern (top bar with back
// button, card-based form, quick amount buttons).
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { envelopeSwatch } from '@/lib/envelope-colors';

interface EnvelopeOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

type Kind = 'expense' | 'income';

export default function NewTransactionPage() {
  const user = useUser();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('expense');
  const [amount, setAmount] = useState(0);
  const [label, setLabel] = useState('');
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ envelopes: EnvelopeOption[] }>('/api/envelopes')
      .then((res) => setEnvelopes(res.envelopes))
      .catch(() => {
        /* Envelope picker is optional — silently degrade to "no envelope" if this fails. */
      });
  }, [user]);

  if (!user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0 || !label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/transactions', {
        method: 'POST',
        body: {
          amount: kind === 'expense' ? -amount : amount,
          label: label.trim(),
          envelopeId: kind === 'expense' ? envelopeId : null,
        },
      });
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
          Ajouter une transaction
        </h2>
      </div>

      <div className="flex flex-1 justify-center px-4 py-8 lg:px-8">
        <form onSubmit={onSubmit} className="flex w-full max-w-lg flex-col gap-6">
          <div className="flex gap-2 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setKind('expense')}
              className={`flex-1 rounded-md py-2.5 font-body text-sm font-bold ${
                kind === 'expense' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Dépense
            </button>
            <button
              type="button"
              onClick={() => setKind('income')}
              className={`flex-1 rounded-md py-2.5 font-body text-sm font-bold ${
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
            <label
              htmlFor="label"
              className="mb-1 block font-body text-xs font-medium text-foreground"
            >
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
                  className={`rounded-lg border px-3 py-2 font-body text-xs font-medium ${
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
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-body text-xs font-medium ${
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

          {error && (
            <p role="alert" className="font-body text-sm text-accent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || amount <= 0 || !label.trim()}
            className="rounded-lg bg-primary px-4 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
