# Admin back-office — Banani → Next.js 16

## Source

- Banani flow: `Chaque Franc` — `https://app.banani.co/flow/JvzUHP0KGNdG`
- Fetched: 2026-09-02
- Screens selected (6):
  | Banani file | screenName | Maps to |
  |---|---|---|
  | `AdminDashboard.jsx` | Admin — Vue d'ensemble | `/admin` |
  | `AdminUsersTable.jsx` | Admin — Utilisateurs | `/admin/users` (+ `/admin/users/[id]`) |
  | `AdminSubscriptions.jsx` | Admin — Gestion des abonnements | `/admin/subscriptions` |
  | `AdminTransactions.jsx` | Admin — Transactions | `/admin/transactions` |
  | `AdminConfiguration.jsx` | Admin — Configuration | `/admin/config` |
  | `AdminCoupons_next1.jsx` | Admin — Coupons | **DEFERRED** (see below) |

Design tokens are 1:1 with the app's existing `globals.css` (`--color-primary #1E6B45`,
`font-headings Space Grotesk`, `font-body DM Sans`, …). No `@theme` additions needed.

## Existing backend (already shipped — Phase 5) — REUSED AS-IS

| Route | Method | Role | Notes |
|---|---|---|---|
| `/api/admin/me` | GET | ADMIN | `{ admin, can[] }` capability list — drives conditional UI |
| `/api/admin/users` | GET | ADMIN | `q`, `status`, `role`, cursor pagination → `{ items, nextCursor }` |
| `/api/admin/users/[id]` | GET | ADMIN | single user detail |
| `/api/admin/users/[id]/role` | PATCH | SUPERADMIN | `{ role }`; refuses last-SUPERADMIN demote |
| `/api/admin/users/[id]/status` | PATCH | ADMIN* | `{ status: ACTIVE\|SUSPENDED }`; restore/suspend gated to SUPERADMIN |
| `/api/admin/orders` | GET | ADMIN | `status`, `since`, `until`, cursor |
| `/api/admin/withdrawals` | GET | ADMIN | `status`, `since`, `until`, cursor |
| `/api/admin/withdrawals/[id]/cancel` | POST | SUPERADMIN | advisory-lock + Serializable, audited |
| `/api/admin/audit-log` | GET | ADMIN | `actor`, `action`, `targetType`, `since`, `until`, cursor |
| `/api/admin/outbox`, `/email-queue`, `/rate-limits` | GET | ADMIN | ops introspection |

Every mutation already goes through `logAdminAction(prisma, …)` → `AdminAction` row.
Every admin route: `runtime='nodejs'`, `requireAdmin`/`requireSuperadmin`,
`enforceAdminRateLimit`, `withRequestContext`.

## NEW backend

### 1. `AppSetting` model (new) — key/value config store

```prisma
model AppSetting {
  key       String   @id            // "subscription.pricing", "support.email", "announcement"
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?                  // AdminAction.actorId of the last writer
}
```

Migration: `pnpm db:migrate:dev --name add_app_setting`.

### 2. `lib/server/settings/` — typed accessors

- `getSubscriptionPricing()` → `{ monthly: number; annual: number }`.
  Reads `AppSetting["subscription.pricing"]`; **falls back to the
  `SUBSCRIPTION_PRICE_FCFA` constant** in `tier.ts` when the row is absent
  or malformed. The constant stays as the compile-time default / floor.
- `getSupportEmail()` → string (fallback `SUPPORT_EMAIL` env or a constant).
- `getAnnouncement()` → `{ message: string; tone: 'info'|'warn' } | null`.
- `setSetting(key, value, actorId)` — writes the row + `logAdminAction`.
- Values are validated with a per-key Zod schema before write.
- **No caching in v1** (settings reads are rare — webhook, `/api/pricing`,
  `/api/admin/*`). A short `unstable_cache` / Redis layer is a documented
  follow-up if it shows up in traces.

