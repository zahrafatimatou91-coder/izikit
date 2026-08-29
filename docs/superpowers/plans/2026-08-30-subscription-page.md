# Page /subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/subscription` page itself — bandeau de statut, accroche, tableau comparatif Free/Pro, toggle de facturation avec paiement réel, FAQ — plus le lien depuis Paramètres, en s'appuyant entièrement sur ce que les Plans 1 et 2 ont déjà livré (`GET /api/subscription`, `POST /api/orders` générique, le webhook qui active Pro).

**Architecture:** Une seule page client (`'use client'`), dans le même shell de navigation que le reste de l'appli (`DesktopSidebarNav` + `BottomNav`, comme `/settings` ou `/tips/[id]`). Le paiement réutilise `POST /api/orders` tel quel avec `metadata: { purpose: 'subscription', period }` — aucune nouvelle route de checkout. Un correctif de sécurité côté serveur est nécessaire en premier : rien aujourd'hui ne vérifie que le montant envoyé par le client correspond au vrai prix du palier choisi, ce qui deviendrait exploitable dès que cette page envoie de vraies commandes.

**Tech Stack:** Next.js 16 App Router (Client Components), le wrapper `api()` existant, Tailwind v4 avec les tokens déjà en place (`--color-primary` vert, `--color-secondary` or, `--color-accent` orange).

**Spec:** [docs/superpowers/specs/2026-08-29-monetization-subscription-design.md](../specs/2026-08-29-monetization-subscription-design.md) — Chantier 2 (contenu, copy, bandeau de statut, essai, FAQ).

## Global Constraints

- Ne jamais qualifier les Conseils personnalisés d'« IA » — aucune ligne de copy de cette page ne doit le faire.
- Montants en FCFA = entiers, jamais de décimales (`amount: 1500` / `13500`, jamais `1500.00`).
- `frontend/src/lib/api.ts` reste protégé — la page l'utilise tel quel (pas de modification).
- Le prix réellement facturé est déterminé côté serveur (Task 1) — le client propose un montant mais ne fait jamais foi seul.
- Copy exacte du spec pour : l'accroche, le bandeau de statut (4 variantes), le tableau comparatif, la FAQ (3 questions) — reproduite verbatim dans les tâches ci-dessous.
- `Subscription.currentPeriodEnd` n'est jamais effacé par le cron d'expiration (Plan 2) — il reste à sa dernière valeur connue même après le passage en FREE. C'est ce qui permet de distinguer "jamais eu Pro" (`currentPeriodEnd: null`) de "Pro expiré" (`currentPeriodEnd` dans le passé) côté client, sans changement serveur.

---

## File Structure

- `frontend/src/lib/server/subscriptions/tier.ts` **(modifié)** — ajoute `SUBSCRIPTION_PRICE_FCFA`, la seule source de vérité serveur pour le prix attendu par période.
- `frontend/src/app/api/webhooks/bictorys/route.ts` **(modifié)** — `onPaid` refuse d'activer/prolonger Pro si `order.amount` ne correspond pas au prix attendu pour la période déclarée.
- `frontend/src/lib/subscription-plans.ts` **(nouveau)** — constantes de prix **côté client** (fichier sans `server-only`, ne peut pas importer `tier.ts`) : dupliquées délibérément, avec un commentaire renvoyant vers `tier.ts` comme source de vérité. Un écart entre les deux ferait au pire afficher un prix différent de celui réellement facturé — jamais l'inverse, puisque le serveur (Task 1) reste seul juge de ce qu'il accepte.
- `frontend/src/app/subscription/page.tsx` **(nouveau)** — la page elle-même.
- `frontend/src/app/settings/page.tsx` **(modifié)** — ajoute une section "Abonnement" avec un lien vers `/subscription`.

---

### Task 1: Le serveur vérifie le prix avant d'activer Pro

**Files:**
- Modify: `frontend/src/lib/server/subscriptions/tier.ts`
- Modify: `frontend/src/app/api/webhooks/bictorys/route.ts`
- Test: `frontend/src/app/api/webhooks/bictorys/route.test.ts`

**Interfaces:**
- Produces: `SUBSCRIPTION_PRICE_FCFA: Record<'monthly' | 'annual', number>` exporté de `tier.ts`.

