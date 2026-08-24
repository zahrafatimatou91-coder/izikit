import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';

const PAYMENT_METHODS = ['MTN MoMo', 'Orange Money', 'Wave', 'Airtel Money'];

const ENVELOPE_PREVIEW = [
  { cat: 'Alimentation', pct: 68, warn: true },
  { cat: 'Transport', pct: 42, warn: false },
  { cat: 'Loisirs', pct: 87, warn: true },
  { cat: 'Études', pct: 15, warn: false },
];

const SIDEBAR_PREVIEW = [
  { icon: 'layout-dashboard' as const, label: 'Tableau', active: true },
  { icon: 'package' as const, label: 'Enveloppes', active: false },
  { icon: 'trending-up' as const, label: 'Objectifs', active: false },
  { icon: 'settings' as const, label: 'Paramètres', active: false },
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

function DashboardMockup({ compact = false }: { compact?: boolean }) {
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

      <div className="flex flex-col gap-4 bg-background p-4 lg:flex-row lg:gap-6 lg:p-8">
        <div className="hidden w-48 flex-shrink-0 flex-col gap-2 rounded-2xl border-2 border-border bg-card px-4 py-6 lg:flex">
          <p className="mb-4 font-body text-xs font-bold uppercase tracking-wider text-primary">
            Chaque Franc
          </p>
          {SIDEBAR_PREVIEW.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-medium ${
                item.active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground'
              }`}
            >
              <Icon i={item.icon} size={18} />
              {item.label}
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:gap-6">
          <div className="flex items-center justify-between">
            <p className="font-headings text-sm font-bold text-foreground lg:text-lg">
              {compact ? 'Nov 2026' : 'Novembre 2026'}
            </p>
            <Icon i="more-horizontal" size={16} className="text-muted-foreground lg:hidden" />
            <Icon i="more-horizontal" size={20} className="hidden text-muted-foreground lg:block" />
          </div>

          <div className="rounded-xl bg-[linear-gradient(135deg,var(--color-primary)_0%,#2563eb_100%)] p-5 text-primary-foreground shadow-md lg:rounded-2xl lg:p-8 lg:shadow-lg">
            <p className="mb-2 text-xs opacity-75 lg:mb-3 lg:text-sm">Solde disponible</p>
            <p className="mb-3 font-headings text-2xl font-bold lg:mb-6 lg:text-4xl">26 550 F</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 lg:h-2">
              <div className="h-full w-[47%] rounded-full bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:gap-4">
            {ENVELOPE_PREVIEW.map((e) => (
              <div
                key={e.cat}
                className={`rounded-lg border px-3 py-2.5 lg:rounded-2xl lg:border-2 lg:px-5 lg:py-4 ${
                  e.warn ? 'border-orange-300 bg-orange-50' : 'border-border bg-card'
                }`}
              >
                <div className="mb-2 flex items-center justify-between lg:mb-3">
                  <p className="truncate font-body text-xs font-bold text-foreground lg:text-sm">
                    {e.cat}
                  </p>
                  <p
                    className={`font-body text-xs font-bold lg:text-sm ${
                      e.warn ? 'text-orange-600' : 'text-primary'
                    }`}
                  >
                    {e.pct}%
                  </p>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted lg:h-2">
                  <div
                    className={`h-full rounded-full ${e.warn ? 'bg-orange-400' : 'bg-primary'} ${
                      e.pct >= 80
                        ? 'w-[87%]'
                        : e.pct >= 60
                          ? 'w-[68%]'
                          : e.pct >= 40
                            ? 'w-[42%]'
                            : 'w-[15%]'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-background font-body">
      {/* ══════ MOBILE (< lg) ══════ */}
      <div className="flex flex-col lg:hidden">
        <nav className="flex items-center justify-between border-b border-border bg-background px-4 py-4">
          <h1 className="font-headings text-lg font-bold text-primary">Chaque Franc</h1>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-4 py-2 font-body text-xs font-bold text-primary-foreground"
          >
            Commencer
          </Link>
        </nav>

        <section className="relative overflow-hidden px-4 pb-12 pt-16">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-background" />
          <div className="absolute -z-10 right-0 top-0 h-48 w-48 rounded-full bg-primary opacity-[0.08] blur-2xl" />

          <div className="flex flex-col gap-10">
            <div>
              <h1 className="mb-5 font-headings text-[40px] font-bold leading-[1.2]">
                Reprends le
                <br />
                <span className="text-primary">contrôle</span>
                <br />
                de ton argent.
              </h1>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Tableau de bord pour étudiants africains. Planifie. Dépense intelligent. Épargne
                vrai.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/signup"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-body text-sm font-bold text-primary-foreground shadow-lg"
              >
                Essayer gratuitement
                <Icon i="arrow-right" size={18} />
              </Link>
              <p className="text-center font-body text-xs text-muted-foreground">
                Aucune carte bancaire requise
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((i) => (
                  <UserAvatar
                    key={i}
                    name={`Étudiant ${i}`}
                    className="h-10 w-10 rounded-full border-2 border-white shadow-md"
                  />
                ))}
              </div>
              <div className="text-center">
                <p className="font-body text-sm font-bold text-foreground">
                  12 000+ utilisateurs actifs
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Dakar • Accra • Douala • Abidjan
                </p>
              </div>
            </div>

            <div className="pt-4">
              <DashboardMockup compact />
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
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
                    <Icon i={f.icon} size={22} className="text-primary-foreground" />
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

        <section className="bg-[linear-gradient(135deg,rgba(39,126,255,0.05)_0%,rgba(219,231,251,0.1)_100%)] px-4 py-12">
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
              className="w-full rounded-xl bg-white px-10 py-4 font-body text-base font-bold text-primary shadow-lg"
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
            <div>
              <h3 className="mb-1 font-headings text-lg font-bold text-primary">Chaque Franc</h3>
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
          <h1 className="font-headings text-2xl font-bold text-primary">Chaque Franc</h1>
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
            href="/signup"
            className="rounded-xl bg-primary px-7 py-3 font-body text-sm font-bold text-primary-foreground"
          >
            Commencer
          </Link>
        </nav>

        <section className="relative overflow-hidden px-20 pb-32 pt-40">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-background" />
          <div className="absolute -z-10 right-40 top-20 h-96 w-96 rounded-full bg-primary opacity-[0.08] blur-3xl" />
          <div className="absolute -z-10 bottom-0 left-0 h-64 w-64 rounded-full bg-secondary opacity-5 blur-2xl" />

          <div className="mx-auto flex max-w-5xl flex-col gap-16">
            <div>
              <h1 className="mb-8 font-headings text-[84px] font-bold leading-[1.05]">
                Reprends le
                <br />
                <span className="text-primary">contrôle de ton</span>
                <br />
                argent.
              </h1>
              <p className="max-w-2xl font-body text-2xl leading-relaxed text-muted-foreground">
                Un tableau de bord conçu pour les étudiants africains. Planifie. Dépense
                intelligent. Épargne vrai.
              </p>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <Link
                href="/signup"
                className="flex items-center gap-3 rounded-2xl bg-primary px-12 py-5 font-body text-lg font-bold text-primary-foreground shadow-lg transition-shadow hover:shadow-2xl"
              >
                Essayer gratuitement
                <Icon i="arrow-right" size={20} />
              </Link>
              <p className="font-body text-sm text-muted-foreground">
                Aucune carte bancaire requise
              </p>
            </div>

            <div className="flex items-center gap-8 pt-8">
              <div className="flex -space-x-4">
                {[0, 1, 2, 3].map((i) => (
                  <UserAvatar
                    key={i}
                    name={`Étudiant ${i}`}
                    className="h-12 w-12 rounded-full border-4 border-white shadow-md"
                  />
                ))}
              </div>
              <div>
                <p className="font-body text-base font-bold text-foreground">
                  12 000+ utilisateurs actifs
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  Dakar • Accra • Douala • Abidjan
                </p>
              </div>
            </div>

            <div className="relative pt-12">
              <div className="transition-transform duration-300 hover:scale-105">
                <DashboardMockup />
              </div>
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
                  <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary">
                    <Icon i={f.icon} size={32} className="text-primary-foreground" />
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

        <section className="bg-[linear-gradient(135deg,rgba(39,126,255,0.05)_0%,rgba(219,231,251,0.1)_100%)] px-20 py-32">
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

        <section id="tarifs" className="relative overflow-hidden bg-primary px-20 py-40">
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
              className="rounded-2xl bg-white px-16 py-6 font-body text-lg font-bold text-primary shadow-2xl transition-transform hover:scale-105"
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
            <div>
              <h3 className="mb-2 font-headings text-2xl font-bold text-primary">Chaque Franc</h3>
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
