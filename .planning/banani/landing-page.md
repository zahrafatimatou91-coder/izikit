# Landing Page — Banani → Next.js (re-fetch, desktop + mobile both real)

## Source
- `JvzUHP0KGNdG/screens/new_screen4.jsx` — "Chaque Franc — Landing Page" (desktop, 1440px)
- `JvzUHP0KGNdG/screens/LandingPageMobile.jsx` — "Chaque Franc — Landing Page Mobile" (375px)
- Fetched: 2026-08-24 (re-fetch — Phase 1's `page.tsx` was built by hand-adapting only the desktop
  screen; the mobile screen didn't exist in Banani yet at that time, so Phase 1 guessed the mobile
  layout and dropped the dashboard-preview mockup as an unverifiable guess. Both concerns are now
  resolved: Banani has since shipped a real mobile screen, and the mockup appears in both.)

## What changed vs. the current `page.tsx`
1. **Dashboard preview mockup reinstated.** Both Banani screens show a decorative "browser window"
   card in the hero (fake chrome bar + sidebar nav + balance card + 4-envelope grid, all static
   demo numbers). Phase 1 dropped this as "would need hand-sync with the real dashboard" — but
   it's explicitly a marketing screenshot (fake URL bar reads `app.chaquefranc.com`), not a live
   embed, so there's nothing to sync. Reinstating it as static decorative content.
2. **Mobile is no longer guessed.** Banani's mobile screen has genuinely different (shorter) copy
   throughout — not just a CSS reflow of the desktop copy. Headlines, section eyebrows, feature
   card text, testimonial quotes, and the final CTA are all independently authored, shorter
   strings tuned for a small viewport. This is implemented as two sibling top-level blocks
   (`lg:hidden` / `hidden lg:flex`) rather than trying to force one merged responsive string set —
   the two designs diverge enough in content (not just layout) that merging them would either
   truncate the desktop copy or bloat the mobile one.

## Component breakdown
- **REUSE** `Icon` (`src/components/ui/Icon.tsx`) — 1:1, kebab-case names match Banani.
- **REUSE** `UserAvatar` (`src/components/ui/UserAvatar.tsx`) — Banani's stock version takes
  `gender/ageGroup/heritage/index` (fake demo generator); project's real component takes
  `name/avatarUrl/className` (established Phase 0). Hero row uses placeholder names
  (`Étudiant 1..4`); testimonial avatars use the testimonial's own name.
- No new components needed — this page is a one-off composition of marketing sections.

## Token / syntax translation notes
- Banani inline `style={{fontSize:'84px', lineHeight:'1.05'}}` → `text-[84px] leading-[1.05]`
  (project forbids inline styles). Same for the 40px/1.2 mobile variant and the two gradient
  `style={{background: 'linear-gradient(...)'}}` blocks → arbitrary-value `bg-[linear-gradient(...)]`.
- Banani `style={{width: pct}}` on progress bars (static demo %) → arbitrary Tailwind width
  (`w-[68%]`, `w-[47%]`, …) — no inline style, same static value.
- `bg-white bg-opacity-20` → `bg-white/20` (Tailwind v4 opacity-slash convention already used
  elsewhere in this codebase).
- `opacity-8` / `border-3` are not real Tailwind scale values (Banani generator artifacts) →
  `opacity-[0.08]` and `border-2` respectively.
- All `{t('...')}` wrappers stripped — this project has no i18n layer; French strings are written
  directly in JSX (matches every other page already shipped).
- `<button>` for navigation-triggering CTAs ("Commencer", "Essayer gratuitement" ×2) → `<Link
  href="/signup">` — these are real route transitions, not decorative buttons.
- Section-anchor nav links (`#fonctionnalites`, `#tarifs`, `#a-propos`) stay plain `<a href="#...">`
  (same-page scroll, not a route change).
- Footer `Confidentialité` / `Conditions` / `Contact` stay `<a href="#">` placeholders — Banani
  didn't design real pages for these and none exist yet in the app; unchanged from Phase 1.

## Responsive plan
- **Mobile block (`lg:hidden`, unprefixed classes, ~375px baseline)**: faithful port of
  `LandingPageMobile.jsx` — single-column hero, stacked CTA, mockup card at full width, 1-column
  feature/testimonial cards, stacked footer.
- **Desktop block (`hidden lg:flex`, `lg:` is the effective baseline here since the block is
  invisible below `lg`)**: faithful port of `new_screen4.jsx` — nav links visible, 2-column
  feature/step/testimonial grids, wide hero with side-by-side social proof.
- No intermediate `sm:`/`md:` tuning inside either block — Banani only provided two discrete
  breakpoints (375 and 1440), so the switch happens at one boundary (`lg`, 1024px) rather than
  inventing an unverified tablet-only layout.

## Interactions / state
- Static marketing page — no forms, no auth-gating, no loading/error state. `Link`s use Next's
  built-in prefetch; no client JS needed (server component, matches current `page.tsx`).

## Copy / i18n
- All strings inline in JSX (project convention — no `constants.ts` i18n layer exists).

## Implementation checklist
- [x] Fetch both screens from Banani
- [x] Write this plan
- [ ] Rebuild `frontend/src/app/page.tsx` as two responsive blocks
- [ ] 375px check (mobile block renders, no horizontal scroll)
- [ ] 1280px check (desktop block matches Banani screen)
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build`
- [ ] Update `STATUS.md`

## Open questions for user
- None blocking — the mockup's sidebar shows "Objectifs" as a nav item (Banani's own creative
  liberty; the real sidebar's 3rd item is "Historique", per `DesktopSidebarNav`). Since this is
  decorative marketing chrome (not the real nav), I kept Banani's copy as-is rather than forcing
  it to match — flagging in case you'd rather it read "Historique" for consistency.