### 3. New routes

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/admin/overview` | GET | ADMIN | KPI aggregates for `/admin` (see below) |
| `/api/admin/subscriptions` | GET | ADMIN | list `Subscription` rows joined w/ user email — `plan`, `trial`, `expiring` filters, cursor |
| `/api/admin/settings` | GET | ADMIN | current values of all known settings + their defaults |
| `/api/admin/settings` | PATCH | SUPERADMIN | `{ key, value }` — validated, audited (`action: "settings.update"`) |
| `/api/admin/users/[id]/subscription` | POST | SUPERADMIN | `{ action: "grant"\|"revoke", period?, days? }` — comp/revoke Pro manually, audited (`action: "subscription.grant"` / `.revoke"`), reuses `subscriptions/archive.ts` for the revoke downgrade |
| `/api/pricing` | GET | public | `{ monthly, annual }` from `getSubscriptionPricing()` — consumed by `/subscription` page + landing so the displayed price tracks the admin-set price |

`/api/admin/overview` returns:
```
{
  users: { total, byPlan: { free, pro }, activeTrials, newLast30d },
  signups: [{ month: "2026-04", count }, … 6 buckets],   // from User.createdAt
  revenue: { mrrFcfa, paidSubs, arpuFcfa },               // Σ active paid Pro, monthly-normalized
  system: { db: true, redis: bool, email: bool, payments: bool },  // env-presence booleans ONLY
  recentUsers: [ …5 rows { id, name, email, plan, createdAt } ]
}
```

### 4. Wire dynamic pricing into existing code

- `webhook/bictorys/route.ts` + `webhook/moneroo/route.ts`: replace
  `SUBSCRIPTION_PRICE_FCFA[period]` with `await getSubscriptionPricing()`
  then `[period]`. (Exact-equality check unchanged. Edge: if the admin
  changes the price between checkout-start and webhook, the paid amount
  won't match and Pro isn't granted — user retries. Documented, acceptable
  at this scale; a `>=` check would re-open the low-amount exploit the
  original comment warns about.)
- `/subscription` page + `app/page.tsx` (landing Tarifs): fetch `/api/pricing`
  instead of importing `SUBSCRIPTION_PRICES` directly. Keep the constant as
  the SSR/first-paint default to avoid a layout flash.

## Screen-by-screen — deviations from Banani (project rule wins)

### `/admin` — Vue d'ensemble
- **KEEP**: sidebar, 4 KPI cards, a 6-month signups bar chart, system-status
  panel, recent-users table.
- **CHANGE**: KPIs become real (users total / Pro actifs / essais / MRR).
  The Banani MRR chart used `Math.random()` — replaced with real monthly
  signup counts (the only 6-month series we can compute without a new
  aggregation pipeline). Labelled "Inscriptions" not "MRR" to stay honest.
- **CHANGE**: "État du système" — `Base de données / File / Emails` →
  `Base de données / Redis / Emails / Paiements`, each a boolean from env
  presence. **Never renders a key value.**
- **DROP**: "Envoyer une annonce globale" button as a broadcast-to-every-bell
  action (fan-out cost). REPLACED by an **announcement banner** setting
  (edit on `/admin/config`, shown app-wide) — same product goal, cheap.

### `/admin/users` + `/admin/users/[id]`
- **KEEP**: search, stat cards, table, pagination, row actions.
- **CHANGE**: stat cards real (actifs / suspendus / Pro / essais).
- **CHANGE**: columns → user, email, rôle, plan, statut, inscription, actions.
  **DROP "Solde"** — this app has no user wallet/balance concept.
- **DROP** "Nouvel utilisateur" — signup is self-serve; admins don't create users.
- **DROP** the trash/delete icon → replaced with **Suspendre** (existing
  status route). Hard GDPR delete is a separate, careful feature — not v1.
