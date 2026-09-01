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

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  purpose: string | null;
  period: string | null;
  paidAt: string | null;
  createdAt: string;
}

type BillingPeriod = 'monthly' | 'annual';

// Written out, one advantage at a time — the comparatif table below stays
// as the at-a-glance version, but a table cell ("Illimitées") doesn't sell
// anything by itself. Wording mirrors the FEATURE_ROWS values so the two
// never contradict each other.
const PRO_BENEFITS: {
  icon: 'wallet' | 'target' | 'clock' | 'trending-up' | 'bell';
  title: string;
  desc: string;
}[] = [
  {
    icon: 'wallet',
    title: 'Enveloppes illimitées',
    desc: 'Crée une enveloppe par vraie catégorie de dépense — plus besoin de tout entasser dans les 2 du plan Free.',
  },
  {
    icon: 'target',
    title: "Objectifs d'épargne",
    desc: "La fonctionnalité 100% Pro : mets de l'argent de côté pour de vrai, avec un rythme calculé pour toi.",
  },
  {
    icon: 'clock',
    title: 'Historique complet',
    desc: 'Retrouve chaque transaction depuis le premier jour — pas seulement les deux derniers mois.',
  },
  {
    icon: 'trending-up',
    title: 'Tendances & conseils personnalisés',
    desc: 'Comprends où part ton argent mois après mois, et reçois des conseils qui collent à tes vraies dépenses.',
  },
  {
    icon: 'bell',
    title: 'Toutes les notifications',
    desc: "Rappels, jalons d'objectifs, rythme d'épargne manqué — jamais pris au dépourvu.",
  },
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
  const ripple = useRipple();

  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [renewalInfoOpen, setRenewalInfoOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<SubscriptionStatus>('/api/subscription')
      .then(setSub)
      .catch((err) =>
        setLoadError(
          err instanceof ApiError ? err.message : 'Impossible de charger ton abonnement.',
        ),
      );
    // Non-critical — the "Mes paiements" section just stays hidden if this
    // fails; it never blocks the upgrade flow.
    api<{ orders: PaymentRow[] }>('/api/orders')
      .then((res) => setPayments(res.orders))
      .catch(() => setPayments([]));
  }, [user]);

  if (!user) return <ListPageSkeleton rows={6} />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;
  const isProNow = sub?.plan === 'PRO';
  const isTrialNow = isProNow && sub?.isTrial === true;
  const wasProBefore = sub?.plan === 'FREE' && sub?.currentPeriodEnd !== null;
  // Orders in this app are only ever the Pro checkout, but filter on
  // purpose anyway so an unrelated future order type can't show up
  // mislabeled as "Pro —".
  const subscriptionPayments = (payments ?? []).filter((p) => p.purpose === 'subscription');

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
                        onClick={() => setRenewalInfoOpen((v) => !v)}
                        className="self-start font-body text-xs font-medium text-muted-foreground underline"
                      >
                        Que se passe-t-il à l'échéance ?
                      </button>
                      {renewalInfoOpen && (
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

            {/* Avantages Pro, écrits en toutes lettres */}
            <div className="flex flex-col gap-3">
              {PRO_BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="flex gap-3 rounded-lg border border-secondary/30 bg-secondary/10 p-4"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-secondary/40 bg-secondary/20">
                    <Icon i={b.icon} size={18} className="text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-bold text-foreground">{b.title}</p>
                    <p className="mt-0.5 font-body text-xs leading-relaxed text-muted-foreground">
                      {b.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ce qui reste gratuit — pas de honte sur le Free, juste un rappel */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <Icon i="check-circle" size={18} className="mt-0.5 flex-shrink-0 text-primary" />
              <p className="font-body text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Toujours gratuit, sans limite :{' '}
                </span>
                transactions illimitées et tableau de bord complet. Le plan Free reste utilisable au
                quotidien — Pro débloque ce qui va plus loin.
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
              <div className="mb-4 mt-1.5 grid grid-cols-2 gap-3">
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
                {/* Wrapper carries the badge so the button can keep
                    `overflow-hidden` (needed for the ripple) without
                    clipping the ribbon that pokes above its top edge. */}
                <div className="relative">
                  <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-secondary px-2 py-0.5 font-body text-[10px] font-bold whitespace-nowrap text-secondary-foreground shadow-sm">
                    Le plus populaire
                  </span>
                  <button
                    type="button"
                    onClick={() => setPeriod('annual')}
                    onPointerDown={ripple}
                    className={`relative h-full w-full overflow-hidden rounded-lg border px-4 py-3 text-center font-body text-sm font-bold ${
                      period === 'annual'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground'
                    }`}
                  >
                    Annuel
                    <span className="mt-1 block font-body text-xs font-normal opacity-80">
                      {formatPrice(SUBSCRIPTION_PRICES.annual)} F/an
                    </span>
                  </button>
                </div>
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
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 py-3.5 font-body text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {checkoutLoading ? (
                  'Redirection en cours…'
                ) : (
                  <>
                    <Icon i="crown" size={16} />
                    {isProNow ? 'Prolonger mon abonnement — ' : 'Passer à Pro — '}
                    <AnimatedNumber value={SUBSCRIPTION_PRICES[period]} format={formatPrice} /> F
                  </>
                )}
              </button>
              <p className="mt-3 text-center font-body text-xs text-muted-foreground">
                Sans engagement · Wave, Orange Money, Free Money ou carte
              </p>
            </div>

            {/* Mes paiements — reçus des périodes déjà payées. Masqué tant
                qu'il n'y a rien : un utilisateur Free qui n'a jamais payé
                n'a pas besoin d'une section vide. */}
            {subscriptionPayments.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="font-headings text-lg font-bold text-foreground">Mes paiements</h3>
                <div className="divide-y divide-border rounded-lg border border-border bg-card">
                  {subscriptionPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6"
                    >
                      <div className="min-w-0">
                        <p className="font-body text-sm font-medium text-foreground">
                          Pro —{' '}
                          {p.period === 'annual'
                            ? 'Annuel'
                            : p.period === 'monthly'
                              ? 'Mensuel'
                              : 'Abonnement'}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {formatDateLong(p.paidAt ?? p.createdAt)}
                        </p>
                      </div>
                      <p className="flex-shrink-0 whitespace-nowrap font-body text-sm font-bold text-foreground">
                        {formatPrice(p.amount)} F
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
