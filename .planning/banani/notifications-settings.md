# Phase 5 — Notifications + Settings — Banani → Next.js

## Source
- Banani screen IDs:
  - `JvzUHP0KGNdG/screens/NotificationsDesktop.jsx` ("Chaque Franc — Notifications Desktop")
  - `JvzUHP0KGNdG/screens/SettingsDesktop.jsx` ("Chaque Franc — Paramètres Desktop")
- Fetched: 2026-08-24 (explicit `screenIds`, not selected in the editor)

## System map (Step 0 answers)

- **Routes**: `/notifications` (new) and `/settings` (existing, rebuilt in place).
  Both auth-gated via `useUser()` / `requireAuth`.
- **Notifications data**: `GET /api/notifications` (cursor list, already built —
  Phase "Auth/Notifications" scaffolding), `GET /api/notifications/count`
  (unread badge), `PATCH /api/notifications` (mark read, `ids` array or
  `'all'`). All 3 already exist and are fully generic — reused as-is except
  one additive change: `GET` gains an optional `?type=` filter (mirrors the
  existing `?unread=true` param), needed for the "Alertes/Conseils/
  Réalisations" filter pills to paginate correctly server-side instead of
  client-filtering one page and running dry.
- **The real problem found in Step 0**: only ONE notification is ever fired
  today (`WELCOME`, on Google OAuth signup only — `oauth/google/callback`).
  Email/password signups (the majority path, since Google OAuth is one
  button among several) get zero notifications, ever. Shipping the
  list/read UI alone would make `/notifications` permanently empty for
  most users — decorative, not "genuinely connected to its backend" per
  session Règle 1. Three real triggers added (see below), each mapped to
  one of Banani's own filter pills so no pill is dead:
  - **Alertes** → `ENVELOPE_THRESHOLD`, fired from `POST /api/transactions`
    when an expense pushes an envelope's period-scoped spend past 80% or
    100% of `monthlyLimit` (reuses `currentBudgetPeriod` from
    `lib/server/budget-period.ts`, same helper `/api/dashboard` already
    uses — no new period logic). Fires once per threshold per period via
    `dedupeKey: envelope-threshold:${envelopeId}:${pct}:${periodStartISO}`.
    Gated by `NotificationPreferences` (`isChannelEnabled(prefs,
    'ENVELOPE_THRESHOLD', 'inApp')`) — wired to a real toggle in Settings
    (see below), not a dead switch.
  - **Conseils** → `TIP_APPLIED`, fired from `POST /api/tips/[id]/apply`
    (Phase 4, already built) only on the real-creation branch (`existing
    === null`), never on the idempotent replay. `dedupeKey:
    tip-applied:${goalId}`.
  - **Réalisations** → `GOAL_MILESTONE`, fired from `POST
    /api/savings-goals/[id]/entries` (Phase 3, already built) when an
    entry pushes `currentAmount` from below `targetAmount` to at/above it
    (goal just completed — the one unambiguous, non-fabricated milestone;
    25/50/75% sub-milestones dropped, would need arbitrary threshold
    choices with no data backing them, same anti-pattern already avoided
    in Phase 3/4). `dedupeKey: goal-completed:${goalId}`.
  - All 3 follow the exact pattern already established in
    `api/withdrawals/route.ts` (protected file, read-only reference, not
    modified): call `createNotification` AFTER the primary write commits,
    wrapped in try/catch that swallows failures so a notification hiccup
    never poisons the real response.
  - **Not built** (flagged, not silently dropped): Banani's mock also
    shows a neutral "Budget de novembre" card (budget set) and an "Info"
    identity-verification card and a "Semaine productive" streak card.
    Budget-set: doesn't map to any filter pill, onboarding's own success
    state already confirms it, low value for the added dedup-key
    plumbing — skipped. Identity verification: no KYC feature exists
    (Withdrawal/Organization are inert per the 2026-08-23 locked
    decisions) — would be entirely fake. Streak: no streak-tracking state
    exists anywhere — fabricating "1 conseil suivi cette semaine" would
    repeat the exact mistake already caught and reverted in Phase 3/4
    (fabricated stats). All three: not built.
- **Settings data**: existing `GET /api/auth/me` (name/email/hasPassword/
  linkedProviders/totalBudget/budgetFrequency), existing password routes
  (`change-password`/`set-password`), existing OAuth link route, existing
  `GET/PATCH /api/notifications/prefs`. Two new routes needed:
  - `PATCH /api/auth/me` — updates `name` only. The existing route's own
    comment already flags this as planned ("future"). Small, safe,
    reversible field.
  - `DELETE /api/account` — real account deletion (see Danger Zone below),
    not previously existing.