- Pagination: Banani shows numbered pages; backend is **cursor-based** →
  render "Précédent / Suivant" (cursor stack), not page numbers.
- Detail page (`[id]`): identity + rôle + statut + subscription state +
  envelope/goal counts + recent orders. Actions (role-gated via `can[]`):
  changer rôle, suspendre/réactiver, **accorder / révoquer Pro**.

### `/admin/subscriptions`
- **CHANGE**: Banani shows a Standard/Premium/Pro trio at 0/2500/5000 FCFA.
  Reality is **Free + Pro only**, Pro at 1 500 FCFA/mois or 13 500 FCFA/an
  (`PLUS` is a reserved-but-unused enum value). Render **two** plan cards:
  Free (fixed, non-editable) and Pro.
- The Pro card's monthly + annual price are **editable inline** (SUPERADMIN
  only; `can` gates the input). Save → `PATCH /api/admin/settings` →
  confirmation dialog warning "s'applique immédiatement aux nouveaux
  paiements". Trial length shown, **read-only** in v1 (editing it is
  low-value and touches signup).
- Active-subscriptions table: `GET /api/admin/subscriptions` — user, plan,
  essai/payé badge, début, échéance, dernier paiement. Filters:
  plan, essais, expirant < 7j. Row action → open user detail.
- **DROP** "Nouvel abonnement" button and per-row edit/delete — comp/revoke
  lives on the user detail page (one clear place).

### `/admin/transactions`
- **KEEP**: search, filter, stat cards, table, pagination.
- **CHANGE**: two tabs — **Paiements** (`Order`) and **Retraits**
  (`Withdrawal`) — instead of one blended list with fictional
  Paiement/Remboursement/Virement types.
- Paiements: existing `/api/admin/orders`. Columns: id, user, objet
  (abonnement mensuel/annuel/autre — from `metadata.purpose`), montant,
  moyen (`paymentMethod`), statut, date. Read-only + detail drawer.
  **No "refund" action** — not implemented server-side; flagged as future.
- Retraits: existing `/api/admin/withdrawals`. Columns: id, user, montant,
  destination (masquée), statut, demandé le. **Annuler** action (SUPERADMIN,
  existing cancel route, confirm dialog with a required reason).
- Stat cards real: volume payé (30j), nb paiements, retraits en attente,
  taux de réussite.
- Pagination → cursor "Précédent / Suivant".

### `/admin/config` — Configuration
- **KEEP**: "Paramètres généraux" + sectioned card layout + "Zone de danger"
  visual.
- Sections kept, made real:
  - **Général**: email de support (editable → `AppSetting`), devise
    (read-only "XOF" — the app is FCFA-only), fuseau (read-only "UTC" —
    all timestamps are UTC).
  - **Bannière d'annonce**: message + ton (info/alerte) + on/off. Shown
    app-wide when set. (This is the "annonce globale" from the dashboard.)
  - **État des intégrations** (read-only booleans): Redis, Resend, Bictorys,
    Moneroo, Google OAuth, Cloudinary — "configuré / non configuré" only.
  - **Journal d'audit** — embedded viewer over `/api/admin/audit-log`
    (filters: acteur, action, type de cible, période; cursor pagination).
- **DROP entirely**:
  - "Clés API" (pk_live/sk_live) — the app has no public API; the real keys
    are Vercel deploy secrets, never surfaced or editable from a browser.
  - "Authentification 2FA", "Whitelist IP", "Sessions actives" — none exist;
    building a fake toggle is a broken affordance.
  - "Supprimer toutes les données de test", "Réinitialiser la base de
    données" — destructive, no endpoint, must never be a web button.
  - Notification email toggles — those are **per-user** prefs
    (`/settings`), not a global admin setting.

### Coupons — DEFERRED (recommend a separate feature)
Not "manage existing information" — a coupon system is a new subsystem:
`Coupon` model, redemption at checkout (`POST /api/orders` amount logic +
the webhook's exact-equality price check would need to become
coupon-aware), per-coupon usage tracking, expiry cron. Out of scope for
"stand up the admin over what already exists." Flagged for its own
spec + plan.

