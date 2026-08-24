# Chaque Franc — Implementation roadmap (Banani → izikit starter)

Source: Banani flow "Chaque Franc" (https://app.banani.co/flow/JvzUHP0KGNdG), 22 designs, `genType: "components"` (Banani returned JSX source directly, not raw HTML/CSS — it detected the Next.js/React stack).

## Product summary

A budget-envelope app for African students (FCFA/XOF, French UI, Douala references). Core loop:
monthly/weekly/daily budget → spend tracked against 5 color-coded envelopes (Nourriture, Transport,
Loisirs, Loyer, Santé) → savings goals ("Économies") tracked separately → AI-flavored financial tips →
gamified progress → freemium subscription (Gratuit / Plus 990 FCFA/mois / Pro 1990 FCFA/mois).

## Fit against the current starter

| Starter piece | Fit |
|---|---|
| Auth (JWT+refresh+CSRF, signup/login/verify-email, Google OAuth) | **Direct reuse.** The Banani "Inscription/Connexion" screen is a UI skin over flows that already exist end-to-end. |
| `Notification` model + `createNotification` + `/api/notifications*` | **Direct reuse.** `type` field already supports arbitrary categories — maps cleanly to the 3 Banani filters (Alertes / Conseils / Réalisations). |
| `Order` model + Bictorys `PaymentProvider` | **Reuse as the payment leg** of Subscription billing (mobile money charge, XOF, PENDING→PAID lifecycle already matches). Needs a thin `Subscription` model on top for plan/period state — Order alone has no recurrence concept. |
| `/settings` page (password, Google linking) | **Already built**, becomes a section inside the Banani "Paramètres" screen rather than a rewrite. |
| `Withdrawal`, `Organization`/multi-tenancy | **No match in any of the 22 screens.** Nothing in the flow withdraws money or has org/team concepts. Open question below — leave inert vs. prune. |
| Admin back-office (`/admin/*`) | Not shown in Banani flow (consumer-only flow was selected). Likely still useful later for moderating Tips content / support, but out of scope until asked for. |
| `Envelope`, `Transaction`, `SavingsGoal`, `SavingsEntry`, `Tip`, `Subscription`, user budget config | **New — nothing in the current schema models these.** See Data model below. |

## Data model additions (Prisma) — decisions locked 2026-08-23

```prisma
model Envelope {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String   // user-editable — envelopes are fully customizable (not the fixed 5)
  icon         String   // lucide icon name, user-picked from a curated list
  color        String   // swatch key from a curated palette (see below), NOT free-form hex
  monthlyLimit Int      // smallest unit (FCFA has no decimals)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  transactions Transaction[]

  @@index([userId])
}
```

**Customizable envelopes implication**: Banani's `@theme` only ships 5 fixed `--color-envelope-*`
tokens (food/transport/loisirs/loyer/sante), each hard-wired to `EnvelopeCard`'s `colorMap`. Since
envelopes are now user-created (not a fixed set), that map needs to become an open palette instead —
extend `@theme` to ~8-10 `--color-envelope-N` swatches, let `EnvelopeCard` key off `envelope.color`
generically, and the "create envelope" form offers a swatch picker instead of a category dropdown.
The 5 Banani categories become **seed defaults** offered at onboarding, not a hard limit.

```prisma

model Transaction {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  envelopeId String?   // null = income / uncategorized
  envelope   Envelope? @relation(fields: [envelopeId], references: [id], onDelete: SetNull)
  amount     Int       // signed, smallest unit (negative = expense, positive = income)
  label      String
  occurredAt DateTime  @default(now())
  createdAt  DateTime  @default(now())

  @@index([userId, occurredAt])
  @@index([envelopeId])
}

model SavingsGoal {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String   // e.g. "Transport malin"
  icon          String
  targetAmount  Int
  currentAmount Int      @default(0)
  period        String   // "weekly" | "monthly"
  createdAt     DateTime @default(now())

  entries SavingsEntry[]

  @@index([userId])
}

model SavingsEntry {
  id            String      @id @default(cuid())
  savingsGoalId String
  savingsGoal   SavingsGoal @relation(fields: [savingsGoalId], references: [id], onDelete: Cascade)
  amount        Int
  createdAt     DateTime    @default(now())

  @@index([savingsGoalId])
}

model Tip {
  id       String  @id @default(cuid())
  title    String
  body     String
  icon     String
  category String  // free-form, matched against envelope names for targeting (decision: static curated content, not AI-generated)
}

model Subscription {
  id                 String    @id @default(cuid())
  userId             String    @unique
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan               String    @default("FREE") // FREE | PLUS | PRO
  status             String    @default("ACTIVE") // ACTIVE | PAST_DUE | CANCELED
  currentPeriodEnd   DateTime?
  lastOrderId        String?   // FK-ish pointer to the Order that paid for the current period
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

`User` also needs budget config for onboarding step 2 ("Ton budget"): `totalBudget Int?` +
`budgetFrequency String?` ("monthly"|"weekly"|"daily") — unless the "separate `Budget` model with
history" option is chosen (see open questions).

## New API routes (Route Handlers, `runtime = 'nodejs'`, `requireAuth` + `verifyCsrf` on mutations)

- `/api/envelopes` — GET (list), POST (create, user-chosen name/icon/color/limit)
- `/api/envelopes/[id]` — PATCH, DELETE
- `/api/transactions` — GET (list, paginated), POST (create — manual entry, decision locked)
- `/api/savings-goals` — GET, POST
- `/api/savings-goals/[id]/entries` — POST (the "Ajouter une économie" action)
- `/api/tips` — GET (list, static curated content, seeded/admin-authored), `/api/tips/[id]/apply` — POST
- `/api/subscription` — GET (current plan), POST `/upgrade` (creates an `Order` via Bictorys, on webhook PAID flips `Subscription.plan`)
- `/api/onboarding` — POST (persists budget config + initial envelopes in one transaction)

Reused as-is: `/api/auth/*`, `/api/notifications*`, `/api/webhooks/bictorys` (extended to also flip
`Subscription` on a subscription-tagged Order, via `metadata`).

## Design tokens (Banani `style.css` → `frontend/src/app/globals.css`)

Banani shipped a Tailwind v4 `@theme` block — directly compatible with this starter's zero-config
Tailwind v4 setup (`globals.css` is currently just `@import 'tailwindcss';`). Port verbatim:

- Colors: `background #FAF7F2`, `foreground #1A1208`, `primary #1E6B45` (green), `secondary #F5C842`
  (yellow), `accent #E8612A` (orange/alert), plus 5 `envelope-*` category colors.
- Fonts: body = DM Sans, headings = Space Grotesk (not yet in `package.json` — need `next/font/google`).
- Radii: sm 6px / md 12px / lg 18px / xl 28px. Text scale: xs 11px → 4xl 48px.

## Phase order (see STATUS.md for the screen checklist per phase)

0. Foundation — tokens, primitives, schema migration
1. Marketing + Auth + Onboarding (landing, login/signup, first-run budget setup)
2. Core budgeting loop (dashboard, envelopes, history, **+ new "Ajouter une transaction" screen —
   no Banani source, we design it mobile-first on the same pattern as "Ajouter une économie")
3. Savings goals + progress/gamification
4. Tips (static curated content)
5. Notifications + Settings (mostly wiring existing pieces)
6. Subscription / monetization

Rationale: 0→2 gets a usable budgeting app end-to-end before layering the differentiators (savings
goals, tips, monetization) that depend on it existing first.

## Decisions locked (2026-08-23)

1. **Transactions**: manual entry. We design an "Ajouter une transaction" screen ourselves (Phase 2) —
   no Banani source for it, follows the same interaction pattern as "Ajouter une économie".
2. **Envelopes**: fully user-customizable (name/icon/color/limit), not the fixed 5. The 5 Banani
   categories become onboarding seed defaults. See "Customizable envelopes implication" above for the
   palette-token consequence.
3. **Tips**: static curated content (seeded/admin-authored `Tip` rows), not AI-generated.
   ⚠️ **Copy mismatch to flag**: the Abonnement screen's Plus/Pro tiers advertise "Conseils
   personnalisés IA" — that copy now overpromises vs. the static-content implementation. Either soften
   the pricing copy when we build `/subscription`, or revisit AI generation later as a real Plus/Pro
   differentiator. Not blocking Phase 0-4; needs a call before Phase 6 ships.
4. **Withdrawal / Organization**: left inert, untouched. Reversible — revisit if the product grows
   into payouts or team accounts.

## Still open (lower priority — will default sensibly unless redirected before the relevant phase)

- Recurring subscription billing: auto monthly re-charge via cron, or user manually re-pays each
  period for MVP simplicity? Default: manual re-pay for MVP (no recurring-billing cron in Phase 6).
- Budget config: fields on `User` vs. a separate historized `Budget` model? Default: `User` fields
  (simpler; revisit if "change my budget over time with history" becomes a real feature request).
- "Ma Progression" achievements/streaks: haven't read that screen's full body yet — will spec the
  data model when Phase 3 starts, unless you already have a specific badges/streaks system in mind.
- Two near-duplicate screens, `EconomyConfirmedDesktop.jsx` vs `EconomySavedDesktop.jsx` (same
  "savings confirmed" moment): which is canonical? And `CancelAddEconomyDesktop.jsx` is a Banani
  naming artifact (displayName + source both say "Ma Progression Desktop", byte-identical to
  `MyProgressDesktop.jsx`) — will confirm it's not a real distinct screen when Phase 3 starts.
6. **Two near-duplicate screens**: `EconomyConfirmedDesktop.jsx` vs `EconomySavedDesktop.jsx` (same
   "savings confirmed" moment, different layout width/detail). Which is canonical? And
   `CancelAddEconomyDesktop.jsx` is a Banani naming artifact (displayName + source both say "Ma
   Progression Desktop") — confirm it's not a real distinct screen before we skip it.
