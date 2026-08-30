# Landing Page Redesign (Chantier 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `frontend/src/app/page.tsx` (the public landing page) per Chantier 3 of the monetization spec: fix the wrong payment-methods list, replace the generic-SaaS hero with a dark warm-brown/gold hero carrying new copy and a real product preview, fix the gradient-square icon boxes in "Fonctionnalités", and add a genuine "Tarifs" section that reuses the Free/Pro comparison data already built for `/subscription`.

**Architecture:** No new routes, no server changes — this is a presentational rewrite of a single client-agnostic page component (`page.tsx` has no `'use client'`, it's a plain server component with static marketing content). One small DRY refactor extracts `FEATURE_ROWS` (currently duplicated nowhere yet, but about to be needed twice) into the existing client-safe `src/lib/subscription-plans.ts` so both `/subscription` and `/` render the identical Free/Pro comparison. The rest is JSX/Tailwind changes inside `page.tsx`, following its existing convention of fully duplicated MOBILE (`lg:hidden`)/DESKTOP (`hidden lg:flex`) render trees, with small shared sub-components (`HeroProductPreview`, `PricingCard`) consumed by both trees — mirroring how the pre-existing `DashboardMockup` was already shared via a `compact` prop.

**Tech Stack:** Next.js 16 App Router, React server components, Tailwind v4 (`@theme` tokens in `globals.css`), the curated `Icon` component (`src/components/ui/Icon.tsx`), `lucide-react` icon keys `wallet`/`target`/`check-circle`/`arrow-right`/`star` (all already present in the `ICONS` map — confirmed via grep, no new entries needed).

**Spec:** `docs/superpowers/specs/2026-08-29-monetization-subscription-design.md`, Chantier 3 (landing page hero + pricing).

## Global Constraints

- Color semantics are non-negotiable: `--color-primary` (`#1e6b45`, green) = action/positive only. `--color-secondary` (`#f5c842`, gold) = brand-decorative (hero badges, keyword highlight, brand wordmark) **or** the sole "budget tendu" indicator inside a preview budget bar — never both meanings in the same visual spot. `--color-accent` (`#e8612a`, red-orange) is reserved for real alerts and must never appear in the hero or in any marketing mockup.
- The hero sits on a fixed dark background (`linear-gradient(160deg, #4a3c28 0%, #2e2417 100%)`) regardless of the app's light/dark theme — text inside it uses hardcoded ivory (`#faf7f2`) via arbitrary Tailwind values, not the theme-aware `text-foreground`/`text-muted-foreground` tokens (those would be unreadable or wrong-colored on a fixed dark backdrop). This matches the file's existing convention of hardcoded arbitrary values for the fixed-color hero/CTA bands (e.g. the existing `bg-primary` final CTA section already hardcodes against theme switching).
- Mobile hero content order: titre → sous-titre → aperçu produit compact → CTA + réassurance → les 2 badges fonctionnalités (badges last).
- Desktop hero content order (left column): marque (brand kicker) → titre → sous-titre → les 2 badges fonctionnalités → CTA → réassurance (badges *before* CTA, unlike mobile). Right column: aperçu produit.
- Reassurance copy: "Sans carte bancaire · Actif en 5 minutes" (replaces "Aucune carte bancaire requise").
- Headline: "Sais où part **chaque franc**, avant la fin du mois." (keyword gold-accented). Subtitle: "Tu ranges ton argent en enveloppes dès qu'il rentre. L'app te dit ce qu'il reste dans chacune, en temps réel."
- Payment methods must read `Wave`, `Orange Money`, `Free Money`, `Carte bancaire` (Bictorys-supported only — MTN MoMo and Airtel Money are not).
- Étapes and Témoignages sections are confirmed out of scope — no changes.
- `pnpm format && pnpm lint && pnpm typecheck && pnpm test` must pass before considering any task done.

---

### Task 1: Share `FEATURE_ROWS` into `subscription-plans.ts`

**Files:**
- Modify: `frontend/src/lib/subscription-plans.ts`
- Modify: `frontend/src/app/subscription/page.tsx:35-42` (remove local const, import shared one)

**Interfaces:**
- Produces: `export interface FeatureRow { label: string; free: string; pro: string }` and `export const FEATURE_ROWS: FeatureRow[]` from `@/lib/subscription-plans` — consumed by Task 5's new Tarifs section and by `/subscription/page.tsx`.

- [ ] **Step 1: Add `FeatureRow`/`FEATURE_ROWS` to the shared file**

Append to `frontend/src/lib/subscription-plans.ts`:

```ts
/** Free/Pro comparison rows — shared between `/subscription` (the full
 * comparison table) and the landing page's Tarifs section (a condensed
 * pricing-card list), so the two never drift out of sync. */
export interface FeatureRow {
  label: string;
  free: string;
  pro: string;
}

export const FEATURE_ROWS: FeatureRow[] = [
  { label: 'Enveloppes', free: '2 max', pro: 'Illimitées' },
  { label: "Objectifs d'épargne", free: '—', pro: 'Illimités' },
  { label: 'Historique', free: '2 derniers mois', pro: 'Complet' },
  { label: 'Tendances', free: '—', pro: '✓' },
  { label: 'Conseils personnalisés', free: '—', pro: '✓' },
  { label: 'Notifications', free: 'Dépassement uniquement', pro: 'Toutes' },
];
```

- [ ] **Step 2: Point `/subscription/page.tsx` at the shared const**

In `frontend/src/app/subscription/page.tsx`, change the import line:

```ts
import { SUBSCRIPTION_PRICES, getDailyEquivalentFcfa } from '@/lib/subscription-plans';
```

to:

```ts
import {
  SUBSCRIPTION_PRICES,
  getDailyEquivalentFcfa,
  FEATURE_ROWS,
} from '@/lib/subscription-plans';
```

Then delete the local `const FEATURE_ROWS: { label: string; free: string; pro: string }[] = [...]` block (lines 35-42) entirely — the import now provides it with the same name and shape, so no other line in the file needs to change.

- [ ] **Step 3: Verify**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: no errors (the `FeatureRow` shape is identical to the old inline type, so `row.label`/`row.free`/`row.pro` usages in the JSX below stay valid).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/subscription-plans.ts frontend/src/app/subscription/page.tsx
git commit -m "refactor(subscriptions): share FEATURE_ROWS with the landing page"
```

---

### Task 2: Fix the payment-methods list

**Files:**
- Modify: `frontend/src/app/page.tsx:5`

**Interfaces:** none (local const only, consumed at lines ~265 and ~522 in both render trees — no signature change).

- [ ] **Step 1: Replace the const**

```ts
const PAYMENT_METHODS = ['Wave', 'Orange Money', 'Free Money', 'Carte bancaire'];
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: no errors (both render loops already iterate `PAYMENT_METHODS` generically by string value — no other line references the old 4 labels by name).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "fix(landing): correct payment methods to Bictorys-supported list"
```

---

### Task 3: Rewrite the hero (mobile + desktop) with `HeroProductPreview`

**Files:**
- Modify: `frontend/src/app/page.tsx` — delete `SIDEBAR_PREVIEW`/`ENVELOPE_PREVIEW` consts and the `DashboardMockup` function (lines 7-19, 93-184); add `HERO_BADGES`/`HERO_ENVELOPES_DESKTOP`/`HERO_ENVELOPES_MOBILE`/`HERO_GOAL` consts and `HeroEnvelopeRow`/`HeroProductPreview` components; replace the mobile hero `<section>` (lines 201-257) and the desktop hero `<section>` (lines 452-511).

**Interfaces:**
- Produces: `function HeroProductPreview({ compact = false }: { compact?: boolean })` — a self-contained preview panel, no props beyond `compact`, called once in each render tree exactly like the `DashboardMockup` it replaces.

- [ ] **Step 1: Delete the old preview data and component**

Delete lines 7-19 (`ENVELOPE_PREVIEW`, `SIDEBAR_PREVIEW` consts) and the entire `DashboardMockup` function (lines 93-184) from `frontend/src/app/page.tsx`.

- [ ] **Step 2: Add the new preview data and components**

Insert in their place (same spot, right after the `PAYMENT_METHODS` const and before `FEATURES_DESKTOP`):

```tsx
interface PreviewEnvelope {
  cat: string;
  pct: number;
  tendu: boolean;
}

const HERO_ENVELOPES_DESKTOP: PreviewEnvelope[] = [
  { cat: 'Nourriture', pct: 65, tendu: false },
  { cat: 'Transport', pct: 40, tendu: false },
  { cat: 'Famille', pct: 85, tendu: true },
];

const HERO_ENVELOPES_MOBILE: PreviewEnvelope[] = [
  { cat: 'Nourriture', pct: 65, tendu: false },
  { cat: 'Famille', pct: 85, tendu: true },
];

const HERO_GOAL = { name: 'Ordinateur portable', pct: 55 };

const HERO_BADGES = [
  {
    icon: 'wallet' as const,
    title: 'Enveloppes',
    desc: 'Alloue ton argent avant de le dépenser.',
  },
  {
    icon: 'target' as const,
    title: 'Objectifs',
    desc: 'Suis ta progression, jour après jour.',
  },
];

function HeroEnvelopeRow({ e }: { e: PreviewEnvelope }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        e.tendu ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="font-body text-sm font-bold text-foreground">{e.cat}</p>
        <p
          className={`font-body text-sm font-bold ${e.tendu ? 'text-amber-700' : 'text-primary'}`}
        >
          {e.pct}%
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${e.tendu ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${e.pct}%` }}
        />
      </div>
    </div>
  );
}

function HeroProductPreview({ compact = false }: { compact?: boolean }) {
  const envelopes = compact ? HERO_ENVELOPES_MOBILE : HERO_ENVELOPES_DESKTOP;
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border bg-white shadow-lg lg:rounded-3xl lg:shadow-2xl">
      <div className="flex items-center gap-2 border-b-2 border-border bg-input px-3 py-3 lg:gap-3 lg:px-6 lg:py-4">
        <div className="flex gap-1.5 lg:gap-2">
          <div className="h-2 w-2 rounded-full bg-muted lg:h-3 lg:w-3" />
          <div className="h-2 w-2 rounded-full bg-muted lg:h-3 lg:w-3" />
          <div className="h-2 w-2 rounded-full bg-muted lg:h-3 lg:w-3" />
        </div>
        <div className="ml-2 flex-1 truncate rounded border border-border bg-background px-2 py-1 font-body text-xs text-muted-foreground lg:ml-4 lg:rounded-lg lg:px-4 lg:py-2">
          {compact ? 'chaquefranc.com' : 'app.chaquefranc.com'}
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-background p-4 lg:gap-6 lg:p-8">
        <div className="rounded-xl bg-primary p-5 text-primary-foreground shadow-md lg:rounded-2xl lg:p-8 lg:shadow-lg">
          <p className="mb-2 text-xs opacity-75 lg:mb-3 lg:text-sm">Reste ce mois-ci</p>
          <p className="font-headings text-2xl font-bold lg:text-4xl">182 400 F</p>
        </div>

        <div className="flex flex-col gap-2 lg:gap-3">
          {envelopes.map((e) => (
            <HeroEnvelopeRow key={e.cat} e={e} />
          ))}
        </div>

        {!compact && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 font-body text-sm font-bold text-foreground">
                <Icon i="target" size={14} className="text-primary" />
                {HERO_GOAL.name}
              </p>
              <p className="font-body text-sm font-bold text-primary">{HERO_GOAL.pct}%</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${HERO_GOAL.pct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the mobile hero section**

Replace the `<section className="relative overflow-hidden px-4 pb-12 pt-16">...</section>` block (originally lines 201-257) with:

```tsx
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#4a3c28_0%,#2e2417_100%)] px-4 pb-12 pt-16">
          <div className="absolute -z-10 -right-16 -top-16 h-64 w-64 rounded-full bg-[#faf7f2] opacity-[0.06] blur-3xl" />

          <div className="flex flex-col gap-8">
            <div>
              <h1 className="mb-5 font-headings text-[36px] font-bold leading-[1.25] text-[#faf7f2]">
                Sais où part <span className="text-secondary">chaque franc</span>, avant la fin du
                mois.
              </h1>
              <p className="font-body text-base leading-relaxed text-[#faf7f2]/80">
                Tu ranges ton argent en enveloppes dès qu&apos;il rentre. L&apos;app te dit ce
                qu&apos;il reste dans chacune, en temps réel.
              </p>
            </div>

            <div className="pt-2">
              <HeroProductPreview compact />
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/signup"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-body text-sm font-bold text-primary-foreground shadow-lg"
              >
                Essayer gratuitement
                <Icon i="arrow-right" size={18} />
              </Link>
              <p className="text-center font-body text-xs text-[#faf7f2]/60">
                Sans carte bancaire · Actif en 5 minutes
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {HERO_BADGES.map((b) => (
                <div
                  key={b.title}
                  className="flex items-start gap-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-4"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-secondary/40 bg-secondary/20">
                    <Icon i={b.icon} size={20} className="text-[#faf7f2]" />
                  </div>
                  <div>
                    <h4 className="mb-1 font-headings text-sm font-bold text-[#faf7f2]">
                      {b.title}
                    </h4>
                    <p className="font-body text-xs leading-relaxed text-[#faf7f2]/70">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
```

Note: this drops the old avatar-stack/"12 000+ utilisateurs actifs" social-proof block entirely (unverified stat, out of scope to keep — spec confirms removal).

- [ ] **Step 4: Replace the desktop hero section**

Replace the `<section className="relative overflow-hidden px-20 pb-32 pt-40">...</section>` block (originally lines 452-511) with:

```tsx
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#4a3c28_0%,#2e2417_100%)] px-20 pb-32 pt-40">
          <div className="absolute -z-10 -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#faf7f2] opacity-[0.06] blur-3xl" />

          <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-20">
            <div>
              <p className="mb-6 font-headings text-sm font-bold uppercase tracking-widest text-secondary">
                Chaque Franc
              </p>
              <h1 className="mb-8 font-headings text-[64px] font-bold leading-[1.15] text-[#faf7f2]">
                Sais où part <span className="text-secondary">chaque franc</span>, avant la fin du
                mois.
              </h1>
              <p className="mb-10 max-w-xl font-body text-xl leading-relaxed text-[#faf7f2]/80">
                Tu ranges ton argent en enveloppes dès qu&apos;il rentre. L&apos;app te dit ce
                qu&apos;il reste dans chacune, en temps réel.
              </p>

              <div className="mb-10 flex flex-col gap-4">
                {HERO_BADGES.map((b) => (
                  <div
                    key={b.title}
                    className="flex items-start gap-4 rounded-2xl border border-secondary/30 bg-secondary/10 p-5"
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-secondary/40 bg-secondary/20">
                      <Icon i={b.icon} size={22} className="text-[#faf7f2]" />
                    </div>
                    <div>
                      <h4 className="mb-1 font-headings text-base font-bold text-[#faf7f2]">
                        {b.title}
                      </h4>
                      <p className="font-body text-sm leading-relaxed text-[#faf7f2]/70">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6">
                <Link
                  href="/signup"
                  className="flex items-center gap-3 rounded-2xl bg-primary px-12 py-5 font-body text-lg font-bold text-primary-foreground shadow-lg transition-shadow hover:shadow-2xl"
                >
                  Essayer gratuitement
                  <Icon i="arrow-right" size={20} />
                </Link>
                <p className="font-body text-sm text-[#faf7f2]/60">
                  Sans carte bancaire · Actif en 5 minutes
                </p>
              </div>
            </div>

            <div className="transition-transform duration-300 hover:scale-105">
              <HeroProductPreview />
            </div>
          </div>
        </section>
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: no errors. `UserAvatar` stays imported (still used by the Témoignages sections further down) even though the hero no longer uses it — confirm no unused-import lint error by checking the Témoignages sections still call `<UserAvatar .../>` (they do, unchanged).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(landing): redesign the hero — new copy, gold/ivory palette, real product preview"
```

---

### Task 4: Fix the "Fonctionnalités" icon boxes

**Files:**
- Modify: `frontend/src/app/page.tsx` — the `FEATURES_MOBILE.map` icon box (around former line 295) and the `FEATURES_DESKTOP.map` icon box (around former line 553).

**Interfaces:** none — same `FEATURES_MOBILE`/`FEATURES_DESKTOP` consts, only the icon-box `className`s and icon color change.

- [ ] **Step 1: Fix the mobile icon box**

Find (inside the mobile Fonctionnalités section):

```tsx
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
                    <Icon i={f.icon} size={22} className="text-primary-foreground" />
                  </div>
```

Replace with:

```tsx
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-secondary/30 bg-secondary/15">
                    <Icon i={f.icon} size={22} className="text-secondary-foreground" />
                  </div>
```

- [ ] **Step 2: Fix the desktop icon box**

Find (inside the desktop Fonctionnalités section):

```tsx
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary">
                    <Icon i={f.icon} size={32} className="text-primary-foreground" />
                  </div>
```

Replace with:

```tsx
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary/15">
                    <Icon i={f.icon} size={32} className="text-secondary-foreground" />
                  </div>
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "fix(landing): replace gradient-square feature icons with gold-tinted badges"
```

---

### Task 5: Add the "Tarifs" section

**Files:**
- Modify: `frontend/src/app/page.tsx` — add `import { FEATURE_ROWS, SUBSCRIPTION_PRICES } from '@/lib/subscription-plans';` and `import { formatPrice } from '@/lib/utils';`; add a `PricingCard` component; insert a mobile Tarifs `<section>` between the mobile Témoignages section and the mobile final-CTA section; insert a desktop Tarifs `<section>` between the desktop Témoignages section and the desktop final-CTA section; remove `id="tarifs"` from the final-CTA `<section>` (it moves to the new section).

**Interfaces:**
- Consumes: `FEATURE_ROWS: FeatureRow[]`, `SUBSCRIPTION_PRICES: Record<'monthly'|'annual', number>` from Task 1's shared file; `formatPrice(amount: number, currency?: string): string` from `@/lib/utils` (existing, used elsewhere in the app — e.g. `frontend/src/app/dashboard/page.tsx:197`).
- Produces: `function PricingCard(props: { plan: string; price: string; priceNote?: string; ctaLabel: string; highlight?: boolean })` — called once per plan, in both the mobile and desktop Tarifs sections.

- [ ] **Step 1: Add the imports**

At the top of `frontend/src/app/page.tsx`, change:

```tsx
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
```

to:

```tsx
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { FEATURE_ROWS, SUBSCRIPTION_PRICES } from '@/lib/subscription-plans';
import { formatPrice } from '@/lib/utils';
```

- [ ] **Step 2: Add the `PricingCard` component**

Insert right after the `HeroProductPreview` function (from Task 3) and before `export default function LandingPage()`:

```tsx
interface PricingCardProps {
  plan: string;
  price: string;
  priceNote?: string;
  ctaLabel: string;
  highlight?: boolean;
}

function PricingCard({ plan, price, priceNote, ctaLabel, highlight = false }: PricingCardProps) {
  return (
    <div
      className={`flex flex-1 flex-col gap-6 rounded-2xl border-2 p-6 lg:rounded-3xl lg:p-10 ${
        highlight ? 'border-secondary bg-secondary/10' : 'border-border bg-card'
      }`}
    >
      <div>
        {highlight && (
          <span className="mb-3 inline-block rounded-full bg-secondary px-3 py-1 font-body text-xs font-bold text-secondary-foreground">
            Recommandé
          </span>
        )}
        <h3 className="font-headings text-xl font-bold text-foreground lg:text-2xl">{plan}</h3>
        <p className="mt-2 font-headings text-3xl font-bold text-foreground lg:text-4xl">
          {price}
        </p>
        {priceNote && <p className="mt-1 font-body text-xs text-muted-foreground">{priceNote}</p>}
      </div>

      <ul className="flex flex-1 flex-col gap-3">
        {FEATURE_ROWS.map((row) => {
          const value = highlight ? row.pro : row.free;
          const included = value !== '—';
          return (
            <li key={row.label} className="flex items-start gap-2 font-body text-sm">
              {included ? (
                <Icon i="check-circle" size={16} className="mt-0.5 flex-shrink-0 text-primary" />
              ) : (
                <span className="mt-0.5 w-4 flex-shrink-0 text-center text-muted-foreground">
                  –
                </span>
              )}
              <span className="text-foreground">
                {row.label}
                {included && value !== '✓' && (
                  <span className="text-muted-foreground"> — {value}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        href="/signup"
        className={`w-full rounded-xl px-6 py-3.5 text-center font-body text-sm font-bold lg:py-4 ${
          highlight ? 'bg-primary text-primary-foreground' : 'border-2 border-border text-foreground'
        }`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Insert the mobile Tarifs section**

In the mobile render tree, insert this new `<section>` immediately after the mobile Témoignages `</section>` and before the mobile final-CTA `<section className="relative overflow-hidden bg-primary px-4 py-16">`:

```tsx
        <section id="tarifs" className="bg-background px-4 py-12">
          <div className="flex flex-col gap-10">
            <div className="text-center">
              <p className="mb-2 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Tarifs
              </p>
              <h2 className="mb-3 font-headings text-3xl font-bold leading-tight text-foreground">
                Gratuit pour commencer.
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                Passe à Pro quand tu es prêt·e à aller plus loin.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <PricingCard
                plan="Free"
                price="0 F"
                priceNote="Pour toujours"
                ctaLabel="Créer un compte gratuit"
              />
              <PricingCard
                plan="Pro"
                price={`${formatPrice(SUBSCRIPTION_PRICES.monthly)} F`}
                priceNote={`/mois — ou ${formatPrice(SUBSCRIPTION_PRICES.annual)} F/an`}
                ctaLabel="Commencer — 7 jours Pro offerts"
                highlight
              />
            </div>
          </div>
        </section>
```

- [ ] **Step 4: Insert the desktop Tarifs section**

In the desktop render tree, insert this new `<section>` immediately after the desktop Témoignages `</section>` and before the desktop final-CTA `<section id="tarifs" className="relative overflow-hidden bg-primary px-20 py-40">`:

```tsx
        <section id="tarifs" className="bg-background px-20 py-32">
          <div className="mx-auto flex max-w-5xl flex-col gap-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Tarifs
              </p>
              <h2 className="mb-6 font-headings text-5xl font-bold leading-tight text-foreground">
                Gratuit pour commencer.
              </h2>
              <p className="font-body text-lg text-muted-foreground">
                Passe à Pro quand tu es prêt·e à aller plus loin — sans engagement.
              </p>
            </div>

            <div className="flex gap-10">
              <PricingCard
                plan="Free"
                price="0 F"
                priceNote="Pour toujours"
                ctaLabel="Créer un compte gratuit"
              />
              <PricingCard
                plan="Pro"
                price={`${formatPrice(SUBSCRIPTION_PRICES.monthly)} F`}
                priceNote={`/mois — ou ${formatPrice(SUBSCRIPTION_PRICES.annual)} F/an`}
                ctaLabel="Commencer — 7 jours Pro offerts"
                highlight
              />
            </div>
          </div>
        </section>
```

- [ ] **Step 5: Remove the now-duplicate `id="tarifs"` from the final CTA section**

The final-CTA section in the desktop tree currently opens with:

```tsx
        <section id="tarifs" className="relative overflow-hidden bg-primary px-20 py-40">
```

Change it to:

```tsx
        <section className="relative overflow-hidden bg-primary px-20 py-40">
```

(The mobile final-CTA section never had `id="tarifs"` — nothing to change there.)

- [ ] **Step 6: Verify**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint && pnpm --filter frontend format:check`
Expected: no errors. Then run the full gate:

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green (555+ tests passing — the bcrypt-timeout tests may flake under parallel load per the session's established non-regression pattern; rerun once if so).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(landing): add a real Tarifs section sharing the Free/Pro comparison"
```

---

## Self-Review

**Spec coverage:** Payment methods fixed (Task 2). Hero rewritten with new copy, gold/ivory palette, dropped social-proof block, new `HeroProductPreview` replacing the flawed blue-gradient `DashboardMockup`, 2 gold-tinted badges in the spec's exact mobile/desktop order (Task 3). Fonctionnalités gradient-square icons fixed to the light gold-tinted badge treatment (Task 4). Genuine Tarifs section added, reusing `FEATURE_ROWS` via a small DRY refactor, trial-advertising CTA, `id="tarifs"` moved to real content (Task 1 + 5). Étapes and Témoignages untouched, confirmed out of scope.

**Placeholder scan:** No TBD/TODO — every step has complete, copy-pasteable JSX/TS.

**Type consistency:** `FeatureRow`/`FEATURE_ROWS` (Task 1) is consumed identically by `/subscription/page.tsx` (pre-existing usage, unchanged shape) and by `PricingCard` (Task 5) via `row.label`/`row.free`/`row.pro`. `HeroProductPreview({ compact })` (Task 3) matches its two call sites (`<HeroProductPreview compact />` in mobile, `<HeroProductPreview />` in desktop) exactly like the `DashboardMockup` it replaces. `PricingCard` props (`plan`, `price`, `priceNote?`, `ctaLabel`, `highlight?`) are used identically in both the mobile and desktop Tarifs sections (Task 5, Steps 3-4).
