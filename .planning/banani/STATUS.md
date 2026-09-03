# Banani implementation status — Chaque Franc

Last updated: 2026-08-30 (Phase 6 — complete)

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

- [x] **Second live-test round — logout confirm, 2-step reset, transaction bug,
  stale-page flash, dev-cron connection leak** (2026-08-25):
  - Added a confirm/cancel modal before logout ("Se déconnecter ?") and
    changed the post-logout destination from `/login` to `/` (landing
    page) per explicit request; switched to `router.replace` so it
    deterministically wins any race against `useUser()`'s own passive
    `?next=` redirect.
  - **Real security/UX gap in password reset**: `/reset-password`
    submitted email + code + new password in one shot, so a wrong/expired
    code only surfaced as an error after the user had already typed a new
    password. Added `POST /api/auth/verify-reset-code` (read-only check,
    does NOT consume the code) and split the page into two steps — code
    verified first, password field only shown once valid. The new route
    shares the existing `auth:reset` rate-limit bucket (5/15min combined)
    so it can't become a cheaper oracle for brute-forcing codes than the
    original route already was. E2E-verified on a disposable user: wrong
    code rejected without touching the real one, correct code confirmed
    still unused after check, full reset succeeds, old password rejected
    after, replaying the same code afterward correctly fails.
  - **Real bug found from a live repro**: `POST /api/transactions`
    always 400'd with `VALIDATION_FAILED` for the most common case — no
    envelope selected on an expense ("Aucune"), or any income
    transaction — because both send `envelopeId: null` from the client,
    but the Zod schema was `z.string().min(1).optional()`, which only
    accepts `undefined`, never `null`. Widened to `.nullable().optional()`.
    No test file existed for this route before — added one (5 tests)
    covering the regression plus ownership-check and validation paths.
  - **Stale-page flash** ("shows the old version, then resets itself")
    reported when navigating between authenticated pages: Next's
    client-side Router Cache can serve a previously-rendered dynamic
    page's stale committed state instantly on navigation, before that
    page's own effect refetches and replaces it — unacceptable for a
    budgeting app showing live balances. Set
    `experimental.staleTimes = { dynamic: 0, static: 0 }` in
    `next.config.ts` explicitly rather than relying on the framework
    default.
  - **Root-caused a likely contributor to the broader "app is slow /
    hangs" complaints**: `dev-cron-runner.ts`'s `setInterval` fired a new
    poll tick every 10s regardless of whether the previous tick's
    `fetch()` calls had resolved, and those `fetch()` calls had no
    timeout. Any time the dev server was briefly slow (a Turbopack
    recompile, a config-triggered restart, a DB hiccup), every
    subsequent tick piled 2 more in-flight requests on top of the
    already-hanging ones instead of waiting or giving up — observed
    live accumulating 50+ simultaneous open connections against the same
    local server the browser was using. Fixed with a re-entrancy guard
    (skip the tick if the previous one hasn't finished) and a 5s
    `AbortSignal.timeout` per fetch.
  - No schema changes. Verified: `pnpm typecheck` / `pnpm lint` /
    `pnpm test` green (595/595, +7 for `verify-reset-code`, +5 for the
    new `transactions/route.test.ts`).

- [x] **Perf pass — parallel queries, loading.tsx everywhere, remaining data
  bugs** (2026-08-25, commits `265e2d8` + `a9ea9f0`):
  - `GET /api/dashboard`, `GET /api/envelopes`, `GET /api/savings-goals`:
    split each route's Prisma calls into two `Promise.all` batches — the
    queries independent of `budgetFrequency` run first, the two
    period-scoped spend queries run in a second batch once the period
    boundary is computed. More overlap per request, same round-trip count.
  - Added a per-route `loading.tsx` (Next's route-segment Suspense
    boundary, separate from in-page skeletons) to all 20 authenticated +
    auth-flow routes, each rendering the matching `*Skeleton` component
    instead of a blank flash while the route's JS chunk loads.
  - Fixed the dashboard's hardcoded "Reste ce mois-ci" label always
    showing regardless of the user's actual `budgetFrequency` (daily/
    weekly/monthly) — new `lib/budget-period-label.ts` (client-side
    counterpart to the server's `lib/server/budget-period.ts`), wired
    into `DashboardHeader` and `dashboard/page.tsx`.
  - Fixed envelope-less transactions (`envelopeId: null`, reachable only
    since the `.nullable()` fix above) always rendering as "Revenu"
    regardless of the real amount sign, on both `/dashboard` and
    `/history` — category/icon now fall back on `amount > 0` ? Revenu :
    Dépense.
  - `/history` had no persistent "Ajouter une transaction" affordance
    once the list was non-empty (the CTA only existed in the now-hidden
    empty state) — added a permanent header button next to the
    notification bell.
  - Logout confirmation modal added to `/settings`; redirects to `/`
    (landing page) after confirming, not to `/login` — corrected per
    explicit user feedback (initial implementation redirected to the
    auth area, which was wrong).
  - No schema changes. Verified: `pnpm typecheck` / `pnpm lint` /
    `pnpm test` green.

- [x] **Neon cold-start 500s on `/envelopes`, `/dashboard` — root-caused +
  fixed** (2026-08-26): live testing surfaced raw 500s (`ApiError`
  falling back to the untranslated "The server is temporarily
  unavailable" string in `lib/api.ts`, since the response body wasn't
  JSON) on `/api/dashboard`, which cascaded into `/envelopes` (it
  fetches both `/api/envelopes` and `/api/dashboard` in parallel for the
  budget summary strip). Server log showed the actual cause: Prisma
  `P1001` — `Can't reach database server at
  ep-rough-haze-...pooler...neon.tech:5432` — Neon's serverless compute
  auto-suspends after a few idle minutes, and the first query after a
  suspend sometimes fails outright while the compute wakes, then
  succeeds moments later (confirmed self-healing in the same log: the
  next requests after the two failures returned 200 normally). This is
  infra behavior, not an app bug, but the failure mode (silent Neon
  wake-up) is exactly the shape of error a short retry can absorb.
  - New `lib/server/db-retry.ts` — `withDbRetry(fn)` catches
    `PrismaClientKnownRequestError` with a transient connection code
    (`P1001`/`P1002`/`P1008`/`P1017`) and retries the call once after a
    400ms delay before giving up. Deliberately scoped to **read-only**
    queries only, mirroring the "retry only idempotent operations" rule
    already enforced client-side in `lib/api.ts` — never wraps a
    mutating call, since a retried write after a dropped connection
    could double-write if the first attempt actually reached the server.
  - Wrapped the Prisma reads in `GET /api/dashboard`, `GET /api/envelopes`,
    `GET /api/savings-goals`, `GET /api/transactions` (history).
  - Added `db-retry.test.ts` (5 tests: success-no-retry, retry-then-
    succeed, retry-then-still-fail, ignores non-transient Prisma codes,
    ignores non-Prisma errors).
  - No schema changes. Verified: `pnpm typecheck` / `pnpm lint` /
    `pnpm test` green (600/600).

- [x] **Mobile hamburger drawer nav** (2026-08-26): user reported no side
  menu on mobile ("il n'y a pas le menu latéral"). Live-verified with a
  real Chrome browser (Playwright, `channel: 'chrome'`, 390×844 viewport,
  disposable `@example.com` test account — cleaned up after) that
  `DesktopSidebarNav`/`BottomNav` responsive hiding was already correct
  (sidebar hidden below `lg:`, bottom nav visible and fixed at the
  bottom, single-column grids) — screenshots confirmed. The actual gap:
  mobile only had `BottomNav`'s 6 icons, no classic slide-in side-menu
  pattern. Added:
  - `components/nav/nav-items.ts` — `NAV_ITEMS`/`NavId` extracted out of
    `DesktopSidebarNav` (now imports from here) so a third nav surface
    doesn't triplicate the destination list.
  - `components/nav/MobileDrawerNav.tsx` — hamburger-triggered slide-in
    drawer (backdrop + `translate-x` panel, Escape-to-close), same
    branding/destinations/user-footer as `DesktopSidebarNav`. `BottomNav`
    stays the primary always-visible mobile nav; this is additive.
  - Wired a hamburger button (`lg:hidden`) into the mobile header of all
    7 pages that carry `DesktopSidebarNav`: dashboard (added to
    `DashboardHeader`'s greeting row), envelopes, history, notifications,
    settings, progress, tips.
  - Verified live: drawer opens on tap, highlights the active route,
    tapping a link navigates and auto-closes the drawer (Playwright).
  - No schema changes. Verified: `pnpm typecheck` / `pnpm lint` green;
    `pnpm test` 599/600 (the 1 failure is the pre-existing
    signup-rate-limit timing flake under full-suite load — passes in
    isolation, unrelated to this change).

## In progress
- (nothing)

## Done (2026-09-03) — Phase 7, Admin back-office

Plan: `admin-backoffice.md`. 5 Banani screens implemented (`AdminDashboard`,
`AdminUsersTable`, `AdminSubscriptions`, `AdminTransactions`,
`AdminConfiguration`); `AdminCoupons` DEFERRED (own spec — a coupon system is
a new subsystem, not "manage what exists"). User approved all 4 open
questions ("ok defauts").

- **New backend**:
  - `AppSetting` key/value model (`prisma/schema.prisma`) + hand-written
    migration `20260902120000_add_app_setting`. **Migration written, applied
    separately** — see below.
  - `lib/server/settings/` — typed accessors (`getSubscriptionPricing`,
    `getSupportEmail`, `getAnnouncement`, `getAllSettings`, `writeSetting`),
    per-key Zod schemas, compile-time defaults. Every read degrades to the
    shipped constant on a malformed row **or a DB/table error** (so the app
    keeps working before the migration lands) — 23 unit tests.
  - `GET /api/pricing` (public, 60s cache) + `GET /api/announcement` (public)
    — so `/subscription` + the landing Tarifs section + the app-wide banner
    track the admin-set values. New `useLivePricing()` hook (constant as
    first-paint default, reconciled from `/api/pricing`).
  - `GET /api/admin/overview` (KPIs: users/plan split/trials, 6-month signup
    buckets, MRR from live pricing + order-period, env-presence system
    booleans, 5 recent users).
  - `GET /api/admin/subscriptions` (Subscription ⋈ user email, cursor;
    `trial`/`paid`/`expiring`/`status`/`q` filters; per-row live
    `effectivePlan`/`isTrial`/`isComp`).
  - `GET /api/admin/settings` (all keys + defaults + provenance +
    integration booleans) · `PATCH /api/admin/settings` (SUPERADMIN,
    Zod-validated, audited `settings.update`).
  - `POST /api/admin/users/[id]/subscription` (SUPERADMIN grant/revoke Pro;
    comp sentinel `lastOrderId = "comp:<adminId>"` keeps `isTrial()` false;
    reuses `archive.ts`; audited `subscription.grant`/`.revoke`).
  - Extended `GET /api/admin/users` (+ `[id]`) with subscription join,
    `effectivePlan`/`isTrial`, resource counts + recent orders.
  - **Dynamic pricing wired into both webhooks** — `bictorys` + `moneroo`
    `onPaid` now read `getSubscriptionPricing(tx)` inside their Serializable
    tx instead of the `SUBSCRIPTION_PRICE_FCFA` constant. Exact-equality
    check unchanged (a mid-checkout price change → Pro not granted → user
    retries; `>=` would re-open the low-amount exploit).
- **Frontend** (`components/admin/*` + `app/admin/*`):
  - `AdminShell` (fixed `lg` rail + mobile slide-over drawer), `layout.tsx`
    gate on `GET /api/admin/me` (`AdminContext` provides role + `can[]`;
    non-admin → `/`), `DataTable` (generic, horizontal-scroll on mobile,
    "Précédent/Suivant" cursor pager), `useCursorList` hook, `primitives.tsx`
    (StatCard / Badge family / SectionCard), `AuditLogViewer`,
    `AnnouncementBanner` (root layout, dismiss-per-message via localStorage).
  - `/admin` overview · `/admin/users` (+ `/admin/users/[id]` with
    role/suspend/grant-revoke actions, `ConfirmDialog`-gated) ·
    `/admin/subscriptions` (Free/Pro cards, inline Pro price editing for
    SUPERADMIN with a confirm dialog, active-subs table) · `/admin/transactions`
    (Paiements/Retraits tabs, withdrawal cancel for SUPERADMIN) · `/admin/config`
    (support email, announcement editor + live preview, integration status,
    embedded audit log).
  - **Deviations from Banani** (see plan): dropped Solde column /
    "Nouvel utilisateur" / trash-delete (→ Suspendre) / "Nouvel abonnement" /
    the 3-tier Standard/Premium/Pro pricing (reality is Free + Pro) / the
    API-keys + 2FA + IP-whitelist + reset-DB sections (no backend, broken
    affordances) / "Envoyer une annonce globale" broadcast (→ the announcement
    banner setting, same goal, no fan-out). Numbered pagination →
    cursor "Précédent/Suivant" throughout.
  - `Icon.tsx`: +16 lucide icons used by the admin surface.
- **`/api/admin/me` left untouched** — its capability list is a locked
  contract with an exact-match test; the new SUPERADMIN-only controls gate on
  `admin.role` directly instead.
- Verified: `pnpm format` / `lint` / `typecheck` clean; `pnpm test` 906/907
  (the 1 failure is the documented signup-bcrypt full-suite timeout flake —
  9/9 in isolation); `pnpm build` green (all 6 `/admin*` pages + 5 new API
  routes in the manifest). Not yet live-smoke-tested against a running dev
  server.
- **AppSetting migration**: `20260902120000_add_app_setting` (pure additive
  `CREATE TABLE`) must be applied with `pnpm --filter frontend exec prisma
  migrate deploy` (non-interactive, no shadow DB — safe per the incident
  memory). Until it runs, the settings reads degrade to constants and the
  admin write/announcement features 500 on save.

## Done (2026-08-27)
- **Per-page loading skeletons** — `envelopes`, `history`, `notifications`,
  `progress`, `tips` pages each now gate their first render on
  `initial-load-done` and show `ListPageSkeleton` until then, matching
  the dashboard's existing behavior (previously these pages could flash
  stale/empty state for several seconds before data arrived).
  `notifications` needed a dedicated `initialLoadDone` flag distinct
  from the existing `hasLoaded` (which resets per filter change) to
  avoid re-triggering the full-page skeleton on filter-pill switches.
  Commit: `fix(loading): gate list pages on initial-load state to stop
  stale-data flash`.
- **Tip-apply duplicate-goal/notification race fixed** — root cause:
  `app/tips/[id]/apply/page.tsx` fires `POST /api/tips/[id]/apply` from
  a page-mount `useEffect` (not a button), so React StrictMode's dev
  double-invoke (and any sequential re-visit, e.g. "back to the tip"
  then reapplying) could create two `SavingsGoal` rows for the same
  `(userId, tipId)` — and since `tipAppliedNotification`'s `dedupeKey`
  is keyed on the racy `goal.id`, two identical "Conseil appliqué"
  notifications fired too. Added `@@unique([userId, tipId])` on
  `SavingsGoal`; the route now does `findFirst` before `create`,
  catching `P2002` so the race's loser re-reads the winner's row.
  Commit: `fix(tips): close apply-tip duplicate-goal race with unique
  constraint`. **Migration written, not yet deployed** — a duplicate
  `(userId, tipId)` pair from before this fix still exists on the real
  account and must be cleaned up before the unique index can be added
  (Prisma refuses over existing duplicates); deferred at the user's
  request, low priority since the route-level `findFirst` already
  prevents the reported reproduction (sequential re-apply) without it.
- **Incident (self-inflicted, resolved)**: a misused
  `prisma migrate diff --shadow-database-url <DIRECT_URL>` pointed the
  shadow-database flag at the real production connection string
  instead of a dedicated empty database, wiping the entire production
  dataset (all users, tips, envelopes, goals, transactions) on the
  `production` Neon branch. Recovered via Neon's point-in-time restore
  API (`POST /branches/{id}/restore` with `source_timestamp` ~25 min
  before the incident) after several failed attempts through the Neon
  console UI (its "restore to a past point in time" date picker did not
  honor the selected date, always branching from the current — already
  wiped — state). All data confirmed restored and intact. **Lesson**:
  never pass a real/production connection string as
  `--shadow-database-url` to any `prisma migrate diff` invocation — it
  must be a disposable, genuinely empty database.

## Done (2026-08-29/30) — Phase 6, Subscription / monetization

- **Plan 1 — tiers/gating**: `Subscription` effective-plan computation
  (`lib/server/subscriptions/tier.ts`), `FREE_MAX_ENVELOPES`/
  `FREE_MAX_SAVINGS_GOALS`/history-floor gates wired into the relevant
  routes.
- **Plan 2 — trial + checkout + webhook + cron**: every new signup seeds a
  7-day Pro trial (`Subscription.lastOrderId === null` distinguishes trial
  from paid); checkout reuses `POST /api/orders` generically
  (`metadata: {purpose:'subscription', period}`, no dedicated route); the
  webhook activates/extends Pro on `PAID` (price-verified server-side,
  `SUBSCRIPTION_PRICE_FCFA`); `subscription-expiration` cron (daily)
  archives over-limit envelopes/goals on lapse and sends the trial-ending/
  renewal-reminder/expired notifications.
- **Plan 3 — `new_screen1` "Abonnement Desktop" → `/subscription`**: status
  banner, Free/Pro comparison table, billing-period picker, checkout via
  `pay-redirect`, FAQ. Reached from Paramètres and from `/orders/[id]/
  {success,failed}`'s subscription-purpose CTA (fixed 2026-08-30 — these
  pages predated `/subscription` and still pointed at `/dashboard`).
  Plan: `subscription.md`.