**Pourquoi maintenant :** `POST /api/orders` accepte n'importe quel `amount` dans le corps de la requête (c'est une route de paiement générique, pas spécifique à l'abonnement). Rien aujourd'hui n'empêche un client de créer une commande avec `metadata: { purpose: 'subscription', period: 'annual' }` et `amount: 1` — le webhook activerait quand même 365 jours de Pro pour 1 FCFA. Cette page est le premier endroit qui va réellement déclencher ce flux ; le correctif doit exister avant.

- [ ] **Step 1: Write the failing test**

Dans `frontend/src/app/api/webhooks/bictorys/route.test.ts`, ajouter ce test juste après `'onPaid does not touch Subscription for a non-subscription order'` :

```ts
  it('onPaid refuses to activate Pro when the amount does not match the expected price', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o4',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1, // way below the real monthly price
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'monthly' },
    });
    outboxCreate.mockResolvedValue({ id: 'ob4' });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    expect(subscriptionUpsert).not.toHaveBeenCalled();
    expect(envelopeUpdateMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter frontend exec vitest run src/app/api/webhooks/bictorys/route.test.ts -t "does not match the expected price"`
Expected: FAIL — today's code has no price check, so `subscriptionUpsert` gets called anyway.

- [ ] **Step 3: Add the price constant to tier.ts**

In `frontend/src/lib/server/subscriptions/tier.ts`, append after `SUBSCRIPTION_RENEWAL_REMINDER_DAYS`:

```ts
/** Expected price in FCFA for each paid period — the server's own source of
 * truth. `POST /api/orders` accepts any client-supplied `amount` (it's a
 * generic checkout, not subscription-specific), so the webhook (see
 * app/api/webhooks/bictorys/route.ts) checks the paid amount against this
 * table before activating/extending Pro — otherwise a client could request
 * an arbitrarily low `amount` for a subscription-purpose order and still
 * get a full period of Pro. Keep in sync with the display-only
 * `SUBSCRIPTION_PRICES` in `src/lib/subscription-plans.ts` (a client-safe
 * file that can't import this server-only module) — a drift there would at
 * worst show the wrong price, never accept the wrong one, since this table
 * is what the server actually enforces. */
export const SUBSCRIPTION_PRICE_FCFA: Record<'monthly' | 'annual', number> = {
  monthly: 1500,
  annual: 13500,
};
```

- [ ] **Step 4: Enforce the price check in the webhook**

In `frontend/src/app/api/webhooks/bictorys/route.ts`, update the import:

```ts
import {
  parseSubscriptionOrderMetadata,
  SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_PRICE_FCFA,
} from '@/lib/server/subscriptions/tier';
```

Then change the subscription-activation branch from:

```ts
    const subMeta = parseSubscriptionOrderMetadata(order.metadata);
    if (subMeta && order.userId) {
      const existingSub = await tx.subscription.findUnique({ where: { userId: order.userId } });
```

to:

```ts
    const subMeta = parseSubscriptionOrderMetadata(order.metadata);
    const expectedPrice = subMeta ? SUBSCRIPTION_PRICE_FCFA[subMeta.period] : null;
    if (subMeta && order.userId && order.amount === expectedPrice) {
      const existingSub = await tx.subscription.findUnique({ where: { userId: order.userId } });
```

(Everything inside the `if` block stays exactly as-is; only the condition changes. A mismatched amount now falls through to the unchanged generic `enqueueOutbox` calls below — the payment-received notification/email still fire, since the money genuinely arrived, but no Pro period is granted for it. This mirrors the existing "unknown charge — log + drop" posture used elsewhere in this same file rather than throwing, since a webhook throw would retry indefinitely.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter frontend exec vitest run src/app/api/webhooks/bictorys/route.test.ts`
Expected: PASS (all tests, including the two pre-existing subscription-activation tests from Plan 2 — both use the real prices `1500`/implicitly-monthly amounts that already match `SUBSCRIPTION_PRICE_FCFA`, so they're unaffected).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/server/subscriptions/tier.ts frontend/src/app/api/webhooks/bictorys/route.ts frontend/src/app/api/webhooks/bictorys/route.test.ts
git commit -m "fix(subscriptions): verify the paid amount before activating Pro"
```

---

### Task 2: Constantes de prix côté client

**Files:**
- Create: `frontend/src/lib/subscription-plans.ts`
- Test: `frontend/src/lib/subscription-plans.test.ts`

**Interfaces:**
- Produces: `SUBSCRIPTION_PRICES: Record<'monthly' | 'annual', number>`, `getDailyEquivalentFcfa(annualPriceFcfa: number): number` — consommés par Task 3.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/subscription-plans.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_PRICES, getDailyEquivalentFcfa } from './subscription-plans';