## Shell / layout

`frontend/src/app/admin/layout.tsx` — `'use client'`:
- Gate: `GET /api/admin/me` → non-admin `router.replace('/')`, render a
  skeleton during the round trip (mirrors `examples/frontend-pages/admin/layout.tsx`).
- Sidebar (Banani visual): brand mark + "Admin", primary nav
  (Vue d'ensemble, Utilisateurs, Abonnements, Transactions), "Système"
  group (Configuration). Active state from `usePathname()`.
- `can[]`-aware: SUPERADMIN-only nav/badges hidden for ADMIN.
- Footer: admin email + role, "Retour à l'app", "Se déconnecter".
- **Responsive** (skill mandate): sidebar is a fixed rail ≥ `lg`, a
  slide-over drawer < `lg` opened from a top-bar hamburger. Tables scroll
  inside `overflow-x-auto` on narrow screens. Admin is desktop-first in
  intent but must not break on a phone.

Shared components under `frontend/src/components/admin/`:
`AdminShell` sub-parts, `DataTable` (generic, cursor pager), `StatCard`,
`FilterBar`, `Badge` variants (plan / status / txn-status), `ConfirmDialog`
(reuse existing `@/components/ui/ConfirmDialog`), `AuditLogViewer`.

## Data-shape gaps to resolve during implementation

- `/api/admin/users` `USER_SELECT` has no plan — the users table needs the
  subscription plan per row. Options: (a) add a `subscription: { select:
  { plan, currentPeriodEnd, lastOrderId } }` include to that route, or
  (b) a second `/api/admin/subscriptions?userIds=` batch. → **(a)**, it's
  the natural join and the route is ours to extend.
- `effectivePlan` must use `getEffectivePlan(sub)` (live compute), never the
  raw `plan` column (cron lag). Do this server-side in the route.

## Implementation checklist

- [ ] `AppSetting` model + migration
- [ ] `lib/server/settings/` accessors + Zod schemas + tests
- [ ] Wire `getSubscriptionPricing()` into both webhooks + `/api/pricing`
- [ ] `GET /api/admin/overview` (+ test)
- [ ] `GET /api/admin/subscriptions` (+ test)
- [ ] `GET/PATCH /api/admin/settings` (+ test)
- [ ] `POST /api/admin/users/[id]/subscription` grant/revoke (+ test)
- [ ] Extend `/api/admin/users` select with subscription
- [ ] `app/admin/layout.tsx` + `components/admin/*` shell
- [ ] `/admin` overview page
- [ ] `/admin/users` + `/admin/users/[id]`
- [ ] `/admin/subscriptions`
- [ ] `/admin/transactions`
- [ ] `/admin/config` (+ embedded audit-log viewer)
- [ ] App-wide announcement banner (reads `getAnnouncement()`)
- [ ] `/subscription` + landing read `/api/pricing`
- [ ] 375 / 768 / 1280 responsive check
- [ ] `pnpm format && lint && typecheck && test && build`

## Open questions for the user

1. **Coupons** — confirm DEFER to a separate feature? (strong recommend: yes)
2. **Dropped Banani sections** (API-keys UI, 2FA, IP-whitelist, reset-DB,
   delete-test-data, hard user-delete) — confirm OK to drop / replace as above?
3. **Price editing** — SUPERADMIN edits Pro monthly + annual, effective
   immediately on new checkouts, existing paid periods untouched. Trial
   length stays read-only. OK?
4. **"Grant Pro" comp** — should a comped Pro (admin-granted, no payment)
   be flagged distinctly from a trial and a paid sub? (proposal:
   `lastOrderId = "comp:<adminId>"` sentinel so `isTrial()` stays false and
   reporting can tell them apart.)
