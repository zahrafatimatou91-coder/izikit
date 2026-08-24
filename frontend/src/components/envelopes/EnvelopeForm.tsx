'use client';

import { useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';
import { ENVELOPE_SWATCHES, type EnvelopeSwatchKey } from '@/lib/envelope-colors';

// Curated set — envelopes are user-customizable but a free-text icon field
// would need an icon search UI we don't have yet. These cover the common
// student budget categories seen across the Banani screens.
const ICON_CHOICES: IconName[] = [
  'utensils',
  'bus',
  'music',
  'home',
  'heart-pulse',
  'book-open',
  'wifi',
  'smartphone',
  'gift',
  'coffee',
  'graduation-cap',
  'shirt',
];

export interface EnvelopeFormValues {
  name: string;
  icon: IconName;
  color: EnvelopeSwatchKey;
  monthlyLimit: number;
}

interface EnvelopeFormProps {
  initial?: EnvelopeFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: EnvelopeFormValues) => void;
  onCancel: () => void;
}

export function EnvelopeForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: EnvelopeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState<IconName>(initial?.icon ?? ICON_CHOICES[0]!);
  const [color, setColor] = useState<EnvelopeSwatchKey>(initial?.color ?? ENVELOPE_SWATCHES[0].key);
  const [monthlyLimit, setMonthlyLimit] = useState(initial?.monthlyLimit ?? 10000);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="envelope-name"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Nom
          </label>
          <input
            id="envelope-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Nourriture"
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="envelope-limit"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Budget mensuel (FCFA)
          </label>
          <input
            id="envelope-limit"
            type="number"
            min={1}
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
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

        <div>
          <p className="mb-2 font-body text-xs font-medium text-foreground">Couleur</p>
          <div className="flex flex-wrap gap-2">
            {ENVELOPE_SWATCHES.map((swatch) => (
              <button
                key={swatch.key}
                type="button"
                aria-label={swatch.key}
                onClick={() => setColor(swatch.key)}
                className={`h-9 w-9 rounded-lg ${swatch.bg} ${
                  color === swatch.key ? 'ring-2 ring-offset-2 ring-foreground' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={submitting || !name.trim() || monthlyLimit <= 0}
            onClick={() => onSubmit({ name: name.trim(), icon, color, monthlyLimit })}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : submitLabel}
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