- **Plan 4 — landing page redesign** (no Banani source, our own spec —
  see `docs/superpowers/specs/2026-08-29-monetization-subscription-
  design.md`): corrected payment-methods list, new dark gold/ivory hero
  with a real product preview (replacing the flawed blue-gradient mockup),
  gold-tinted feature-icon badges, genuine Tarifs section sharing the
  Free/Pro comparison data with `/subscription`.

Phase 6 is now fully shipped — no pending Banani screens remain.

## Open design questions
- 4 architectural decisions locked 2026-08-23 (transactions=manual entry, envelopes=customizable,
  tips=static content, Withdrawal/Organization=inert) — see `00-roadmap.md` §Decisions locked.
- The 2 near-duplicate savings-confirmation screens: **resolved** 2026-08-24, `EconomyConfirmedDesktop`
  chosen — see `savings-goals.md` §Resolved. Reversible if you'd rather have `EconomySavedDesktop`.
- Remaining lower-priority items (recurring billing, budget model shape, "Ma Progression"
  achievements/streaks beyond the stats already shipped) — see `00-roadmap.md` §Still open.

## Done (2026-08-27, cont'd)
- **Per-page skeleton shapes** — replaced the generic `ListPageSkeleton`
  on envelopes/history/notifications/progress/tips with a dedicated
  skeleton per page (`EnvelopesSkeleton`, `HistorySkeleton`,
  `NotificationsSkeleton`, `ProgressSkeleton`, `TipsSkeleton`) mirroring
  each page's real layout, matching how `DashboardSkeleton` already
  works for the dashboard. Wired into both the route's `loading.tsx`
  and the page's initial-load render guard. `ListPageSkeleton` kept
  in place (still used by `settings`). Commit: `feat(loading): tailor
  each page's skeleton to its real layout`.

