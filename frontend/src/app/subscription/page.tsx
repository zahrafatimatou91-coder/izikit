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
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useRipple } from '@/hooks/useRipple';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { ListPageSkeleton } from '@/components/skeletons/ListPageSkeleton';
import {
  SUBSCRIPTION_PRICES,
  getDailyEquivalentFcfa,
  FEATURE_ROWS,
} from '@/lib/subscription-plans';
import { formatPrice } from '@/lib/utils';

interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  status: string;
  currentPeriodEnd: string | null;
  isTrial: boolean;
}

type BillingPeriod = 'monthly' | 'annual';

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
  const ripple = useRipple();

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
              {!loadError && !sub && <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />}
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
                          annuler. Tu resteras Pro jusqu'au {formatDateLong(sub.currentPeriodEnd)},
                          puis tu repasseras automatiquement sur le plan Free.
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
                    <th className="rounded-t-lg border border-b-0 border-secondary bg-secondary/10 px-3 pt-3 pb-3 text-center">
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
                  onPointerDown={ripple}
                  className={`relative overflow-hidden rounded-lg border px-4 py-3 text-center font-body text-sm font-bold ${
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
                  onPointerDown={ripple}
                  className={`relative overflow-hidden rounded-lg border px-4 py-3 text-center font-body text-sm font-bold ${
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
                onPointerDown={ripple}
                disabled={checkoutLoading}
                className="relative w-full overflow-hidden rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {checkoutLoading ? (
                  'Redirection en cours…'
                ) : (
                  <>
                    {isProNow ? 'Prolonger mon abonnement — ' : 'Passer à Pro — '}
                    <AnimatedNumber value={SUBSCRIPTION_PRICES[period]} format={formatPrice} /> F
                  </>
                )}
              </button>
            </div>

            {/* FAQ */}
            <div className="flex flex-col gap-3">
              <h3 className="font-headings text-lg font-bold text-foreground">
                Questions fréquentes
              </h3>
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
