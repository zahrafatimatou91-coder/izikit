# Banani implementation status — Chaque Franc

Last updated: 2026-08-23

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

## In progress
_(none — ready to start Phase 3)_

## Pending — grouped by phase (see roadmap for rationale/order)

### Phase 3 — Savings goals (Économies)
- [ ] `AddEconomyDesktop.jsx` → `/savings/[goalId]/add` — plan: `savings-add.md`
- [ ] `EconomyConfirmedDesktop.jsx` **or** `EconomySavedDesktop.jsx` (near-duplicate — see open questions) → `/savings/[goalId]/confirmed`
- [ ] `MyProgressDesktop.jsx` → `/progress` — plan: `progress.md`
- [ ] `CancelAddEconomyDesktop.jsx` — ⚠️ Banani naming bug: internal `displayName` is "Ma Progression Desktop", byte-identical source to `MyProgressDesktop.jsx`. Not a real distinct screen until confirmed otherwise.

### Phase 4 — Tips (contenu statique curaté, pas d'IA — voir décisions dans 00-roadmap.md)
- [ ] `AllTipsDesktop.jsx` → `/tips` — plan: `tips.md`
- [ ] `TipDetailDesktop.jsx` → `/tips/[id]`
- [ ] `ApplyTipDesktop.jsx` → `/tips/[id]/apply`

### Phase 5 — Notifications + Settings
- [ ] `NotificationsDesktop.jsx` → `/notifications` — plan: `notifications.md` (reuses existing `Notification` model/routes)
- [ ] `SettingsDesktop.jsx` → merge into existing `frontend/src/app/settings/page.tsx`

### Phase 6 — Subscription / monetization
- [ ] `new_screen1` "Abonnement Desktop" → `/subscription` — plan: `subscription.md` (reuses `Order` + Bictorys `PaymentProvider`)

## Open design questions
- 4 architectural decisions locked 2026-08-23 (transactions=manual entry, envelopes=customizable,
  tips=static content, Withdrawal/Organization=inert) — see `00-roadmap.md` §Decisions locked.
- Remaining lower-priority items (recurring billing, budget model shape, achievements data model,
  the 2 near-duplicate savings-confirmation screens) — see `00-roadmap.md` §Still open.

## Notes
- Every screen above is Desktop-only in Banani except `Dashboard.jsx` (mobile) and the 4 shared components. Per skill mandate, mobile-first is still required for ALL of them — mobile layout will be designed by us, not copied from Banani.
- Raw Banani fetch (`_raw-fetch.txt`, 226KB JSON) was deleted after analysis — re-fetch via `mcp__banani__banani_get_selected_designs` when a phase starts implementation (select the relevant screens in Banani first).
