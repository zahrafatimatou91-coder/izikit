// Single source of truth for the "available budget" math shown on the
// dashboard (desktop hero card + mobile header) and the envelopes summary
// strip. Income restocks the period's available budget — "remaining" isn't
// just the original allowance draining down, a logged income bumps it back
// up (see the `income` aggregate in GET /api/dashboard).
//
// Extracted 2026-08-30 after a real, user-reported bug: `available =
// totalBudget + income` was introduced for `remaining`/`pctUsed` in
// dashboard/page.tsx and DashboardHeader.tsx, but each file recomputed it
// inline — and a third display line ("sur X FCFA au total") kept reading
// the raw `totalBudget`, so the numbers stopped reconciling (48 000
// restant + 54 000 dépensés ≠ 70 000 "au total") the moment a user logged
// any income. Every consumer of this math MUST call computeBudgetSummary
// — never recompute available/remaining/perDay/pctUsed inline — so a
// future formula change only has one call site to update.

export interface BudgetSummaryInput {
  totalBudget: number;
  income: number;
  spent: number;
  /** Days left in the current budget period. Optional — callers that only
   * need `available`/`remaining` (e.g. the envelopes summary strip) can
   * omit it; `perDay` then falls back to 0. */
  daysLeft?: number;
}

export interface BudgetSummary {
  /** totalBudget + income — the true denominator for "remaining" and
   * "% used". Never display the raw totalBudget as "the total" once
   * income exists — it's no longer the whole picture. */
  available: number;
  remaining: number;
  perDay: number;
  pctUsed: number;
}

export function computeBudgetSummary({
  totalBudget,
  income,
  spent,
  daysLeft = 0,
}: BudgetSummaryInput): BudgetSummary {
  const available = totalBudget + income;
  const remaining = available - spent;
  const perDay = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;
  const pctUsed = available > 0 ? Math.round((spent / available) * 100) : 0;
  return { available, remaining, perDay, pctUsed };
}
