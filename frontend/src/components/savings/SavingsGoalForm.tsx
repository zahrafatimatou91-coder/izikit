'use client';

import { useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { IconPicker, stripAccents, type IconChoice } from '@/components/ui/IconPicker';
import { pacePeriodNoun } from '@/lib/savings-pace-label';

// Broad catalog spanning most "what's this for" categories — search filters
// this down instead of forcing a fixed 8-16 icon shortlist (closer to a
// WhatsApp/emoji-picker than a curated palette, per user feedback that the
// old fixed set didn't cover things like "biscuit" or "fleur").
const ICON_CATALOG: IconChoice[] = [
  { icon: 'piggy-bank', keywords: ['epargne', 'economie', 'general'] },
  { icon: 'wallet', keywords: ['portefeuille', 'argent', 'epargne'] },
  { icon: 'utensils', keywords: ['nourriture', 'repas', 'manger', 'cuisine', 'restaurant'] },
  { icon: 'coffee', keywords: ['cafe', 'boisson', 'snack'] },
  { icon: 'cookie', keywords: ['biscuit', 'gateau', 'snack', 'sucre'] },
  { icon: 'shopping-bag', keywords: ['shopping', 'achat', 'sac'] },
  { icon: 'shopping-cart', keywords: ['course', 'supermarche', 'achat'] },
  { icon: 'shirt', keywords: ['vetement', 'habit', 'mode'] },
  { icon: 'footprints', keywords: ['chaussure'] },
  { icon: 'bus', keywords: ['transport', 'bus', 'taxi'] },
  { icon: 'bike', keywords: ['velo', 'bicyclette', 'transport'] },
  { icon: 'car', keywords: ['voiture', 'essence', 'carburant', 'transport'] },
  { icon: 'fuel', keywords: ['essence', 'carburant'] },
  { icon: 'plane', keywords: ['voyage', 'vacance', 'avion'] },
  { icon: 'palmtree', keywords: ['vacance', 'plage', 'voyage'] },
  { icon: 'home', keywords: ['maison', 'loyer', 'logement', 'appartement'] },
  { icon: 'building-2', keywords: ['immeuble', 'appartement', 'logement'] },
  { icon: 'graduation-cap', keywords: ['etude', 'ecole', 'formation', 'universite'] },
  { icon: 'book-open', keywords: ['livre', 'lecture', 'etude', 'cours'] },
  { icon: 'pencil', keywords: ['fourniture', 'ecole', 'etude'] },
  { icon: 'smartphone', keywords: ['telephone', 'portable', 'mobile'] },
  { icon: 'laptop', keywords: ['ordinateur', 'pc', 'travail', 'tech'] },
  { icon: 'headphones', keywords: ['musique', 'audio', 'ecouteur'] },
  { icon: 'gamepad-2', keywords: ['jeu', 'jouer', 'loisir'] },
  { icon: 'gift', keywords: ['cadeau', 'anniversaire', 'fete', 'noel'] },
  { icon: 'party-popper', keywords: ['fete', 'anniversaire', 'evenement', 'celebration'] },
  { icon: 'cake', keywords: ['anniversaire', 'gateau', 'fete'] },
  { icon: 'heart', keywords: ['amour', 'couple', 'famille', 'coeur'] },
  { icon: 'baby', keywords: ['bebe', 'enfant', 'famille'] },
  { icon: 'users', keywords: ['famille', 'amis', 'groupe'] },
  { icon: 'flower-2', keywords: ['fleur', 'beaute', 'nature'] },
  { icon: 'sparkles', keywords: ['beaute', 'soin', 'special'] },
  { icon: 'scissors', keywords: ['coiffure', 'coupe', 'beaute'] },
  { icon: 'dumbbell', keywords: ['sport', 'gym', 'muscu', 'fitness'] },
  { icon: 'heart-pulse', keywords: ['sante', 'medecin', 'hopital'] },
  { icon: 'stethoscope', keywords: ['sante', 'medecin', 'docteur'] },
  { icon: 'pill', keywords: ['medicament', 'sante', 'pharmacie'] },
  { icon: 'dog', keywords: ['animal', 'chien'] },
  { icon: 'cat', keywords: ['animal', 'chat'] },
  { icon: 'briefcase', keywords: ['travail', 'business', 'bureau'] },
  { icon: 'wrench', keywords: ['reparation', 'bricolage', 'outil'] },
  { icon: 'camera', keywords: ['photo', 'appareil'] },
  { icon: 'music', keywords: ['musique', 'instrument'] },
  { icon: 'palette', keywords: ['art', 'peinture', 'creatif'] },
  { icon: 'watch', keywords: ['montre', 'accessoire'] },
  { icon: 'glasses', keywords: ['lunette', 'accessoire'] },
  { icon: 'sun', keywords: ['ete', 'plage', 'vacance'] },
  { icon: 'umbrella', keywords: ['pluie', 'protection'] },
  { icon: 'target', keywords: ['objectif', 'but'] },
  { icon: 'star', keywords: ['favori', 'special'] },
];

/** Suggests an icon from the catalog by matching keywords against the
 * (accent-stripped, lowercased) goal name as the user types. Only sets the
 * *initial* suggestion — tapping any icon by hand overrides it for good. */
function suggestIcon(name: string): IconName {
  const normalized = stripAccents(name.toLowerCase());
  for (const { icon, keywords } of ICON_CATALOG) {
    if (keywords.some((k) => normalized.includes(k))) return icon;
  }
  return 'piggy-bank';
}

const PACES: Array<{ value: 'daily' | 'weekly' | 'monthly'; label: string }> = [
  { value: 'daily', label: 'Chaque jour' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
];

export interface SavingsGoalFormValues {
  name: string;
  icon: IconName;
  targetAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
  paceAmount: number;
}

interface SavingsGoalFormProps {
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: SavingsGoalFormValues) => void;
  onCancel: () => void;
}

// The "rythme" is real: pair a cadence (jour/semaine/mois) with an amount —
// "combien tu veux mettre par [x]" — and the savings-goal-reminders cron
// notifies the user once when a completed period closed under that amount.
// It used to be a cosmetic label with no amount and no reminder behind it;
// this is the fix, not a removal.
export function SavingsGoalForm({
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: SavingsGoalFormProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>('piggy-bank');
  const [iconTouched, setIconTouched] = useState(false);
  const [targetAmount, setTargetAmount] = useState(5000);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [paceAmount, setPaceAmount] = useState(500);

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
          <p className="mb-2 font-body text-xs font-medium text-foreground">Rythme</p>
          <div className="flex gap-2">
            {PACES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`flex-1 rounded-lg border px-3 py-2.5 font-body text-sm font-medium ${
                  period === p.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-input text-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="goal-pace-amount"
            className="mb-1 block font-body text-xs font-medium text-foreground"
          >
            Combien par {pacePeriodNoun(period)} ?
          </label>
          <input
            id="goal-pace-amount"
            type="number"
            min={1}
            value={paceAmount}
            onChange={(e) => setPaceAmount(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none"
          />
          <p className="mt-1 font-body text-xs text-muted-foreground">
            Si tu n&apos;as pas mis cette somme de côté d&apos;ici la fin du{' '}
            {pacePeriodNoun(period)}, on te le rappelle.
          </p>
        </div>

        <div>
          <p className="mb-2 font-body text-xs font-medium text-foreground">
            Icône{' '}
            <span className="font-normal text-muted-foreground">
              (suggérée selon le nom, cherche pour en voir d&apos;autres)
            </span>
          </p>
          <IconPicker
            value={icon}
            onChange={(i) => {
              setIcon(i);
              setIconTouched(true);
            }}
            catalog={ICON_CATALOG}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={submitting || !name.trim() || targetAmount <= 0 || paceAmount <= 0}
            onClick={() => onSubmit({ name: name.trim(), icon, targetAmount, period, paceAmount })}
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