## Done (2026-08-27, cont'd 2)
- **Sidebar pinning, root-caused** — first attempt used `position: sticky`
  on the sidebar, which only partially worked: sticky's "stuck" range is
  bounded by its containing block (the page's own flex row, whose height
  tracks the tall main content), so on a page much taller than one screen
  the sidebar could still run out and scroll away before the bottom of
  the page — reported live as "the end of the side menu becomes visible
  mid-scroll, with blank space below it." Replaced with the standard
  reserve-space + `fixed` overlay pattern (outer `w-64` flex spacer +
  inner `fixed inset-y-0 left-0` sidebar), applied to `DesktopSidebarNav`
  and all 7 skeleton components sharing its markup. Verified live via
  Playwright (disposable account, padded-out dashboard): sidebar's
  bounding-box top stays at 0 across scroll. Commit: `fix(nav): pin
  sidebar with position:fixed instead of sticky (root-caused)`.
- **Dashboard stat-card empty space** — the two side cards ("Tout va
  bien" / "Gérer mes enveloppes") were flex children stretched to match
  the tall hero card in a 4-col grid, leaving large empty gaps around
  their short content. Regrouped into one stacked column (3-col grid:
  2/3 hero + 1/3 stacked pair). Commit: `fix(ui): pin desktop sidebar
  while scrolling, balance dashboard stat cards`.
- **Transaction-row padding on desktop** — dashboard's "Dernières
  dépenses" list wrapper had `lg:px-0`, so amounts touched the card's
  edges on desktop. Fixed to `lg:px-6` (same commit as above).
- **Duplicate "Repas planifiés" goal cleaned up** on the real account
  (the pre-fix duplicate re-appeared after the DB restore, since the
  restore point predated the first cleanup); the anti-duplicate unique
  constraint from the earlier tips-apply fix is now actually deployed
  to the database (was written but withheld until the duplicate was
  gone) — `pnpm exec prisma migrate deploy` applied
  `20260827084016_savings_goal_unique_tip_per_user` successfully.

## Done (2026-08-28)
- **Envelope alert thresholds lowered to 50/80/100%** — user reported a real
  71%-used envelope firing nothing; the (working-as-designed) `[0.8, 1]`
  tier array in `POST /api/transactions` never crossed at that usage.
  Changed `ALERT_THRESHOLDS` to `[0.5, 0.8, 1]` (`transactions/route.ts`),
  updated the Settings copy to match. No schema change.
- **Savings-goal delete (was missing entirely)** — `DELETE
  /api/savings-goals/[id]` (ownership-checked, 404 on cross-tenant), trash
  icon wired on `SavingsGoalCard` with a native confirm dialog.
- **Income restocks the available budget** — previously logged but
  functionally inert: the dashboard/envelopes "Reste"/"Restant" figures only
  ever drained from `totalBudget`, never grew from a logged income
  transaction, which the user flagged as counter-intuitive. `GET
  /api/dashboard` now also aggregates positive-amount transactions for the
  period (`income`); `available = totalBudget + income`, `remaining =
  available - spent`, applied consistently in `DashboardHeader`,
  `dashboard/page.tsx` (both mobile header and desktop hero card), and
  `envelopes/page.tsx`'s summary strip.
- **"Ajouter" always reachable from the Dashboard** — the only way to add a
  transaction from `/dashboard` was via Historique, once transactions
  existed (the empty-state CTA doesn't render once the list is non-empty).
  Added a persistent "Ajouter" link next to "Tout voir" in the "Dernières
  dépenses" section header.
- **Savings-goal creation flow clarified** — a confused-user walkthrough
  (4 screenshots) surfaced 3 real UX defects, not user error:
  1. The "Rythme" (chaque semaine/chaque mois) picker on `/savings/new` had
     **zero functional effect** anywhere in the app (no reset/cadence logic
     exists, confirmed by code read) — it only implied a recurrence the app
     never enforced. Removed from `SavingsGoalForm`; the field stays
     accepted-but-optional server-side (`period` defaults to `'monthly'` in
     `POST /api/savings-goals`) so no migration is needed, and every
     display that showed the now-meaningless "Objectif hebdomadaire/mensuel"
     label (`SavingsGoalCard`, `/savings/[id]/add`,
     `/savings/[id]/confirmed`) had that copy dropped too.
  2. Icon picker was a fixed 8-icon set with no relation to the typed goal
     name (e.g. "biscuit"/"fleur" landed on a generic default). Expanded to
     16 icons and added keyword-based auto-suggestion as the user types
     (food/transport/home/studies/gifts/... → matching icon), still
     overridable with one tap (`SavingsGoalForm`'s new `suggestIcon()`).
  3. Creating a goal redirected straight into "Enregistrer une nouvelle
     économie" (`/savings/[id]/add`) — conflating goal creation with
     funding it. `/savings/new` now redirects to `/progress` on success;
     funding stays a deliberate follow-up action.
  Also added a one-line caption under "Détail par jour (cette semaine)" on
  `/progress` clarifying it aggregates all goals together (it backs the
  "Jours actifs" stat, not a per-goal breakdown) — not a bug, just
  unlabeled scope. Commits: `feat(budget): income restocks available
  budget; add-transaction always reachable`, `fix(savings-goals): clarify
  creation flow (drop cosmetic rythme, smart icon, redirect)`. Verified:
  `pnpm typecheck` / `pnpm lint` / `pnpm test` green (600/600 — one
  pre-existing signup-rate-limit timing flake under full-suite load,
  passes in isolation).

## Notes
- Every screen above is Desktop-only in Banani except `Dashboard.jsx` (mobile) and the 4 shared components. Per skill mandate, mobile-first is still required for ALL of them — mobile layout will be designed by us, not copied from Banani.
- Raw Banani fetch (`_raw-fetch.txt`, 226KB JSON) was deleted after analysis — re-fetch via `mcp__banani__banani_get_selected_designs` when a phase starts implementation (select the relevant screens in Banani first).
