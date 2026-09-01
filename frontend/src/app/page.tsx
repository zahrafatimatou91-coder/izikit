'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useRipple } from '@/hooks/useRipple';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { EnvelopeCard } from '@/components/envelopes/EnvelopeCard';
import type { EnvelopeSwatchKey } from '@/lib/envelope-colors';
import { FEATURE_ROWS, SUBSCRIPTION_PRICES } from '@/lib/subscription-plans';
import { formatPrice } from '@/lib/utils';

const PAYMENT_METHODS = ['Wave', 'Orange Money', 'Free Money', 'Carte bancaire'];

// Same components + realistic sample data as the real /dashboard — not a
// hand-drawn lookalike — so the hero preview never drifts from what a
// signed-up user actually sees. totalBudget/spent/daysLeft below are picked
// to land on a clean "182 400 F" remaining, matching this section's
// long-standing headline number.
interface PreviewEnvelope {
  name: string;
  icon: 'utensils' | 'car' | 'users';
  spent: number;
  total: number;
  color: EnvelopeSwatchKey;
}

const HERO_ENVELOPES_DESKTOP: PreviewEnvelope[] = [
  { name: 'Nourriture', icon: 'utensils', spent: 26000, total: 40000, color: 'envelope-4' }, // 65%
  { name: 'Transport', icon: 'car', spent: 10000, total: 25000, color: 'envelope-2' }, // 40%
  { name: 'Famille', icon: 'users', spent: 52000, total: 60000, color: 'envelope-6' }, // 87% — real "tendu" styling
];

const HERO_ENVELOPES_MOBILE: PreviewEnvelope[] = [
  HERO_ENVELOPES_DESKTOP[0]!,
  HERO_ENVELOPES_DESKTOP[2]!,
];

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

const FEATURES_DESKTOP = [
  {
    icon: 'wallet' as const,
    title: 'Enveloppes intelligentes',
    desc: 'Alloue ton argent avant de le dépenser. Alimentation, transport, loisirs — plus de débordement.',
  },
  {
    icon: 'target' as const,
    title: 'Objectifs visibles',
    desc: 'Fixe un objectif, suis ta progression jour après jour. Chaque économie compte vraiment.',
  },
  {
    icon: 'bar-chart-2' as const,
    title: 'Tableau de bord crystal',
    desc: "Solde, dépenses, tendances — tout en un coup d'œil. Zéro confusion.",
  },
  {
    icon: 'lightbulb' as const,
    title: 'Conseils contextuels',
    desc: 'Astuces conçues pour ta réalité : économies sur le transport, la nourriture, les études.',
  },
];

const FEATURES_MOBILE = [
  { icon: 'wallet' as const, title: 'Enveloppes', desc: 'Alloue ton argent avant de le dépenser.' },
  { icon: 'target' as const, title: 'Objectifs', desc: 'Suis ta progression jour après jour.' },
  {
    icon: 'bar-chart-2' as const,
    title: 'Tableau de bord',
    desc: "Solde et dépenses en un coup d'œil.",
  },
  { icon: 'lightbulb' as const, title: 'Conseils', desc: 'Astuces conçues pour toi.' },
];

const STEPS_DESKTOP = [
  { num: '01', title: 'Crée un compte', desc: 'E-mail + mot de passe. Voilà.' },
  { num: '02', title: 'Définis ton budget', desc: 'Dis-nous ce que tu reçois par mois.' },
  { num: '03', title: 'Crée tes enveloppes', desc: 'Répartis ton argent intelligemment.' },
  { num: '04', title: 'Atteins tes objectifs', desc: 'Épargne, suis, réussis.' },
];

const STEPS_MOBILE = [
  { num: '01', title: 'Crée un compte', desc: 'E-mail + mot de passe.' },
  { num: '02', title: 'Définis ton budget', desc: 'Ce que tu reçois par mois.' },
  { num: '03', title: 'Crée tes enveloppes', desc: 'Répartis ton argent.' },
  { num: '04', title: 'Atteins tes objectifs', desc: 'Épargne + suis ta progression.' },
];

const TESTIMONIALS_DESKTOP = [
  {
    text: "J'ai économisé 15 000 F en un mois. Sans me priver du tout.",
    name: 'Awa Diallo',
    role: 'Étudiante en droit, Dakar',
  },
  {
    text: 'Enfin je sais où part mon argent chaque jour.',
    name: 'Kofi Mensah',
    role: 'Génie civil, Accra',
  },
  {
    text: "L'appli que j'aurais voulu avoir bien avant.",
    name: 'Fatima Ndiaye',
    role: 'Médecine, Abidjan',
  },
];

