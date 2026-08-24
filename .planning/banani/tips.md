# Tips (Conseils) — Banani → Next.js

## Source
- `AllTipsDesktop.jsx` → `/tips`
- `TipDetailDesktop.jsx` → `/tips/[id]` (fully designed for one example, "Transport malin")
- `ApplyTipDesktop.jsx` → `/tips/[id]/apply`
- Fetched: 2026-08-24, explicit `screenIds` (none of these were selected in Banani at fetch time).

## Copy mismatch (already flagged in roadmap, resurfaces here)
`AllTips`'s title ("Conseils personnalisés") and intro banner ("Nous avons personnalisé des
conseils basés sur tes enveloppes et ton profil de dépenses") both claim per-user personalization.
The locked decision is **static curated content, not AI/personalized**. Softened to "Conseils" /
"Des conseils pratiques pour économiser sur tes dépenses courantes, choisis par catégorie." — still
honest about the one real piece of targeting we do (see below).

## What "static curated" still allows: category-matching, not personalization
`Tip.category` (already in the schema, comment: "matched against envelope names for targeting") is
used to sort tips whose category name loosely matches one of the user's real envelope names to the
top of the list. This is a plain case-insensitive substring match, no AI, no per-user content
generation — just re-ordering a fixed library. Keeps the "static curated" decision intact while
making the copy's remaining claim ("choisis par catégorie") true.

## Data model change
- `Tip.estimatedSavingsFcfa Int?` — editorial "économies possibles" figure, shown on the card badge
  and the detail hero. Nullable — not every curated tip needs one.
- `SavingsGoal.tipId String?` + `tip Tip? @relation(onDelete: SetNull)` — "Appliquer ce conseil"
  creates (or reuses, idempotently) a `SavingsGoal` seeded from the tip. `SetNull` so deleting a tip
  later doesn't cascade-delete goals a user already created from it.
- Migration: `<generated>`.

## Dropped from the Banani source (flagging each)
- **`AllTips`'s "Conseils pour tes enveloppes personnalisées" section** — Banani frames the last 3
  cards (Santé/Scolarité/Objectifs) as dynamically generated for the user's custom envelopes, but
  they're just 3 more static example cards in the mock. Folded into one flat grid of 9 tips instead
  of implying a dynamic-generation mechanism that doesn't exist (would misrepresent static content
  as personalized — the exact anti-pattern the roadmap already flagged).
- **`TipDetail`'s 2nd/3rd stat ("28% D'économie", "15 Jours pour voir l'effet")** — fabricated
  numbers that exist only for the one worked example (Transport malin); none of the other 8 tips'
  card content implies a percentage or a day-count. Rather than invent 2 more schema fields to hold
  numbers for a single illustrative example, kept only the real `estimatedSavingsFcfa` stat.
- **`TipDetail`'s "Exemple réel" comparison box** (50 000 F → 36 000 F → ~14 000 F saved) — specific
  to the moto-taxi-vs-bus illustration, doesn't generalize to a "Nourriture" or "Loyer" tip. Would
  need `beforeAmount`/`afterAmount` fields to hold a comparison that's only ever populated for one
  tip. Dropped; the numbered "Comment ça marche" steps carry the actual guidance.
- **`ApplyTip`'s day-by-day checkboxes** — Banani's own mock ships them uncontrolled (no `onChange`,
  no state) — even the source design doesn't wire them to anything. Keeping inert checkboxes that
  look interactive but silently do nothing is a broken affordance, not a faithful port. Rendered as
  a plain reference list (no checkbox input) instead.
- **`ApplyTip`'s inline "Enregistrer ton économie" form** — this is the same amount+note+submit form
  already built and tested in Phase 3 (`/savings/[goalId]/add`). Duplicating it here risks two code
  paths writing `SavingsEntry` drifting apart. `/tips/[id]/apply` instead shows the created goal's
  progress card and a "Ajouter une économie" button that routes to the existing `/savings/[goalId]/add`.

## Content authoring note
Banani only fully designed the detail page for one tip ("Transport malin"). The other 8 tips have
card-level blurbs from `AllTips` but no detail-page body. Wrote a short "Comment ça marche" body
(2-3 sentences) for each of the remaining 8, extending their existing card description — same
curatorial posture as designing empty/loading states Banani didn't ship. `Tip.body` stores this as
plain paragraphs (blank-line separated), rendered as a numbered list on the detail page — no
separate structured "steps" field, keeps the schema minimal for what's still just a single text blob.

## API routes
- `GET /api/tips` — list, sorted with envelope-category matches first (see above).
- `GET /api/tips/[id]` — one tip's full detail.
- `POST /api/tips/[id]/apply` — idempotent: returns the existing `SavingsGoal` if the user already
  applied this tip, else creates one (`name` = tip title, `icon` = tip icon, `targetAmount` =
  `tip.estimatedSavingsFcfa ?? 2000`, `period` = `'monthly'`, `tipId` = tip id).

## Seed data
- `frontend/scripts/seed-tips.ts` — idempotent (`upsert` keyed on `title`), NOT gated behind
  `NODE_ENV !== production` like `seed-dev.ts` (tip content is real app content for every
  environment, not dev-only test fixtures). `pnpm seed:tips`.
- 9 tips ported from the Banani source content: Transport malin, Repas planifiés, Loisirs groupés,
  Partage logement, Abonnements reviews, Fonds d'urgence, Santé optimisée, Études économes,
  Objectifs clairs.

## Component breakdown
- **NEW** `TipCard` (`src/components/tips/`) — grid card for `/tips`.
- Reuse `Icon`, `formatPrice`, `DesktopSidebarNav`, `BottomNav`.

## Navigation
- Same situation as Phase 3's "Objectifs": Banani's own 3 fetched screens keep the sidebar at 4
  items. Added "Conseils" (`lightbulb` icon) to `DesktopSidebarNav` (plenty of room) and `BottomNav`
  (now 7 items — flagging that mobile bottom-nav real estate is getting tight; still clears the
  48px touch-target minimum but is worth revisiting if more top-level sections get added later).

## Responsive plan
Same posture as Phase 3 — Banani only gave desktop for these 3. Mobile: stacked full-width cards,
`BottomNav`, simplified top bar. Desktop (`lg:`+): `DesktopSidebarNav` + the layouts above.

## Implementation checklist
- [ ] Migration: `Tip.estimatedSavingsFcfa`, `SavingsGoal.tipId`
- [ ] `scripts/seed-tips.ts` + `pnpm seed:tips`
- [ ] API routes (3)
- [ ] `TipCard`
- [ ] `/tips`, `/tips/[id]`, `/tips/[id]/apply`
- [ ] Nav: "Conseils" in both nav components
- [ ] 375px / 1280px checks, empty states, typecheck/lint/build/test
- [ ] `STATUS.md` update

## Open questions for user
- None blocking — all resolved via the drops/simplifications above, each flagged for veto.
