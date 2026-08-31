import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface AuthShellProps {
  activeTab: 'signup' | 'login';
  children: ReactNode;
}

/** Shared two-column shell for /signup and /login — left pitch panel is
 * static marketing content, right column carries the tab toggle + the
 * page's own form. The Banani mock drew the toggle as an in-page tab, but
 * signup and login are genuinely different backend flows (signup never
 * logs in — it requires email verification first), so the "tabs" are real
 * navigation between the two routes, not client-side state. */
export function AuthShell({ activeTab, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-background font-body">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-14 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,white_1px,transparent_1px),radial-gradient(circle_at_80%_20%,white_1px,transparent_1px)] bg-[length:48px_48px] opacity-10" />

        <div className="relative z-10">
          <BrandLogo variant="onColor" size="lg" />
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h2 className="mb-4 font-headings text-4xl font-bold leading-tight text-primary-foreground">
              Ton argent, <br />
              ton contrôle.
            </h2>
            <p className="max-w-sm font-body text-base leading-relaxed text-primary-foreground/80">
              Planifie, dépense intelligemment et épargne — même avec un budget d&apos;étudiant.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-primary-foreground/10 p-4 text-center">
              <p className="font-headings text-2xl font-bold text-primary-foreground">12K+</p>
              <p className="mt-1 font-body text-xs text-primary-foreground/70">Étudiants</p>
            </div>
            <div className="rounded-lg bg-primary-foreground/10 p-4 text-center">
              <p className="font-headings text-2xl font-bold text-primary-foreground">8</p>
              <p className="mt-1 font-body text-xs text-primary-foreground/70">Pays</p>
            </div>
            <div className="rounded-lg bg-primary-foreground/10 p-4 text-center">
              <p className="font-headings text-2xl font-bold text-primary-foreground">4.8★</p>
              <p className="mt-1 font-body text-xs text-primary-foreground/70">Note moyenne</p>
            </div>
          </div>

          <div className="rounded-lg bg-primary-foreground/10 p-5">
            <p className="mb-3 font-body text-sm italic text-primary-foreground/90">
              &quot;Grâce à Chaque Franc, j&apos;ai économisé 15 000 FCFA en un seul mois sans me
              priver.&quot;
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/30">
                <span className="font-headings text-xs font-bold text-primary-foreground">A</span>
              </div>
              <div>
                <p className="font-body text-xs font-bold text-primary-foreground">Awa Diallo</p>
                <p className="font-body text-xs text-primary-foreground/60">
                  Étudiante en droit, Dakar
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="font-body text-xs text-primary-foreground/50">
            © 2026 Chaque Franc. Fait avec ♥ en Afrique.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div>
            <h2 className="mb-2 font-headings text-2xl font-bold text-foreground">Bienvenue !</h2>
            <p className="mb-6 font-body text-sm text-muted-foreground">
              Crée un compte ou connecte-toi pour continuer.
            </p>
            <div className="flex border-b border-border">
              <Link
                href="/signup"
                className={`-mb-px border-b-2 px-4 pb-3 font-body text-sm font-bold ${
                  activeTab === 'signup'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                Inscription
              </Link>
              <Link
                href="/login"
                className={`-mb-px border-b-2 px-4 pb-3 font-body text-sm font-bold ${
                  activeTab === 'login'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                Connexion
              </Link>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