const TESTIMONIALS_MOBILE = [
  { text: "J'ai économisé 15 000 F en un mois.", name: 'Awa Diallo', role: 'Droit, Dakar' },
  { text: 'Enfin je sais où part mon argent.', name: 'Kofi Mensah', role: 'Génie civil, Accra' },
  { text: "L'appli que j'attendais.", name: 'Fatima Ndiaye', role: 'Médecine, Abidjan' },
];

/** Wraps the real dashboard header + envelope cards in a browser-window
 * frame — this is the literal /dashboard UI, not a redrawn lookalike, so it
 * can never silently drift from what a signed-up user actually sees. */
function HeroProductPreview({ compact = false }: { compact?: boolean }) {
  const envelopes = compact ? HERO_ENVELOPES_MOBILE : HERO_ENVELOPES_DESKTOP;
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-border bg-white shadow-lg lg:max-w-none lg:rounded-3xl lg:shadow-2xl">
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

      <div className="bg-background">
        <DashboardHeader name="Fatou" totalBudget={220000} spent={37600} income={0} daysLeft={18} />

        <div className="flex flex-col gap-2 p-4 lg:gap-3 lg:p-6">
          <p className="font-headings text-sm font-bold text-foreground lg:text-base">
            Mes enveloppes
          </p>
          {envelopes.map((e) => (
            <EnvelopeCard
              key={e.name}
              name={e.name}
              icon={e.icon}
              spent={e.spent}
              total={e.total}
              color={e.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PricingCardProps {
  plan: string;
  price: string;
  priceNote?: string;
  ctaLabel: string;
  highlight?: boolean;
}

function PricingCard({ plan, price, priceNote, ctaLabel, highlight = false }: PricingCardProps) {
  const ripple = useRipple();
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
        <p className="mt-2 font-headings text-3xl font-bold text-foreground lg:text-4xl">{price}</p>
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
        onPointerDown={ripple}
        className={`relative w-full overflow-hidden rounded-xl px-6 py-3.5 text-center font-body text-sm font-bold lg:py-4 ${
          highlight
            ? 'bg-primary text-primary-foreground'
            : 'border-2 border-border text-foreground'
        }`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

export default function LandingPage() {
  const ripple = useRipple();
  // Read-only auth check — never forces a redirect off the homepage, just
  // swaps the nav CTA so a signed-in visitor isn't offered "Se connecter" /
  // "Commencer" for an account they already have. Deliberately not
  // useUser()/useGuestOnly(): those redirect, which would blank the page
  // for a beat on every single anonymous visit while /api/auth/me is
  // still loading — unacceptable on the highest-traffic page.
  const { user } = useAuth();
  return (
    <div className="flex flex-col bg-background font-body">
      {/* ══════ MOBILE (< lg) ══════ */}
      <div className="flex flex-col lg:hidden">
        <nav className="flex items-center justify-between border-b border-border bg-background px-4 py-4">
          <BrandLogo size="sm" />
          <Link
            href={user ? '/dashboard' : '/signup'}
            onPointerDown={ripple}
            className="relative overflow-hidden rounded-lg bg-primary px-4 py-2 font-body text-xs font-bold text-primary-foreground"
          >
            {user ? 'Tableau de bord' : 'Commencer'}
          </Link>
        </nav>

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
                onPointerDown={ripple}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-6 py-4 font-body text-sm font-bold text-primary-foreground shadow-lg"
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

        <section className="border-y border-border bg-gradient-to-r from-input to-card px-4 py-8">
          <div className="flex flex-col gap-4">
            <p className="text-center font-body text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Intégré à tes outils
            </p>
            <div className="flex flex-col gap-2">
              {PAYMENT_METHODS.map((p) => (
                <div key={p} className="flex items-center justify-center gap-2">
                  <Icon i="check-circle" size={16} className="flex-shrink-0 text-primary" />
                  <p className="font-body text-sm font-bold text-foreground">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background px-4 py-12">
          <div className="flex flex-col gap-10">
            <div className="text-center">
              <p className="mb-2 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Fonctionnalités
              </p>
              <h2 className="mb-3 font-headings text-3xl font-bold leading-tight text-foreground">
                Tout ce dont tu as besoin.
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                Juste des outils qui marchent vraiment.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {FEATURES_MOBILE.map((f) => (
                <div
                  key={f.title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-secondary/30 bg-secondary/15">
                    <Icon i={f.icon} size={22} className="text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="mb-1 font-headings text-base font-bold text-foreground">
                      {f.title}
                    </h4>
                    <p className="font-body text-xs leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-secondary/10 to-transparent px-4 py-12">
          <div className="flex flex-col gap-10">
            <div className="text-center">
              <p className="mb-2 font-body text-xs font-bold uppercase tracking-widest text-primary">
                4 étapes
              </p>
              <h2 className="font-headings text-3xl font-bold leading-tight text-foreground">
                Actif en 5 minutes.
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              {STEPS_MOBILE.map((s) => (
                <div key={s.num} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary shadow-md">
                    <span className="font-headings text-sm font-bold text-primary-foreground">
                      {s.num}
                    </span>
                  </div>
                  <div className="flex-1 pt-1">
                    <h4 className="mb-1 font-headings text-base font-bold text-foreground">
                      {s.title}
                    </h4>
                    <p className="font-body text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background px-4 py-12">
          <div className="flex flex-col gap-10">
            <div className="text-center">
              <p className="mb-2 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Témoignages
              </p>
              <h2 className="font-headings text-3xl font-bold leading-tight text-foreground">
                Ça change vraiment.
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              {TESTIMONIALS_MOBILE.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((j) => (
                      <Icon key={j} i="star" size={14} className="fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="font-body text-sm italic leading-relaxed text-foreground">
                    &quot;{t.text}&quot;
                  </p>
                  <div className="flex items-center gap-3 border-t border-border pt-3">
                    <UserAvatar name={t.name} className="h-10 w-10 rounded-full" />
                    <div>
                      <p className="font-body text-xs font-bold text-foreground">{t.name}</p>
                      <p className="font-body text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

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

        <section className="relative overflow-hidden bg-primary px-4 py-16">
          <div className="absolute -z-10 right-0 top-0 h-48 w-48 rounded-full bg-primary-foreground opacity-10 blur-2xl" />
          <div className="flex flex-col items-center gap-8 text-center">
            <h2 className="font-headings text-4xl font-bold leading-tight text-primary-foreground">
              Reprends le
              <br />
              contrôle.
              <br />
              <span className="text-white opacity-90">Aujourd&apos;hui.</span>
            </h2>
            <p className="font-body text-base leading-relaxed text-primary-foreground opacity-85">
              Gratuit. Pas de carte requise. Juste ton téléphone.
            </p>
            <Link
              href="/signup"
              onPointerDown={ripple}
              className="relative w-full overflow-hidden rounded-xl bg-white px-10 py-4 font-body text-base font-bold text-primary shadow-lg"
            >
              Essayer gratuitement
            </Link>
            <p className="font-body text-xs text-primary-foreground opacity-60">
              12 000+ étudiants africains
            </p>
          </div>
        </section>

        <footer className="border-t border-border bg-background px-4 py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex flex-col items-center gap-1">
              <BrandLogo size="sm" />
              <p className="font-body text-xs text-muted-foreground">
                Fintech pour étudiants africains.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <a href="#" className="font-body text-xs text-muted-foreground">
                Confidentialité
              </a>
              <a href="#" className="font-body text-xs text-muted-foreground">
                Conditions
              </a>
              <a href="#" className="font-body text-xs text-muted-foreground">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* ══════ DESKTOP (>= lg) ══════ */}
      <div className="hidden lg:flex lg:flex-col">
        <nav className="flex items-center justify-between border-b border-border bg-background px-20 py-6">
          <BrandLogo size="md" />
          <div className="flex items-center gap-10">
            <a href="#fonctionnalites" className="font-body text-sm font-medium text-foreground">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="font-body text-sm font-medium text-foreground">
              Tarifs
            </a>
            <a href="#a-propos" className="font-body text-sm font-medium text-foreground">
              À propos
            </a>
          </div>
          <Link
            href={user ? '/dashboard' : '/signup'}
            onPointerDown={ripple}
            className="relative overflow-hidden rounded-xl bg-primary px-7 py-3 font-body text-sm font-bold text-primary-foreground"
          >
            {user ? 'Tableau de bord' : 'Commencer'}
          </Link>
        </nav>

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
                  onPointerDown={ripple}
                  className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-primary px-12 py-5 font-body text-lg font-bold text-primary-foreground shadow-lg transition-shadow hover:shadow-2xl"
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

        <section
          id="a-propos"
          className="border-y-2 border-border bg-gradient-to-r from-input to-card px-20 py-16"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8">
            <p className="font-body text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Connecté à tes moyens de paiement
            </p>
            <div className="flex flex-wrap items-center justify-center gap-20">
              {PAYMENT_METHODS.map((p) => (
                <div key={p} className="flex items-center gap-2">
                  <Icon i="check-circle" size={18} className="text-primary" />
                  <p className="font-body text-base font-bold text-foreground">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="bg-background px-20 py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Fonctionnalités puissantes
              </p>
              <h2 className="mb-6 font-headings text-5xl font-bold leading-tight text-foreground">
                Tout ce dont tu as besoin. Rien de plus.
              </h2>
              <p className="font-body text-lg text-muted-foreground">
                Pas de jargon. Pas de fonctionnalités inutiles. Juste des outils qui marchent
                vraiment.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10">
              {FEATURES_DESKTOP.map((f) => (
                <div
                  key={f.title}
                  className="rounded-3xl border-2 border-border bg-card p-12 transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary/15">
                    <Icon i={f.icon} size={32} className="text-secondary-foreground" />
                  </div>
                  <h3 className="mb-4 font-headings text-2xl font-bold text-foreground">
                    {f.title}
                  </h3>
                  <p className="font-body text-base leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-secondary/10 to-transparent px-20 py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-20">
            <div className="text-center">
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Prêt en 4 étapes
              </p>
              <h2 className="font-headings text-5xl font-bold leading-tight text-foreground">
                Commence en moins de 5 minutes.
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-8">
              {STEPS_DESKTOP.map((s, i) => (
                <div key={s.num} className="relative flex flex-col gap-6">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary shadow-lg">
                    <span className="font-headings text-xl font-bold text-primary-foreground">
                      {s.num}
                    </span>
                  </div>
                  <div>
                    <h4 className="mb-3 font-headings text-xl font-bold text-foreground">
                      {s.title}
                    </h4>
                    <p className="font-body text-base leading-relaxed text-muted-foreground">
                      {s.desc}
                    </p>
                  </div>
                  {i < STEPS_DESKTOP.length - 1 && (
                    <Icon
                      i="arrow-right"
                      size={24}
                      className="absolute -right-16 top-8 text-primary opacity-30"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background px-20 py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-4 font-body text-xs font-bold uppercase tracking-widest text-primary">
                Résultats réels
              </p>
              <h2 className="font-headings text-5xl font-bold leading-tight text-foreground">
                Les étudiants changent leur rapport à l&apos;argent.
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-10">
              {TESTIMONIALS_DESKTOP.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col gap-8 rounded-3xl border-2 border-border bg-card p-10 transition-shadow hover:shadow-lg"
                >
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((j) => (
                      <Icon key={j} i="star" size={20} className="fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="flex-1 font-body text-lg italic leading-relaxed text-foreground">
                    &quot;{t.text}&quot;
                  </p>
                  <div className="flex items-center gap-4 border-t-2 border-border pt-6">
                    <UserAvatar name={t.name} className="h-14 w-14 rounded-full" />
                    <div>
                      <p className="font-body text-base font-bold text-foreground">{t.name}</p>
                      <p className="font-body text-sm text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

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

        <section className="relative overflow-hidden bg-primary px-20 py-40">
          <div className="absolute -z-10 right-20 top-20 h-96 w-96 rounded-full bg-primary-foreground opacity-10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 -z-10 h-80 w-80 rounded-full bg-primary-foreground opacity-5 blur-3xl" />

          <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 text-center">
            <h2 className="font-headings text-6xl font-bold leading-tight text-primary-foreground">
              Prends le contrôle
              <br />
              <span className="text-white opacity-90">aujourd&apos;hui même.</span>
            </h2>
            <p className="max-w-2xl font-body text-2xl leading-relaxed text-primary-foreground opacity-85">
              Gratuit. Aucune carte requise. Juste ton téléphone et une vraie volonté de changer ton
              rapport à l&apos;argent.
            </p>
            <Link
              href="/signup"
              onPointerDown={ripple}
              className="relative overflow-hidden rounded-2xl bg-white px-16 py-6 font-body text-lg font-bold text-primary shadow-2xl transition-transform hover:scale-105"
            >
              Essayer gratuitement
            </Link>
            <p className="font-body text-base text-primary-foreground opacity-60">
              Utilisé par 12 000+ étudiants en Afrique de l&apos;Ouest
            </p>
          </div>
        </section>

        <footer className="border-t-2 border-border bg-background px-20 py-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex flex-col items-start gap-2">
              <BrandLogo size="md" />
              <p className="font-body text-base text-muted-foreground">
                Fintech pour les étudiants africains.
              </p>
            </div>
            <div className="flex items-center gap-12">
              <a
                href="#"
                className="font-body text-base text-muted-foreground hover:text-foreground"
              >
                Confidentialité
              </a>
              <a
                href="#"
                className="font-body text-base text-muted-foreground hover:text-foreground"
              >
                Conditions
              </a>
              <a
                href="#"
                className="font-body text-base text-muted-foreground hover:text-foreground"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
