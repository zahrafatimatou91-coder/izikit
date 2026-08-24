# Savings goals (Économies) — Banani → Next.js

## Source
- `AddEconomyDesktop.jsx` → `/savings/[goalId]/add`
- `EconomyConfirmedDesktop.jsx` → `/savings/[goalId]/confirmed` (**chosen canonical** — see below)
- `EconomySavedDesktop.jsx` → not built (near-duplicate, see below)
- `MyProgressDesktop.jsx` → `/progress`
- `CancelAddEconomyDesktop.jsx` → **not a real screen**, confirmed
- Fetched: 2026-08-24, via explicit `screenIds` (nothing Phase-3-related was selected in the Banani
  editor at fetch time — the last selection was still the landing page from the previous session).

## Resolved: the two flagged open questions

1. **`CancelAddEconomyDesktop.jsx` is a Banani generation artifact, not a screen.** Diffed byte-for-
   byte against `MyProgressDesktop.jsx` via a script — identical `source`, identical `displayName`
   ("Chaque Franc — Ma Progression Desktop"). Nothing to implement; documented here so it's not
   re-investigated.
2. **`EconomyConfirmedDesktop.jsx` vs `EconomySavedDesktop.jsx`**: both are real, different designs
   for the *same product moment* (post-save confirmation for "Transport malin", 500 F added) — not
   duplicates, but redundant. I picked **`EconomyConfirmedDesktop`** as canonical:
   - Its "Détails de cette semaine" section is a day-by-day list — maps directly onto real
     `SavingsEntry` rows. `EconomySaved`'s "Comment continuer ?" section is 3 generic hardcoded
     coaching tips with no data behind them.
   - Narrower (`max-w-2xl`, matches `AddEconomy`'s width) — the two screens in one flow now share a
     width instead of jumping from 2xl to 4xl.
   - **This is a judgment call, not a discovered fact — flagging for veto.** If you'd rather ship
     `EconomySavedDesktop`'s version (bigger success callout, generic tips), say so and I'll swap it.

## What Banani didn't design (built ourselves, same posture as Phase 2's `/transactions/new`)
- **Goal creation** (`/savings/new`) — no Banani screen creates a `SavingsGoal`; `AddEconomy` assumes
  one already exists ("Transport malin" is hardcoded). Minimal form: name, icon (curated set), target
  amount, period (weekly/monthly) — same shape as `EnvelopeForm`.
- **Mobile layouts for all 3 real screens** — Banani only gave desktop for these (unlike the landing
  page, which got a real mobile screen). Mobile-first ports follow the established Phase 0-2 pattern
  (`BottomNav` + stacked full-width cards below `lg`, sidebar + wide cards at `lg`+).

## Deviations from the Banani source (flagging each, not silently diverging)
- **`AddEconomy` form fields cut down.** Banani's form has "Jour de l'économie" (a day-of-week
  picker) and "Type d'action" (radio: used transit / walked / carpooled / other). `SavingsEntry` only
  ever stores `amount` + `createdAt` (auto-now) — there's no backdating anywhere else in the app
  (Transactions don't expose a date picker either), and a controlled vocabulary of "which action"
  isn't consumed by anything (no reporting reads it). Replaced both with a single optional **Note**
  field (mirrors `Transaction.label`) — added `SavingsEntry.note String?` via migration. Kept the
  quick-amount buttons (100/250/500/1000 F) and custom-amount input as-is — genuinely useful, cheap.
- **"Débloque un nouveau conseil" (unlock a tip) removed from `EconomyConfirmed`'s next-steps list**,
  and **"débloque des nouveaux conseils" removed from `MyProgress`'s insights** — both reference Tips
  (Phase 4), not built yet. Same anti-pattern already flagged and avoided on the dashboard's dropped
  "Conseil du jour" card in Phase 2.
- **"Ton objectif se réinitialise chaque mois" removed from `MyProgress`'s insights** — no monthly
  reset cron exists; `currentAmount` just accumulates. Claiming reset behavior that isn't built would
  be the same over-promising-copy issue already flagged in the roadmap for the AI-tips copy.
- **`MyProgress`'s "Active objective" singular card → a real list.** Banani's mock assumes exactly
  one goal ("Transport malin", hardcoded). Generalized to loop over the user's actual
  `SavingsGoal[]` — same translation Phase 2 did for the dashboard's envelope grid.
- **`MyProgress`'s "Détail par jour" (Mon–Sun) → a real global week-strip**, summing all
  `SavingsEntry` amounts per day across every goal (not per-goal — doesn't generalize cleanly to N
  goals as a per-goal grid without becoming unwieldy). Backs the "Jours actifs" stat directly.
- **`EconomyConfirmed`'s "à ce rythme" projection**: kept, but computed from real data instead of
  Banani's fabricated "5 jours" — only shown once ≥2 entries exist (need a rate), phrased as
  "encore ~N économies comme celle-ci" rather than a fabricated day estimate.
- **Period-aware copy**: Banani hardcodes "cette semaine" everywhere even though `SavingsGoal.period`
  can be `monthly`. Progress/remaining copy now switches "cette semaine" / "ce mois-ci" off the real
  `period` field.

## Data model change
- `SavingsEntry.note String?` (nullable) — migration `<generated>`.
- No other schema changes. `SavingsGoal.currentAmount` stays a denormalized running total, bumped
  atomically alongside each `SavingsEntry.create` in one `prisma.$transaction([...])` (ledger +
  running-balance pattern, same spirit as `Envelope`'s period-scoped spend, simpler since there's no
  race-sensitive withdrawal-style guard needed here).

## API routes
- `GET /api/savings-goals` — list the user's goals (`completed` derived as `currentAmount >=
  targetAmount`, not stored) + weekly aggregate (`savedThisWeek`, `activeDays`, 7-day breakdown) for
  `/progress`.
- `POST /api/savings-goals` — create (name, icon, targetAmount, period).
- `GET /api/savings-goals/[id]` — one goal + its 5 most recent entries (ownership-checked, 404 on
  cross-tenant/missing).
- `POST /api/savings-goals/[id]/entries` — add an entry (amount, note?); atomic with the
  `currentAmount` bump; ownership-checked.

## Component breakdown
- **REUSE** `EnvelopeCard`-style progress-bar shell pattern (not the component itself — different
  data shape) for goal cards on `/progress`.
- **NEW** `SavingsGoalForm` (`src/components/savings/`) — mirrors `EnvelopeForm`'s structure (name,
  curated icon picker, target amount, period toggle).
- **NEW** `SavingsGoalCard` (`src/components/savings/`) — progress card for `/progress`'s goal list.
- Reuse `Icon`, `formatPrice` (`@/lib/utils`), `DesktopSidebarNav`, `BottomNav`.

## Navigation
- Banani's own sidebar on all 3 fetched screens stays at 4 items (Tableau/Enveloppes/
  Historique/Paramètres) and just leaves "Tableau" highlighted — it never designed a nav entry for
  this section. Since there'd otherwise be **zero discoverable path** into `/progress` from anywhere
  in the app, adding a 5th item ("Objectifs", `target` icon) to `DesktopSidebarNav` and `BottomNav` —
  reusing the existing nav item pattern verbatim, not new visual design. `/progress` and
  `/savings/*` pages highlight "Objectifs" as active (overriding Banani's own inconsistent
  copy-paste, which left "Tableau" highlighted on all of them).

## Responsive plan (mobile designed by us — no Banani mobile source for these 3)
- **Base (375px)**: full-width stacked cards, `BottomNav` visible, top bar simplified (back arrow +
  title, bell icon dropped — not wired to anything real, matches the Phase 0 decision to make
  `UserAvatar`/nav real rather than decorative).
- **lg (1024px+)**: `DesktopSidebarNav` + wide content column, matches Banani's desktop layout.

## Implementation checklist
- [ ] Migration: `SavingsEntry.note`
- [ ] API routes (4)
- [ ] `SavingsGoalForm`, `SavingsGoalCard`
- [ ] `/savings/new`, `/savings/[goalId]/add`, `/savings/[goalId]/confirmed`, `/progress`
- [ ] Nav: add "Objectifs" to both nav components
- [ ] 375px / 1280px checks, empty states (zero goals), typecheck/lint/build/test
- [ ] `STATUS.md` update

## Open questions for user
- The `EconomyConfirmed` vs `EconomySaved` choice above (section "Resolved") — proceeding with
  `EconomyConfirmed`, reversible if you'd rather have the other one.
