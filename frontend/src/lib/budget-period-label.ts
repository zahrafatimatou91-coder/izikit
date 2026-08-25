/** Client-side display counterpart to the server's currentBudgetPeriod()
 * (lib/server/budget-period.ts) — same three frequency values, same
 * "monthly is the default" rule, but returns the French noun phrase used
 * in dashboard copy ("Reste ce mois-ci" etc.) instead of date boundaries. */
export function budgetPeriodLabel(frequency: string | null | undefined): string {
  if (frequency === 'daily') return "aujourd'hui";
  if (frequency === 'weekly') return 'cette semaine';
  return 'ce mois-ci';
}
