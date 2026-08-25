# Banani implementation status — Chaque Franc

Last updated: 2026-08-24 (Phase 5)

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

- [x] **Phase 5 — Notifications + Settings** (2026-08-24):
  - `NotificationsDesktop.jsx` → `/notifications` — real filter pills (new
    `?type=` param on `GET /api/notifications`, server-side so pagination
    doesn't dry up client-filtering one page), unread dot + tap-to-mark-read
    added (Banani's static mock renders every card identically regardless
    of `readAt`, which would make "Marquer tout comme lu" invisible).
    Top-bar `x` navigates to `/dashboard` (fixed target, not
    `router.back()`).
  - **Root problem found before writing any UI**: only `WELCOME` was ever
    fired (Google OAuth signup only) — email/password signups, the
    majority path, got zero notifications ever. Shipping the list/read UI
    alone would leave `/notifications` permanently empty for most users —
    decorative, not "genuinely connected to its backend". Added 3 real
    triggers, one per Banani filter pill so none is dead: `ENVELOPE_THRESHOLD`
    (from `POST /api/transactions`, fires once per 80%/100% threshold per
    budget period, gated by a real Settings toggle), `TIP_APPLIED` (from
    `POST /api/tips/[id]/apply`, real-creation branch only), `GOAL_MILESTONE`
    (from `POST /api/savings-goals/[id]/entries`, fires once when a goal
    crosses 100%). All 3 follow the exact post-commit-createNotification
    pattern already established in `api/withdrawals/route.ts` (protected,
    read-only reference). **Not built** (flagged, not silently dropped):
    Banani's mock also shows budget-set / identity-verification / weekly-streak
    cards — no filter pill, no real feature (KYC inert per locked decisions),
    or no state to back them without fabricating stats (same anti-pattern
    already avoided in Phase 3/4).
  - `SettingsDesktop.jsx` → `/settings` rebuilt inside the standard
    `DesktopSidebarNav`+`BottomNav` shell (previously a standalone card with
    no shell at all — a real inconsistency with every other authenticated
    page). Per-section real-vs-fake audit (see plan file's table): kept
    Nom complet (new `PATCH /api/auth/me`), Email (read-only — no
    re-verification flow exists), Devise/Langue (plain info rows, no fake
    dropdown), Notifications toggle (wired to real `NotificationPreferences`
    via existing `/api/notifications/prefs` + `isChannelEnabled`), Budget
    (links to `/onboarding`, now pre-filled from the user's existing values
    — small fix in `onboarding/page.tsx` so "Modifier" doesn't silently
    reset the wizard to defaults), password + Google-link sections (existing,
    restyled). Dropped: Téléphone (no `phone` field anywhere in the schema),
    Répartition automatique + Sessions actives (no backend feature).
  - **Zone dangereuse — real account deletion, not a dead button**: new
    `DELETE /api/account`, password-reconfirmation gated (bcrypt, same
    pattern as `change-password`) for password accounts, typed-email
    confirmation for OAuth-only accounts. `prisma.user.delete()` — schema
    already cascades every owned model, no orphan cleanup needed. Built
    real (rather than omitted or faked) because a non-functional delete
    button would repeat the exact broken-affordance mistake already
    flagged and avoided in Phase 4's checkboxes — flagged to the user as a
    scope decision, reversible.
  - New `NotificationBell` component (`src/components/notifications/`) —
    fixes a real bug found during the Step-0 system read: the bell icon in
    5 page headers (dashboard/envelopes/history/progress/tips) was a dead
    decorative button, byte-identical across all 5, never wired to
    anything. Now fetches the real unread count and links to
    `/notifications`.
  - Nav: Notifications intentionally NOT added to `DesktopSidebarNav` or
    `BottomNav` (already 7 items, flagged as crowded in Phase 4) — reachable
    via the bell icon everywhere instead, matching Banani's own
    `NotificationsDesktop.jsx` source, which doesn't highlight any sidebar
    item either.
  - No schema changes this phase — `Notification`/`NotificationPreferences`
    already existed from the starter. No migration needed.
  - Verified: `pnpm typecheck` / `pnpm lint` / `pnpm test` green (582/582).
    Real end-to-end run against the dev server with 2 disposable test
    users: `PATCH /api/auth/me` updates name; envelope-threshold fires
    distinctly at 80% and 100% (not duplicated on a 3rd over-limit
    transaction — dedup confirmed), and does NOT fire at all once the
    Settings toggle disables it (confirmed via direct pref PATCH); tip-apply
    notification fires once on creation, not on the idempotent replay;
    goal-milestone fires once on completion, not on a subsequent entry past
    target; `?type=` filter returns the right subset; mark-all-read zeroes
    the count; `DELETE /api/account` refuses a wrong password (400), 
    succeeds with the correct one (200) and truly invalidates the session
    (subsequent `/api/auth/me` → 401); the OAuth-only path (passwordHash
    nulled to simulate it) refuses a mismatched confirmation email and
    succeeds with the correct one; cascade delete confirmed clean via
    direct DB query (0 rows across envelopes/transactions/goals/notifications
    post-delete). `/notifications` and `/settings` both return 200 with no
    error/hydration markers. Both test users deleted via the real
    `DELETE /api/account` endpoint (not a manual DB cleanup — the endpoint
    under test doubled as its own teardown).

- [x] **Post-Phase-5 hardening — dev-pool fix, skeleton loaders, auth UX fluidity** (2026-08-25):
  - **Root-caused a real regression** the user hit live: `/api/auth/me` 500s and
    `/api/onboarding` 401s. Traced to two duplicate `concurrently`-spawned dev
    stacks (the local `dev-cron-runner.ts` poller added to auto-drain the
    outbox/email queue in dev, since Vercel Cron never fires locally) both
    hammering Neon through `DATABASE_URL`'s `connection_limit=1` — a
    deliberate production-only serverless setting, too tight once a local
    poller shares the pool — causing Prisma `P2024` pool-timeout errors.
    Fixed by raising `connection_limit` to 10 in `.env.local` (gitignored,
    not committed) and adding `-k`/`--kill-others` to the `concurrently`
    `dev` script so a failed `next dev` bind can no longer leave
    `dev-cron-runner` orphaned on the next restart. Re-verified live:
    disposable signup → verify-email → `/api/auth/me` → `/api/onboarding` →
    `/api/dashboard` → `/dashboard`, all 200, zero pool errors.
  - **Skeleton loaders** — every one of the 13 authenticated pages did
    `if (!user) return null;` while `useUser()` checked auth (dashboard
    additionally blanked to an empty `<div>` during its own data fetch),
    surfacing as the blank white screen the user explicitly flagged. Added
    a `Skeleton` primitive (`src/components/ui/Skeleton.tsx`) plus three
    composed page-shape skeletons (`DashboardSkeleton`, `ListPageSkeleton`,
    `FormPageSkeleton` in `src/components/skeletons/`) and wired them into
    all 13 pages (dashboard, envelopes, history, notifications, tips +
    detail/apply, progress, settings, onboarding, transactions/new,
    savings new/add/confirmed) in place of the blank returns.
  - **Auth flow fluidity audit** (signup/verify/login/logout/forgot-reset,
    per explicit user request) found and fixed real gaps, not just
    polish: `logout()` existed in `AuthContext` but was **never wired to
    any button anywhere in the app** — added a working "Se déconnecter"
    action in Settings. `/verify-email` had no way to request a new code
    even though `POST /api/auth/resend-verification` already existed
    server-side — added a working resend button. `useUser()` always
    redirected to a bare `/login` with no memory of the original
    destination, so login dropped every user on `/dashboard` regardless of
    what they'd clicked — now preserves `?next=` (open-redirect guarded to
    same-origin relative paths) and returns them there post-login.
    `forgot-password`'s "you already have a code?" link didn't carry the
    email forward to `/reset-password`, forcing a retype. A successful
    password reset silently landed on `/login` with no confirmation —
    added a success banner. Four pages (`verify-email`, `reset-password`,
    `login`, `auth/error`) used `<Suspense fallback={null}>` around
    `useSearchParams()`, producing the same blank-flash bug — now use
    `FormPageSkeleton`.
  - No schema changes. Verified: `pnpm typecheck` / `pnpm lint` /
    `pnpm test` green (582/582 — one unrelated rate-limit test timeout
    flaked under full-suite load, confirmed passing in isolation).

## In progress
_(none — ready to start Phase 6)_

## Pending — grouped by phase (see roadmap for rationale/order)

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
