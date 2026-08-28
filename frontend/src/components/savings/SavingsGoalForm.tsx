'use client';

import { useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';

// Expanded set covering common "what are you saving for" categories. Paired
// with the keyword auto-suggestion below — a goal named "biscuit" or "fleur"
// used to silently default to whichever icon happened to be first in the
// list, with nothing pointing the user at a better match further down.
const ICON_CHOICES: IconName[] = [
  'piggy-bank',
  'utensils',
  'coffee',
  'shopping-bag',
  'shirt',
  'bus',
  'bike',
  'car',
  'plane',
  'home',
  'graduation-cap',
  'smartphone',
  'gift',
  'heart',
  'flower-2',
  'dumbbell',
];

// Keyword → icon, matched against the (accent-stripped, lowercased) goal
// name as the user types. First match wins; falls back to the generic
// piggy-bank when nothing matches. This only sets the *initial* suggestion —
// tapping any icon by hand overrides it for good.
const ICON_KEYWORDS: Array<{ icon: IconName; words: string[] }> = [
  {
    icon: 'utensils',
    words: ['nourriture', 'repas', 'manger', 'biscuit', 'gateau', 'cuisine', 'course', 'aliment'],
  },
  { icon: 'coffee', words: ['cafe', 'boisson', 'snack'] },
  { icon: 'shirt', words: ['vetement', 'habit', 'mode', 'chaussure'] },
  { icon: 'shopping-bag', words: ['shopping', 'achat'] },
  { icon: 'bus', words: ['bus', 'transport', 'taxi'] },
  { icon: 'bike', words: ['velo', 'bicyclette'] },
  { icon: 'car', words: ['voiture', 'essence', 'carburant'] },
  { icon: 'plane', words: ['voyage', 'vacance', 'avion'] },
  { icon: 'home', words: ['maison', 'loyer', 'logement', 'appart', 'demenagement'] },
  { icon: 'graduation-cap', words: ['etude', 'ecole', 'formation', 'universite', 'cours'] },
  { icon: 'smartphone', words: ['telephone', 'portable', 'smartphone', 'ordinateur'] },
  { icon: 'gift', words: ['cadeau', 'anniversaire', 'fete', 'noel'] },
  { icon: 'heart', words: ['amour', 'couple', 'famille', 'mariage'] },
  { icon: 'flower-2', words: ['fleur', 'beaute', 'coiffure'] },
  { icon: 'dumbbell', words: ['sport', 'gym', 'muscu', 'fitness'] },
];

function stripAccents(s: string): string {
  return s
    .replace(/[àâ]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c');
}

function suggestIcon(name: string): IconName {
  const normalized = stripAccents(name.toLowerCase());
  for (const { icon, words } of ICON_KEYWORDS) {
    if (words.some((w) => normalized.includes(w))) return icon;
  }
  return 'piggy-bank';
}

export interface SavingsGoalFormValues {
  name: string;
  icon: IconName;
  targetAmount: number;
}

interface SavingsGoalFormProps {
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: SavingsGoalFormValues) => void;
  onCancel: () => void;
}

// No "rythme" (weekly/monthly) field — it used to be purely cosmetic (no
// reset logic exists anywhere) and only confused users into thinking their
// goal recurred or reset on a cadence it never did. A savings goal is just:
// name, icon, target amount, add money whenever.
export function SavingsGoalForm({
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: SavingsGoalFormProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>(ICON_CHOICES[0]!);
  const [iconTouched, setIconTouched] = useState(false);
  const [targetAmount, setTargetAmount] = useState(5000);

  function handleNameChange(value: string) {
    setName(value);
    if (!iconTouched) setIcon(suggestIcon(value));
  }

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
            onChange={(e) => handleNameChange(e.target.value)}
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
          <p className="mb-2 font-body text-xs font-medium text-foreground">
            Icône{' '}
            <span className="font-normal text-muted-foreground">
              (suggérée selon le nom, modifiable)
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  setIcon(choice);
                  setIconTouched(true);
                }}
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
            onClick={() => onSubmit({ name: name.trim(), icon, targetAmount })}
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