describe('SUBSCRIPTION_PRICES', () => {
  it('matches the spec prices', () => {
    expect(SUBSCRIPTION_PRICES.monthly).toBe(1500);
    expect(SUBSCRIPTION_PRICES.annual).toBe(13500);
  });
});

describe('getDailyEquivalentFcfa', () => {
  it('rounds 13 500/365 to 37', () => {
    expect(getDailyEquivalentFcfa(13500)).toBe(37);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter frontend exec vitest run src/lib/subscription-plans.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement the module**

Create `frontend/src/lib/subscription-plans.ts`:

```ts
// frontend/src/lib/subscription-plans.ts
//
// Client-safe subscription display constants — NOT under lib/server/, no
// `server-only` import, so it can be used from 'use client' pages. Deliber-
// ately duplicates the two numbers also declared in
// lib/server/subscriptions/tier.ts's SUBSCRIPTION_PRICE_FCFA (a server-only
// file this can't import). That table is what the webhook actually
// enforces (see its price-check in onPaid) — a drift here would at worst
// display the wrong price, never charge the wrong one.
export const SUBSCRIPTION_PRICES: Record<'monthly' | 'annual', number> = {
  monthly: 1500,
  annual: 13500,
};

/** Daily-equivalent framing for the annual price ("~37 FCFA/jour") — makes
 * the total look more affordable without changing the real price. Rounded
 * to the nearest franc (FCFA has no sub-unit). */
export function getDailyEquivalentFcfa(annualPriceFcfa: number): number {
  return Math.round(annualPriceFcfa / 365);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter frontend exec vitest run src/lib/subscription-plans.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/subscription-plans.ts frontend/src/lib/subscription-plans.test.ts
git commit -m "feat(subscriptions): add client-safe pricing constants"
```

---

### Task 3: La page /subscription

**Files:**
- Create: `frontend/src/app/subscription/page.tsx`

**Interfaces:**
- Consumes: `GET /api/subscription` (Plan 1, response `{ plan, status, currentPeriodEnd, isTrial }`), `POST /api/orders` (existing generic route) with `metadata: { purpose: 'subscription', period }`, `SUBSCRIPTION_PRICES` / `getDailyEquivalentFcfa` (Task 2), `useUser` from `@/contexts/AuthContext`, `useToast`, `api`/`ApiError` from `@/lib/api`, `Icon`, `BottomNav`, `DesktopSidebarNav` (`active="settings"` — this page is a Settings sub-page, same convention as `/tips/[id]` keeping `active="tips"`), `ListPageSkeleton`, `/api/pay-redirect` (existing route, wraps `paymentUrl` for in-app-browser safety).

No colocated test file — matches this codebase's established convention (no page-level tests exist for `/settings`, `/tips/[id]`, or the Plan 2 order pages either; page logic here is a thin composition of already-tested API calls).

- [ ] **Step 1: Create the page**

Create `frontend/src/app/subscription/page.tsx`:

```tsx
// /subscription — status banner, comparatif Free/Pro, paiement, FAQ. Reached
// from Paramètres ("Abonnement" section) and from every contextual "passe à
// Pro" reminder elsewhere in the app (envelope limit reached, savings goals
// gate, Tendances/Conseils gates — see subscriptions/tier.ts consumers).
//
// Checkout reuses POST /api/orders as-is (see docs/superpowers/specs/
// 2026-08-29-monetization-subscription-design.md, "Implications
// techniques") — no dedicated checkout route. The webhook
// (app/api/webhooks/bictorys/route.ts) is what actually turns a PAID order
// into an active Pro period; this page only starts the checkout and lands
// back on /orders/[id]/success once Bictorys redirects the user home.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { ListPageSkeleton } from '@/components/skeletons/ListPageSkeleton';
import { SUBSCRIPTION_PRICES, getDailyEquivalentFcfa } from '@/lib/subscription-plans';
import { formatPrice } from '@/lib/utils';

interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  status: string;
  currentPeriodEnd: string | null;
  isTrial: boolean;
}

type BillingPeriod = 'monthly' | 'annual';

const FEATURE_ROWS: { label: string; free: string; pro: string }[] = [
  { label: 'Enveloppes', free: '2 max', pro: 'Illimitées' },
  { label: "Objectifs d'épargne", free: '—', pro: 'Illimités' },
  { label: 'Historique', free: '2 derniers mois', pro: 'Complet' },
  { label: 'Tendances', free: '—', pro: '✓' },
  { label: 'Conseils personnalisés', free: '—', pro: '✓' },
  { label: 'Notifications', free: 'Dépassement uniquement', pro: 'Toutes' },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Puis-je annuler quand je veux ?',
    a: 'Oui, tu restes Pro jusqu’à la fin de la période payée, puis tu repasses en Free.',
  },
  {
    q: 'Je perds mes données si je repasse en Free ?',
    a: 'Non, jamais. Le surplus est archivé, pas supprimé — tout revient si tu repasses en Pro.',
  },
  {
    q: 'Comment je paie ?',
    a: 'Wave, Orange Money, Free Money ou carte.',
  },
];

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  PAYMENT_PROVIDER_UNCONFIGURED: "Le paiement n'est pas encore configuré. Réessaie plus tard.",
  PAYMENT_PROVIDER_UNAVAILABLE:
    'Le service de paiement est temporairement indisponible. Réessaie dans un instant.',
  PAYMENT_FAILED: 'Le paiement a échoué. Réessaie ou choisis un autre moyen de paiement.',
  PAYMENT_IN_FLIGHT: 'Un paiement est déjà en cours — réessaie dans quelques secondes.',
};

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function SubscriptionPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelInfoOpen, setCancelInfoOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<SubscriptionStatus>('/api/subscription')
      .then(setSub)
      .catch((err) =>
        setLoadError(
          err instanceof ApiError ? err.message : 'Impossible de charger ton abonnement.',
        ),
      );
  }, [user]);

  if (!user) return <ListPageSkeleton rows={6} />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;
  const isProNow = sub?.plan === 'PRO';
  const isTrialNow = isProNow && sub?.isTrial === true;
  const wasProBefore = sub?.plan === 'FREE' && sub?.currentPeriodEnd !== null;

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await api<{ id: string; paymentUrl: string | null; status: string }>(
        '/api/orders',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: {
            amount: SUBSCRIPTION_PRICES[period],
            currency: 'XOF',
            metadata: { purpose: 'subscription', period },
          },
        },
      );
      if (!res.paymentUrl) {
        toast('Le paiement est indisponible pour le moment. Réessaie plus tard.', 'error');
        return;
      }
      window.location.href = `/api/pay-redirect?u=${encodeURIComponent(btoa(res.paymentUrl))}`;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (CHECKOUT_ERROR_MESSAGES[err.code] ?? 'Impossible de démarrer le paiement. Réessaie.')
          : 'Impossible de démarrer le paiement. Réessaie.';
      toast(message, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="settings"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip pb-28 lg:pb-0">
        <div className="flex items-center gap-4 border-b border-border bg-card px-4 py-5 lg:px-8 lg:py-6">
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon i="arrow-left" size={20} />
          </button>
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">Abonnement</h2>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            {/* Bandeau de statut */}
            <div className="rounded-lg border border-border bg-card p-5">
              {loadError && <p className="font-body text-sm text-accent">{loadError}</p>}
              {!loadError && !sub && (
                <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              )}
              {!loadError && sub && (
                <>
                  {isTrialNow && sub.currentPeriodEnd && (
                    <p className="font-body text-sm font-medium text-foreground">
                      Tu profites de 7 jours d'essai Pro, jusqu'au{' '}
                      {formatDateLong(sub.currentPeriodEnd)}.
                    </p>
                  )}
                  {isProNow && !isTrialNow && sub.currentPeriodEnd && (
                    <div className="flex flex-col gap-2">
                      <p className="font-body text-sm font-medium text-foreground">
                        Tu es Pro jusqu'au {formatDateLong(sub.currentPeriodEnd)}.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCancelInfoOpen((v) => !v)}
                        className="self-start font-body text-xs font-medium text-muted-foreground underline"
                      >
                        Annuler mon abonnement
                      </button>
                      {cancelInfoOpen && (
                        <p className="font-body text-xs text-muted-foreground">
                          Aucune carte n'est jamais débitée automatiquement — il n'y a donc rien à
                          annuler. Tu resteras Pro jusqu'au{' '}
                          {formatDateLong(sub.currentPeriodEnd)}, puis tu repasseras
                          automatiquement sur le plan Free.
                        </p>
                      )}
                    </div>
                  )}
                  {wasProBefore && sub.currentPeriodEnd && (
                    <p className="font-body text-sm font-medium text-foreground">
                      Ton abonnement Pro a expiré le {formatDateLong(sub.currentPeriodEnd)} —
                      repasse en Pro pour tout débloquer à nouveau.
                    </p>
                  )}
                  {!isProNow && !wasProBefore && (
                    <p className="font-body text-sm font-medium text-foreground">
                      Tu es sur le plan Free.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Accroche */}
            <div className="flex flex-col gap-2">
              <h1 className="font-headings text-2xl font-bold text-foreground lg:text-3xl">
                Passe à Pro et commence à épargner
              </h1>
              <p className="font-body text-sm text-muted-foreground">
                Enveloppes illimitées, objectifs d'épargne, tendances et conseils personnalisés —
                tout ce qu'il te faut pour garder le contrôle, un franc à la fois.
              </p>
            </div>

            {/* Tableau comparatif */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="pb-3 font-body text-xs font-medium text-muted-foreground">
                      &nbsp;
                    </th>
                    <th className="pb-3 font-body text-sm font-bold text-foreground">Free</th>
                    <th className="rounded-t-lg border border-b-0 border-secondary bg-secondary/10 px-3 pb-3 pt-3 text-center">
                      <span className="font-body text-sm font-bold text-foreground">Pro</span>
                      <span className="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 font-body text-[10px] font-bold text-secondary-foreground">
                        Recommandé
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row, i) => (
                    <tr key={row.label}>
                      <td className="border-t border-border py-3 pr-3 font-body text-sm text-foreground">
                        {row.label}
                      </td>
                      <td className="border-t border-border py-3 pr-3 font-body text-sm text-muted-foreground">
                        {row.free}
                      </td>
                      <td
                        className={`border-x border-secondary bg-secondary/10 px-3 py-3 text-center font-body text-sm font-medium text-foreground ${
                          i === FEATURE_ROWS.length - 1 ? 'rounded-b-lg border-b' : ''
                        }`}
                      >
                        {row.pro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Facturation */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPeriod('monthly')}
                  className={`rounded-lg border px-4 py-3 text-center font-body text-sm font-bold ${
                    period === 'monthly'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-foreground'
                  }`}
                >
                  Mensuel
                  <span className="mt-1 block font-body text-xs font-normal opacity-80">
                    {formatPrice(SUBSCRIPTION_PRICES.monthly)} F/mois
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('annual')}
                  className={`relative rounded-lg border px-4 py-3 text-center font-body text-sm font-bold ${
                    period === 'annual'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-foreground'
                  }`}
                >
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-2 py-0.5 font-body text-[10px] font-bold whitespace-nowrap text-secondary-foreground">
                    Le plus populaire
                  </span>
                  Annuel
                  <span className="mt-1 block font-body text-xs font-normal opacity-80">
                    {formatPrice(SUBSCRIPTION_PRICES.annual)} F/an
                  </span>
                </button>
              </div>
              {period === 'annual' && (
                <p className="mb-4 text-center font-body text-xs text-muted-foreground">
                  3 mois offerts — soit ~{getDailyEquivalentFcfa(SUBSCRIPTION_PRICES.annual)}{' '}
                  FCFA/jour
                </p>
              )}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {checkoutLoading
                  ? 'Redirection en cours…'
                  : isProNow
                    ? `Prolonger mon abonnement — ${formatPrice(SUBSCRIPTION_PRICES[period])} F`
                    : `Passer à Pro — ${formatPrice(SUBSCRIPTION_PRICES[period])} F`}
              </button>
            </div>

            {/* FAQ */}
            <div className="flex flex-col gap-3">
              <h3 className="font-headings text-lg font-bold text-foreground">Questions fréquentes</h3>
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {FAQ_ITEMS.map((item) => (
                  <details key={item.q} className="group px-5 py-4 lg:px-6">
                    <summary className="cursor-pointer list-none font-body text-sm font-medium text-foreground">
                      {item.q}
                    </summary>
                    <p className="mt-2 font-body text-sm text-muted-foreground">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `pnpm --filter frontend exec eslint "src/app/subscription/**" && pnpm --filter frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check on the dev server**

Run: `pnpm dev`, log in as a dev user, visit `/subscription`. Confirm: the status banner matches your account's real state (Free / trial / Pro / expired), the comparison table renders with the Pro column visually emphasized, toggling Mensuel/Annuel updates the price and the "3 mois offerts" line, clicking "Passer à Pro" (with `BICTORYS_*` env vars unset) surfaces the `PAYMENT_PROVIDER_UNCONFIGURED` toast rather than a silent failure or a raw error dump, and "Annuler mon abonnement" (only visible on a paid, non-trial Pro account) expands the informational text without any network call.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/subscription/page.tsx
git commit -m "feat(subscriptions): add the /subscription page"
```

---

### Task 4: Lien depuis Paramètres

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `SectionCard`, `Row` from `@/components/settings/primitives` (already imported in this file).

- [ ] **Step 1: Add the import**

In `frontend/src/app/settings/page.tsx`, add to the imports:

```ts
import Link from 'next/link';
```

- [ ] **Step 2: Add the section**

Insert a new `SectionCard` right after the `{/* Préférences */}` section and before `{/* Budget */}`:

```tsx
            {/* Abonnement */}
            <SectionCard title="Abonnement">
              <Row
                label="Plan Free / Pro"
                value="Passe à Pro, gère ton essai ou ton abonnement"
                action={
                  <Link href="/subscription" className="font-body text-sm font-medium text-primary">
                    Voir
                  </Link>
                }
              />
            </SectionCard>

            {/* Budget */}
```

- [ ] **Step 3: Lint + typecheck**

Run: `pnpm --filter frontend exec eslint src/app/settings/page.tsx && pnpm --filter frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat(settings): link to the /subscription page"
```

---

## Self-Review

**Spec coverage:**
- Bandeau de statut, les 4 variantes exactes (Free / essai / Pro actif + annulation / Pro expiré) → Task 3. ✅
- Accroche (texte exact) → Task 3. ✅
- Tableau comparatif avec colonne Pro mise en avant (bordure + fond teinté + badge "Recommandé") → Task 3. ✅
- Toggle Mensuel/Annuel, annuel pré-sélectionné, badge "Le plus populaire", "3 mois offerts", équivalent journalier → Task 2 (calcul) + Task 3 (affichage). ✅
- FAQ (3 questions, texte exact) → Task 3. ✅
- Jamais qualifier les Conseils d'« IA » → vérifié dans toute la copy de Task 3 (ligne "Conseils personnalisés" seule, sans qualificatif). ✅
- Réutilisation de `POST /api/orders` existant, aucune nouvelle route de checkout → Task 3 appelle directement la route générique. ✅
- Lien accessible depuis Paramètres → Task 4. ✅
- Faille de prix non contrôlé côté serveur, identifiée pendant la recherche de ce plan (absente du spec original — un gap découvert en implémentant le premier vrai appelant de la route de paiement) → corrigée en Task 1 avant que la page existe.

**Hors scope de CE plan (rappel) :** les petits rappels contextuels "Fonctionnalité Pro" ailleurs dans l'app (limite d'enveloppes atteinte, etc.) — le spec les mentionne mais ils vivent dans chacune des pages concernées (Enveloppes, Objectifs, Tendances, Conseils), pas sur `/subscription` elle-même ; à traiter au fil de l'eau sur chaque page concernée plutôt que dans un plan dédié. Le Plan 4 (refonte du hero + reste de la landing page) reste indépendant et non affecté par ce plan.

**Placeholder scan :** aucun "TODO"/"TBD" ; le seul renvoi différé (petits rappels contextuels) est explicitement documenté ci-dessus, pas laissé en suspens dans le code.

**Type consistency :** `SubscriptionStatus` (Task 3) correspond exactement à la réponse JSON de `GET /api/subscription` (Plan 1) ; `BillingPeriod` correspond aux clés de `SUBSCRIPTION_PRICES` (Task 2) et à `metadata.period` consommé par le webhook (Plan 2, Task 1 de ce plan) ; `SUBSCRIPTION_PRICE_FCFA` (serveur) et `SUBSCRIPTION_PRICES` (client) portent les mêmes valeurs, dupliquées consciemment avec un commentaire croisé dans les deux fichiers.
