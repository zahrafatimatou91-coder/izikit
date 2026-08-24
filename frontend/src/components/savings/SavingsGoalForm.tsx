'use client';

import { useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';

// Curated set themed around "what are you saving for" — same posture as
// EnvelopeForm's icon picker (a free-text icon field would need a search UI
// we don't have yet).
const ICON_CHOICES: IconName[] = [
  'bike',
  'piggy-bank',
  'home',
  'graduation-cap',
  'smartphone',
  'plane',
  'gift',
  'heart',
];

export interface SavingsGoalFormValues {
  name: string;
  icon: IconName;
  targetAmount: number;
  period: 'weekly' | 'monthly';
}

interface SavingsGoalFormProps {
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: SavingsGoalFormValues) => void;
  onCancel: () => void;
}

export function SavingsGoalForm({
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: SavingsGoalFormProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>(ICON_CHOICES[0]!);
  const [targetAmount, setTargetAmount] = useState(5000);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="goal-name"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Nom de l&apos;objectif
          </label>
          <input
            id="goal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Transport malin"
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="goal-target"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Montant cible (FCFA)
          </label>
          <input
            id="goal-target"
            type="number"
            min={1}
            value={targetAmount}
            onChange={(e) => setTargetAmount(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
        </div>

        <div>
          <p className="mb-2 font-body text-xs font-medium text-foreground">Rythme</p>
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`flex-1 rounded-lg border px-4 py-2.5 font-body text-sm font-medium ${
                  period === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-input text-muted-foreground'
                }`}
              >
                {p === 'weekly' ? 'Chaque semaine' : 'Chaque mois'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 font-body text-xs font-medium text-foreground">Icône</p>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setIcon(choice)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  icon === choice ? 'border-primary bg-primary/10' : 'border-border bg-input'
                }`}
              >
                <Icon
                  i={choice}
                  size={16}
                  className={icon === choice ? 'text-primary' : 'text-muted-foreground'}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={submitting || !name.trim() || targetAmount <= 0}
            onClick={() => onSubmit({ name: name.trim(), icon, targetAmount, period })}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Création…' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-6 py-2.5 font-body text-sm font-medium text-foreground"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
