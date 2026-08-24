# Banani implementation status — Chaque Franc

Last updated: 2026-08-24

Flow: https://app.banani.co/flow/JvzUHP0KGNdG ("Chaque Franc", 22 designs fetched: 18 screens + 4 shared components)

## Done
- [x] **Phase 0 — Foundation** (2026-08-23):
  - Tailwind `@theme` tokens ported → `frontend/src/app/globals.css` (colors, 8-swatch envelope palette, radii, text scale)
  - Fonts: DM Sans (body) + Space Grotesk (headings) via `next/font/google`, replacing Inter in `layout.tsx`
  - `Icon` (`src/components/ui/Icon.tsx`) — thin wrapper over `lucide-react/dynamic`'s `DynamicIcon`, kebab-case names match Banani 1:1
  - `UserAvatar` (`src/components/ui/UserAvatar.tsx`) — real `avatarUrl`/`name` contract (not Banani's stock-photo demo props), initials-on-swatch fallback
  - `BottomNav` (`src/components/nav/BottomNav.tsx`) — wired to real routes + `usePathname` active-state (not decorative like the Banani mock)
  - `DashboardHeader` (`src/components/dashboard/DashboardHeader.tsx`), `EnvelopeCard` (`src/components/envelopes/EnvelopeCard.tsx`), `TransactionRow` (`src/components/transactions/TransactionRow.tsx`)
  - `src/lib/envelope-colors.ts` — shared 8-swatch palette (literal Tailwind classes, avoids string-interpolation scanner miss)
  - Prisma: `Envelope`, `Transaction`, `SavingsGoal`, `SavingsEntry`, `Tip`, `Subscription` models + `User.totalBudget`/`budgetFrequency` — migration `20260823222103_chaque_franc_domain_models` applied to Neon
  - Verified: `pnpm typecheck` / `pnpm lint` / `pnpm build` all green. `pnpm test`: 567/570 pass — the 3 failures (bcrypt-timeout flakiness in `seed-dev.test.ts` + `signup/route.test.ts`) are pre-existing, unrelated to this work, and pass in isolation.

- [x] **Phase 1 — Marketing + Auth + Onboarding** (2026-08-23):
  - `new_screen4` "Landing Page" → `frontend/src/app/page.tsx` (`/`) — mobile-first responsive rebuild of all 7 sections. **Deviation**: dropped the decorative fake-dashboard-screenshot mockup inside the hero (would need hand-sync with the real dashboard once Phase 2 ships, zero function otherwise).
  - `new_screen2` "Inscription / Connexion" → split into real routes `/signup` + `/login` (`AuthShell` shared left pitch panel, tabs are real navigation, not client state — signup and login are genuinely different backend flows). **Deviation**: the design's Prénom/Nom/Téléphone/Pays fields and "MTN MoMo/Orange Money" social buttons don't correspond to anything the backend accepts — signup form matches the real `POST /api/auth/signup` contract (email+password) exactly, and the social buttons are the real wired Google OAuth, not decorative mobile-money buttons.
  - `new_screen3` "Onboarding Desktop" → `/onboarding` (`POST /api/onboarding`, new route + `User.totalBudget`/`budgetFrequency`). **Scoped down**: only step 2 ("Ton budget") has a real screen from Banani — steps 3-4 ("Tes enveloppes", "Premier objectif") render as visibly upcoming/inactive in the sidebar, matching the source design's own step tracker, until Phase 2/3 give them real content.
  - **NEW, no Banani source** — ported `/verify-email`, `/forgot-password`, `/reset-password` from `examples/frontend-pages/*` (restyled with our tokens) — required so the signup/login flow doesn't dead-end; Banani didn't design these 3 utility screens.
  - Extended `GET /api/auth/me` + `AuthContext`'s `User` type with `name`/`avatarUrl`/`totalBudget`/`budgetFrequency` (previously not exposed to the client at all) — needed by `DashboardHeader`/`UserAvatar`/onboarding greeting.
  - Verified: `pnpm typecheck` / `pnpm lint` / `pnpm build` green, `pnpm test` 571/571 green. Dev server smoke-tested (curl, since Playwright's Chromium doesn't support this macOS version) — all 7 new routes return 200, no error markers, correct French copy, `bg-primary`/`font-headings`/`envelope-*` utilities confirmed present in compiled CSS.

- [x] **Phase 2 — Core budgeting loop** (2026-08-24):
  - `DashboardDesktop.jsx` + `Dashboard.jsx` (mobile) → `frontend/src/app/dashboard/page.tsx` — one responsive component switching between the mobile `DashboardHeader` layout and the desktop sidebar+stat-cards layout at `lg:`. Alert card and "tout va bien" card are data-driven (real envelope %, not hardcoded). **Deviation**: dropped the "Conseil du jour" tip card — Tips (Phase 4) doesn't exist yet, shipping a fake static tip would misrepresent an unbuilt feature.
  - `EnvelopesDesktop.jsx` → `/envelopes` — full CRUD (create/edit/delete), since envelopes are user-customizable per the locked decision, not Banani's fixed 5. New `EnvelopeForm` component (name, monthly limit, icon picker from a 12-icon curated set, 8-swatch color picker).
  - `HistoryDesktop.jsx` → `/history` — cursor-paginated ("Charger plus"), grouped by month.
  - **NEW, no Banani source** — `/transactions/new`: expense/income toggle, amount, description, optional envelope picker. Required so "Ajouter" from the bottom nav / dashboard empty-states isn't a dead link.
  - New API routes: `GET/POST /api/envelopes`, `PATCH/DELETE /api/envelopes/[id]`, `GET/POST /api/transactions` (cursor pagination via the shared `pagination/paginate.ts` helper), `GET /api/dashboard` (aggregates period-scoped spend — see new `lib/server/budget-period.ts` for the monthly/weekly/daily period-boundary logic). Envelope ownership is checked before linking a transaction to it (cross-tenant guard).
  - Empty states: zero envelopes → "Crée ta première enveloppe" prompt; zero transactions → "Ajoute ta première transaction" prompt; budget not yet set → redirect prompt to `/onboarding` (instead of dividing by a null budget).
  - Verified: `pnpm typecheck` / `pnpm lint` / `pnpm build` green, `pnpm test` 575/575 green. Dev server smoke-tested (curl) — all 4 new routes return 200, no error markers, clean Turbopack compile.

- [x] **Landing page re-fetch — desktop + mobile both real** (2026-08-24):
  - Re-fetched `new_screen4.jsx` (desktop) + `LandingPageMobile.jsx` (mobile) — Banani has since
    shipped a real mobile screen (didn't exist yet during Phase 1), so the guessed mobile layout
    is replaced by a faithful port of the real one. Plan: `landing-page.md`.
  - **Dashboard preview mockup reinstated** in the hero (both breakpoints) — Phase 1 had dropped it
    as an unverifiable guess; both Banani screens confirm it's a static decorative "browser
    screenshot" (fake `app.chaquefranc.com` chrome), not a live embed, so nothing to keep in sync.
  - Rebuilt `frontend/src/app/page.tsx` as two sibling blocks (`lg:hidden` mobile / `hidden
    lg:flex` desktop) rather than one merged responsive tree — the two Banani screens have
    independently-authored copy (shorter strings throughout mobile, not just a CSS reflow), so
    forcing a single string set would either truncate desktop or bloat mobile.
  - New local `DashboardMockup` component (page-local, not extracted — single-use decorative
    block) renders the fake balance/envelope-grid screenshot at both sizes via one shared
    `compact` prop.
  - All Banani inline `style={{}}` and non-standard utility classes (`opacity-8`, `border-3`,
    `bg-opacity-20`) translated to arbitrary-value Tailwind / the project's `/opacity` syntax.
  - Verified: `pnpm typecheck` / `pnpm lint` clean, dev server curl-tested — 200 on `/`, `/signup`,
    `/login`, `/dashboard`, no error/hydration markers, both `lg:hidden` and `hidden lg:flex`
    blocks present in the SSR output with the mockup content in each.

- [x] **Phase 3 — Savings goals (Économies)** (2026-08-24):
  - `AddEconomyDesktop.jsx` → `/savings/[goalId]/add` — quick-amount buttons + custom amount kept;
    "Jour de l'économie" day-picker and "Type d'action" radio group replaced with a single optional
    Note field (`SavingsEntry.note`, new migration `20260824132056_savings_entry_note`) — nothing
    else in the app backdates entries and no reporting consumed a controlled action vocabulary.
  - `EconomyConfirmedDesktop.jsx` → `/savings/[goalId]/confirmed` — **chosen over
    `EconomySavedDesktop.jsx`** after diffing both real, distinct sources (confirmed via a script,
    not eyeballed): `EconomyConfirmed`'s day-by-day breakdown maps onto real `SavingsEntry` rows;
    `EconomySaved`'s "Comment continuer ?" is 3 generic hardcoded tips with no data behind them.
    Reversible judgment call — flagged to the user, not yet vetoed.
  - `CancelAddEconomyDesktop.jsx` — **confirmed Banani generation artifact, not a screen.** Byte-diffed
    against `MyProgressDesktop.jsx` (script, not assumption): identical `source` and `displayName`.
    Nothing built for it.
  - `MyProgressDesktop.jsx` → `/progress` — the single hardcoded "Active objective" card generalized
    into a real `SavingsGoal[]` list (`SavingsGoalCard`); the per-goal Mon–Sun breakdown generalized
    into a global 7-day strip (sum across all goals — doesn't generalize per-goal without becoming
    unwieldy, and backs the "Jours actifs" stat directly).
  - Dropped copy referencing unbuilt features: "débloque un nouveau conseil" (Tips/Phase 4 isn't
    built — same anti-pattern as the dashboard's dropped "Conseil du jour") and "ton objectif se
    réinitialise chaque mois" (no monthly-reset cron exists — would be the same over-promising-copy
    issue already flagged for the AI-tips mismatch in the roadmap).
  - **NEW, no Banani source** — `/savings/new` (goal creation; `AddEconomy` assumes one already
    exists) — same posture as Phase 2's `/transactions/new`.
  - New API routes: `GET/POST /api/savings-goals` (list + weekly aggregate / create),
    `GET /api/savings-goals/[id]` (detail + 5 recent entries), `POST /api/savings-goals/[id]/entries`
    (atomic `$transaction` — entry insert + `currentAmount` increment, ownership-checked, 404 on
    cross-tenant).
  - Nav: added "Objectifs" (`target` icon) to `DesktopSidebarNav` and `BottomNav` — Banani's own 3
    fetched screens kept the sidebar at 4 items and just left "Tableau" highlighted (never designed
    a nav entry for this section), which would have left `/progress` completely unreachable from
    anywhere in the app.
  - Verified: `pnpm typecheck` / `pnpm lint` / `pnpm build` green (all new routes in the manifest),
    `pnpm test` 578/578 green. Real end-to-end run against the dev server: signed up a test user,
    pulled the verification code straight from `VerificationCode` (Resend still unconfigured),
    created a goal, posted 2 entries via curl — confirmed the atomic increment (500 → 800, matches
    entry sum exactly), confirmed cross-tenant 404 on a bogus goal id, confirmed all 3 new pages
    return 200 with no error/hydration markers. Testing user deleted after verification (cascade
    took the goal + entries with it).

- [x] **Phase 4 — Tips (Conseils)** (2026-08-24):
  - `AllTipsDesktop.jsx` → `/tips` — copy softened: dropped "Conseils personnalisés" / "profil de
    dépenses" framing (overclaims AI personalization the locked decision doesn't build — content is
    static curated, not generated). The one real targeting mechanism kept: `GET /api/tips` sorts
    tips whose `category` substring-matches a real envelope name first — plain server-side string
    match, not AI. Same copy-mismatch class already flagged for the Abonnement screen's "Conseils
    personnalisés IA" (Phase 6, not yet due).
  - `TipDetailDesktop.jsx` → `/tips/[id]` — dropped fabricated "28% d'économie" / "15 jours" stats
    and the "Exemple réel" (50000→36000F) comparison box, both specific to the one worked example
    (Transport malin) and not generalizable to the other 8 tips. Kept the real
    `estimatedSavingsFcfa` stat. "Comment ça marche" + "Conseils pratiques" folded into one numbered
    list rendered from `Tip.body`'s paragraphs (no separate structured fields in the model).
  - `ApplyTipDesktop.jsx` → `/tips/[id]/apply` — dropped the day-by-day checkboxes (Banani's own
    mock ships them uncontrolled, no `onChange`/state — an inert checkbox that looks interactive but
    does nothing is a broken affordance, not a faithful port); replaced with a plain numbered
    reference list ("Jour N", sequential — not weekday names, since step count varies 3–4 per tip).
    Dropped the inline "Enregistrer ton économie" form — duplicates the already-built/tested
    `/savings/[goalId]/add` (Phase 3); routes there instead of a second code path writing
    `SavingsEntry`. `POST /api/tips/[id]/apply` is idempotent (looks up existing goal by
    `{userId, tipId}` before creating) since visiting the page itself triggers the POST on mount.
  - Schema: `Tip.title` made `@unique` (seed upsert key), new `Tip.estimatedSavingsFcfa Int?`, new
    `SavingsGoal.tipId String?` + relation (`onDelete: SetNull`) — migrations
    `20260824135158_tips_and_goal_link` + `20260824145656_tip_title_unique` (hand-authored via
    `prisma migrate diff --script` + `migrate deploy`, non-interactive-safe workaround for the
    `@unique`-constraint interactive gate).
  - **Number reconciliation**: Transport malin's card said 2400F, detail hero said 14000F in
    Banani's own source (internally inconsistent) — picked 2400F as canonical, noted here rather
    than silently choosing.
  - New `frontend/scripts/seed-tips.ts` — 9 curated tips (`upsert` keyed on `title`, safe to
    re-run), content authored by us for 8/9 tips since Banani only fully designed the Transport
    malin example. Run via `pnpm seed:tips`.
  - **Environment bug fixed proactively**: `pnpm seed:tips` silently created 0 rows — root cause was
    the CLI-entrypoint guard (`import.meta.url === \`file://${process.argv[1]}\``) comparing an
    un-encoded path against Node's percent-encoded one, failing specifically because this project's
    directory name ("chaque franc") contains a literal space. Fixed using `pathToFileURL()` from
    `node:url` in `seed-tips.ts` and, since the same broken pattern was present, also in
    `seed-dev.ts`, `make-superadmin.ts`, and `smoke-auth.ts` — left broken siblings would have been
    an inconsistent fix. `scripts/seed-dev.test.ts` + `scripts/make-superadmin.test.ts` (9 tests)
    re-run clean after the change.
  - New API routes: `GET /api/tips` (list + category-match sort + excerpt), `GET /api/tips/[id]`
    (detail + `body` split into `steps`), `POST /api/tips/[id]/apply` (idempotent goal creation).
  - Nav: added "Conseils" (`lightbulb` icon) to `DesktopSidebarNav` and `BottomNav` (7 items now on
    mobile — still clears the 48px touch-target minimum, flagged as getting crowded).
  - Verified: `pnpm typecheck` / `pnpm lint` / `pnpm format` / `pnpm test` all green (581/581).
    Real end-to-end run against the dev server: signed up a test user, pulled the verification code
    from `VerificationCode` (Resend still unconfigured), confirmed `GET /api/tips` returns all 9
    seeded tips, confirmed `GET /api/tips/[id]` returns the correct 4-step split for Transport malin,
    confirmed `POST /api/tips/[id]/apply` → 201 first call (creates `SavingsGoal` with
    `targetAmount: 2400`, `period: monthly`, `icon: bike`, `tipId` set) → 200 on retry (same goal id,
    no duplicate — idempotency confirmed via direct DB query), confirmed the goal appears in
    `GET /api/savings-goals`, confirmed all 3 new pages (`/tips`, `/tips/[id]`, `/tips/[id]/apply`)
    return 200 with no error/hydration markers. Testing user deleted after verification (cascade
    took the goal with it). One mid-session hiccup: the long-running dev server process kept a stale
    Prisma Client from before the schema migration (same class of issue as the earlier stale-Turbopack-CSS-cache bug) —
    fixed by killing the server, clearing `.next`, and restarting; re-verified clean afterward.

## In progress
_(none — ready to start Phase 5)_

## Pending — grouped by phase (see roadmap for rationale/order)

### Phase 5 — Notifications + Settings
- [ ] `NotificationsDesktop.jsx` → `/notifications` — plan: `notifications.md` (reuses existing `Notification` model/routes)
- [ ] `SettingsDesktop.jsx` → merge into existing `frontend/src/app/settings/page.tsx`

### Phase 6 — Subscription / monetization
- [ ] `new_screen1` "Abonnement Desktop" → `/subscription` — plan: `subscription.md` (reuses `Order` + Bictorys `PaymentProvider`)

## Open design questions
- 4 architectural decisions locked 2026-08-23 (transactions=manual entry, envelopes=customizable,
  tips=static content, Withdrawal/Organization=inert) — see `00-roadmap.md` §Decisions locked.
- The 2 near-duplicate savings-confirmation screens: **resolved** 2026-08-24, `EconomyConfirmedDesktop`
  chosen — see `savings-goals.md` §Resolved. Reversible if you'd rather have `EconomySavedDesktop`.
- Remaining lower-priority items (recurring billing, budget model shape, "Ma Progression"
  achievements/streaks beyond the stats already shipped) — see `00-roadmap.md` §Still open.

## Notes
- Every screen above is Desktop-only in Banani except `Dashboard.jsx` (mobile) and the 4 shared components. Per skill mandate, mobile-first is still required for ALL of them — mobile layout will be designed by us, not copied from Banani.
- Raw Banani fetch (`_raw-fetch.txt`, 226KB JSON) was deleted after analysis — re-fetch via `mcp__banani__banani_get_selected_designs` when a phase starts implementation (select the relevant screens in Banani first).
