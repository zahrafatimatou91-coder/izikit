import { formatPrice } from '@/lib/utils';

/** Client-side display helper for a SavingsGoal's pace cadence — the noun
 * phrase used in "500 F / semaine" style copy across the goal creation
 * form, card, and add-money screen. Mirrors budget-period-label.ts's role
 * for the (separate) budget period concept. */
export function pacePeriodNoun(period: string): string {
  if (period === 'daily') return 'jour';
  if (period === 'weekly') return 'semaine';
  return 'mois';
}

/** "500 F / semaine" style label, or null when the goal has no pace set
 * (goals created before this feature existed). */
export function paceLabel(period: string, paceAmount: number | null): string | null {
  if (paceAmount === null) return null;
  return `${formatPrice(paceAmount)} F / ${pacePeriodNoun(period)}`;
}
