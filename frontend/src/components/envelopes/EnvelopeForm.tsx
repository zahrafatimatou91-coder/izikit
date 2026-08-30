'use client';

import { useState } from 'react';
import type { IconName } from 'lucide-react/dynamic';
import { IconPicker, stripAccents, type IconChoice } from '@/components/ui/IconPicker';
import { ENVELOPE_SWATCHES, type EnvelopeSwatchKey } from '@/lib/envelope-colors';
import { useRipple } from '@/hooks/useRipple';

// Broad catalog spanning common budget-envelope categories — student
// living costs, recurring bills, one-off spending. Same search-first
// IconPicker used for savings goals, swapped in here so envelopes get the
// same "type 'wifi', land near the wifi icon" experience instead of the
// old fixed 12-icon grid.
const ICON_CATALOG: IconChoice[] = [
  {
    icon: 'utensils',
    keywords: ['nourriture', 'repas', 'manger', 'cuisine', 'restaurant', 'alimentation'],
  },
  { icon: 'shopping-cart', keywords: ['course', 'supermarche', 'achat'] },
  { icon: 'coffee', keywords: ['cafe', 'boisson', 'snack'] },
  { icon: 'bus', keywords: ['transport', 'bus', 'taxi'] },
  { icon: 'car', keywords: ['voiture', 'essence', 'carburant'] },
  { icon: 'bike', keywords: ['velo', 'bicyclette'] },
  { icon: 'home', keywords: ['loyer', 'maison', 'logement', 'appartement'] },
  { icon: 'zap', keywords: ['electricite', 'facture', 'energie', 'courant'] },
  { icon: 'droplet', keywords: ['eau', 'facture'] },
  { icon: 'wifi', keywords: ['internet', 'wifi', 'abonnement'] },
  { icon: 'smartphone', keywords: ['telephone', 'portable', 'forfait', 'mobile'] },
  { icon: 'tv', keywords: ['abonnement', 'streaming', 'television', 'netflix'] },
  { icon: 'music', keywords: ['musique', 'abonnement', 'instrument'] },
  { icon: 'washing-machine', keywords: ['lessive', 'linge', 'pressing'] },
  { icon: 'shirt', keywords: ['vetement', 'habit', 'mode'] },
  { icon: 'graduation-cap', keywords: ['etude', 'ecole', 'formation', 'universite'] },
  { icon: 'book-open', keywords: ['livre', 'lecture', 'cours', 'fourniture'] },
  { icon: 'heart-pulse', keywords: ['sante', 'medecin', 'hopital'] },
  { icon: 'pill', keywords: ['medicament', 'pharmacie'] },
  { icon: 'shield', keywords: ['assurance', 'protection'] },
  { icon: 'dumbbell', keywords: ['sport', 'gym', 'muscu', 'fitness'] },
  { icon: 'gamepad-2', keywords: ['jeu', 'jouer', 'loisir'] },
  { icon: 'gift', keywords: ['cadeau', 'anniversaire', 'fete'] },
  { icon: 'party-popper', keywords: ['fete', 'evenement', 'sortie', 'celebration'] },
  { icon: 'plane', keywords: ['voyage', 'vacance', 'avion'] },
  { icon: 'briefcase', keywords: ['travail', 'bureau', 'business'] },
  { icon: 'baby', keywords: ['bebe', 'enfant', 'famille'] },
  { icon: 'dog', keywords: ['animal', 'chien'] },
  { icon: 'cat', keywords: ['animal', 'chat'] },
  { icon: 'scissors', keywords: ['coiffure', 'coupe', 'beaute'] },
  { icon: 'sparkles', keywords: ['beaute', 'soin'] },
  { icon: 'piggy-bank', keywords: ['epargne', 'economie'] },
  { icon: 'wallet', keywords: ['argent', 'portefeuille', 'general', 'divers'] },
];

/** Suggests an icon from the catalog by matching keywords against the
 * (accent-stripped, lowercased) envelope name as the user types. Only sets
 * the *initial* suggestion — tapping any icon by hand overrides it for
 * good, and editing an existing envelope never overrides its already-set
 * icon (see `iconTouched`'s initial value below). */
function suggestIcon(name: string): IconName {
  const normalized = stripAccents(name.toLowerCase());
  for (const { icon, keywords } of ICON_CATALOG) {
    if (keywords.some((k) => normalized.includes(k))) return icon;
  }
  return 'wallet';
}

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
  /** Server-side "this name is already taken" error, shown inline under
   * the Nom field rather than as a page-level banner — it's a 2-second
   * fix (retype the name), not something that needs a modal interrupt. */
  nameError?: string | null;
  /** Called on every keystroke in the Nom field — lets the parent clear a
   * stale nameError as soon as the user starts correcting it. */
  onNameEdited?: () => void;
  /** Server-side "this exceeds your total budget" error, shown inline
   * under the Budget mensuel field for the same reason as nameError. */
  limitError?: string | null;
  onLimitEdited?: () => void;
  onSubmit: (values: EnvelopeFormValues) => void;
  onCancel: () => void;
}

export function EnvelopeForm({
  initial,
  submitLabel,
  submitting,
  nameError,
  onNameEdited,
  limitError,
  onLimitEdited,
  onSubmit,
  onCancel,
}: EnvelopeFormProps) {
  const ripple = useRipple();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState<IconName>(initial?.icon ?? 'wallet');
  // Editing an existing envelope already has a deliberately chosen icon —
  // don't let a name tweak silently swap it out from under the user.
  const [iconTouched, setIconTouched] = useState(Boolean(initial));
  const [color, setColor] = useState<EnvelopeSwatchKey>(initial?.color ?? ENVELOPE_SWATCHES[0].key);
  const [monthlyLimit, setMonthlyLimit] = useState(initial?.monthlyLimit ?? 10000);

  function handleNameChange(value: string) {
    setName(value);
    if (!iconTouched) setIcon(suggestIcon(value));
    onNameEdited?.();
  }

  function handleLimitChange(value: string) {
    setMonthlyLimit(Math.max(0, Number(value)));
    onLimitEdited?.();
  }

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
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="ex: Nourriture"
            aria-invalid={nameError ? true : undefined}
            className={`w-full rounded-lg border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none ${
              nameError ? 'border-accent' : 'border-border'
            }`}
          />
          {nameError && <p className="mt-1 font-body text-xs text-accent">{nameError}</p>}
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
            onChange={(e) => handleLimitChange(e.target.value)}
            aria-invalid={limitError ? true : undefined}
            className={`w-full rounded-lg border bg-input px-3 py-2.5 font-body text-sm text-foreground outline-none ${
              limitError ? 'border-accent' : 'border-border'
            }`}
          />
          {limitError && <p className="mt-1 font-body text-xs text-accent">{limitError}</p>}
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
            onPointerDown={ripple}
            className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-primary px-6 py-2.5 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            onPointerDown={ripple}
            className="relative overflow-hidden rounded-lg border border-border px-6 py-2.5 font-body text-sm font-medium text-foreground"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