- **Nav/reuse**: `DesktopSidebarNav` + `BottomNav` (both already exist,
  unchanged — Notifications is NOT added as a nav item; see rationale
  below). `ThemeToggle` (theming phase, reused as-is).
- **Empty/loading/error states**: notifications list empty state ("Aucune
  notification"), loading skeleton (reuse the plain "Chargement…" pattern
  used everywhere else in this codebase), error banner on fetch failure
  (existing pattern: `role="alert"` text).
- **Side effects**: mark-as-read (tap a card, or "Marquer tout comme lu"),
  toast on settings mutations (existing `useToast()`), redirect to `/`
  + cookie clear after account deletion.

## Structure map — `/notifications`

- Sidebar: **REUSE** `DesktopSidebarNav` (Banani's own fetch only shows 4
  items with none highlighted — same "screen predates later nav additions"
  pattern already seen in Phase 3/4; real 6-item nav used instead, no
  item highlighted since Notifications isn't a primary destination).
- Top bar: title + a close (`x`) button. **Deviation**: Banani's `x` implies
  a dismissible panel; this is a plain page, so `x` navigates to
  `/dashboard` (fixed target, not `router.back()` — predictable regardless
  of entry point, matches the "explicit Link back" convention already used
  by `/tips/[id]`, not the ambiguous browser-history convention).
- Filter pills: Tous / Alertes / Conseils / Réalisations — real, server-side
  via the new `?type=` param (see above), not decorative.
- Notification cards: color/icon per type, faithful to Banani's per-type
  styling (accent for alerts, primary for achievements, secondary for
  advice, neutral for everything else/WELCOME). **Addition beyond Banani**:
  a small unread-dot, since "Marquer tout comme lu" is meaningless if no
  card ever visibly differs by read state (Banani's static mock shows all
  cards identically regardless of readAt — an omission we have to fill in,
  same posture as designing empty/loading states Banani never shows).
  Tapping a card also marks that one read (`PATCH` with `ids:[id]`) —
  interaction Banani didn't specify but a natural extension of the
  existing bulk-mark-read endpoint.
- Pagination: "Charger plus" cursor button, same UI pattern as `/history`.

## Structure map — `/settings`

Current `/settings` has NO sidebar shell (standalone centered card) — a
real inconsistency with every other authenticated page. Rebuilt inside the
standard `DesktopSidebarNav` + `BottomNav` shell, `active="settings"`.

Banani's 5 sections, each cross-checked against what's real:

| Banani section | Verdict | Reasoning |
|---|---|---|
| Compte → Nom complet | **REAL**, editable | New `PATCH /api/auth/me`; the field already exists on `User` and the route's own comment flagged this as planned |
| Compte → Email | **REAL**, read-only | No re-verification flow exists for email changes — showing it with a live "Modifier" button would be the same broken-affordance class as Phase 4's inert checkboxes. Displayed as plain text instead. |
| Compte → Téléphone | **DROPPED** | No `phone` field anywhere in `schema.prisma` — 100% fabricated in Banani's mock. |
| Préférences → Devise / Langue | **REAL**, non-interactive | True facts (FCFA, French) but no multi-currency/i18n system exists — rendered as plain info rows, dropped the fake chevron/dropdown affordance since there is nothing to select. |
| Préférences → Notifications toggle | **REAL**, wired | Maps directly onto the new `ENVELOPE_THRESHOLD` trigger via existing `GET/PATCH /api/notifications/prefs` + `isChannelEnabled` helper (already in `lib/server/notifications/prefs-merge.ts`) — makes both the toggle AND the alert trigger meaningful together. |
| Budget → Budget mensuel | **REAL** | Reads `user.totalBudget`; "Modifier" links to `/onboarding` (existing route, already safely re-callable — `POST /api/onboarding` is a plain `update`, no first-time-only guard) instead of building a redundant single-field editor. |
| Budget → Répartition automatique | **DROPPED** | No auto-distribution feature exists or is planned — pure decoration. |
| Sécurité → Mot de passe | **REAL**, reused | Existing change/set-password form (already fully wired), restyled into the Banani card shell. Dropped the fabricated "Modifié il y a 3 mois" (no `passwordChangedAt` tracked). |
| Sécurité → Sessions actives | **DROPPED** | No per-session enumeration exists (refresh tokens aren't individually listable in this schema) — would be fake. |
| Comptes liés (not in this Banani fetch but already in current `/settings`) | **KEPT** | Existing Google-link section, restyled into the same card shell — real feature, no reason to drop it. |
| Apparence (theming, not in this Banani fetch) | **KEPT** | Existing `ThemeToggle` section, restyled to match. |
| Zone dangereuse → Supprimer le compte | **REAL, newly built** | See below — the alternative (a dead button) is worse than building it properly-gated. |

### Danger zone — account deletion, scoped deliberately narrow
- New `DELETE /api/account`: `requireAuth` + CSRF. If `hasPassword`,
  requires `password` in the body (bcrypt-verified, same helper pattern as
  `change-password`) before deleting — mirrors the security bar already
  set for withdrawals. If OAuth-only (`hasPassword === false`), requires a
  literal typed confirmation string (`email` must match) instead, since
  there's no password to check.
- On success: `prisma.user.delete()` (schema already cascades every
  owned model — envelopes, transactions, savings goals/entries,
  notifications, oauth accounts — no orphan cleanup needed), clears auth +
  CSRF cookies (same helpers `logout` uses), returns 200.
- Frontend: 2-step confirm (click "Supprimer le compte" → inline
  password/typed-confirmation form appears in place, no separate modal
  component needed for one flow) → on success, toast + client-side
  redirect to `/`.
- **Not built speculatively**: no "export my data" / "deactivate instead"
  flows — out of scope, not hinted at anywhere in the Banani source or the
  roadmap.

## Token mapping (Banani → project)
Same `@theme` palette already ported in Phase 0 — no new tokens needed.
`bg-opacity-10`/`border-opacity-20` (Banani's non-standard opacity
classes) → Tailwind v4 `/10`, `/20` opacity modifiers (`bg-accent/10
border-accent/20`), consistent with how Phase 3/4 already translated
these.

## Responsive plan
- **Base (375px)**: `DesktopSidebarNav` hidden, `BottomNav` shown (existing
  pattern, unchanged). Notifications: filter pills scroll horizontally if
  they overflow (`overflow-x-auto`, `flex-nowrap`) rather than wrapping —
  standard mobile pill-row pattern already implied by the design's pill
  shape. Settings: all cards full-width, stacked; the account-deletion
  inline form uses full-width inputs.
- **lg (1024px+)**: Banani's desktop layout as fetched — sidebar + content,
  `max-w-2xl` (notifications) / `max-w-4xl` (settings) centered content
  column, matching Banani's own `mx-auto max-w-*` wrappers.

## Interactions / state
- Notification card: default / hover (`hover:bg-muted/50` subtle, not in
  Banani but needed since cards are now clickable) / unread (dot) / read.
- Filter pill: active (solid `bg-primary`) / inactive (`border-border`,
  matches Banani exactly).
- Settings toggle: on/off, disabled while a PATCH is in flight.
- Delete-account form: idle → confirming (inline form) → submitting →
  error (wrong password / mismatched confirmation) → success (redirect).

## Implementation checklist
- [x] `GET /api/notifications` — add optional `?type=` filter
- [x] `PATCH /api/auth/me` — update `name`
- [x] `DELETE /api/account` — password/typed-confirmation gated deletion
- [x] `templates.ts` — `envelopeThresholdNotification`,
      `tipAppliedNotification`, `goalMilestoneNotification` typed wrappers
- [x] Wire the 3 triggers into their real mutation routes (transactions,
      tips/apply, savings-goals/entries)
- [x] `NotificationBell` shared component (fixes the 5-page dead bell icon)
      wired into dashboard/envelopes/history/progress/tips headers
- [x] `/notifications` page (filters, list, mark-read, pagination)
- [x] `/settings` page rebuilt inside the nav shell with all sections above
- [x] 375px / 1024px checks
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` green
- [x] Real end-to-end dev-server verification (see final report)

## Open questions for user
- Account deletion was not explicitly requested for this phase — built
  because a non-functional "Supprimer le compte" button would repeat the
  exact fake-affordance mistake already flagged and avoided in Phase 4.
  Reversible: can be removed/disabled if unwanted.
- Budget-set / streak / identity-verification notification cards from
  Banani's mock were deliberately not built (see table above) — flagged
  for veto, not silently dropped.
