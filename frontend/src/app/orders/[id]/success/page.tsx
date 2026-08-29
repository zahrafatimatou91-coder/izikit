// /orders/[id]/success — generic post-checkout landing page. POST
// /api/orders hardcodes this as its successUrl for EVERY order (not just
// subscriptions), so this page must handle both a subscription purchase
// and any other future use of the same generic checkout.
//
// Bictorys redirects here as soon as the user confirms payment on their
// phone, which can be BEFORE the webhook has landed and flipped the Order
// to PAID (WH-01/WH-02 in webhook/handler.ts are correct but async) — so
// this polls GET /api/orders/[id] for a short window rather than trusting
// a single fetch.
//
// TODO(Plan 3 — /subscription page): once /subscription exists, point the
// subscription-purpose CTA there instead of /dashboard.
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';

interface OrderStatus {
  id: string;
  status: string;
  amount: number;
  currency: string;
  purpose: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s total

export default function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick(count: number) {
      try {
        const res = await api<OrderStatus>(`/api/orders/${id}`);
        if (cancelled) return;
        setOrder(res);
        if (res.status === 'PENDING' && count < MAX_POLLS) {
          setPolls(count + 1);
          timer = setTimeout(() => void tick(count + 1), POLL_INTERVAL_MS);
        } else {
          setPolls(count);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Commande introuvable.');
      }
    }
    void tick(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="font-body text-sm text-accent">{error}</p>
        <Link href="/" className="font-body text-sm text-muted-foreground underline">
          Accueil
        </Link>
      </main>
    );
  }

  if (!order) return <FormPageSkeleton />;

  const isSubscription = order.purpose === 'subscription';
  const confirmed = order.status === 'PAID';
  const stillPending = order.status === 'PENDING' && polls >= MAX_POLLS;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
        <Icon i={confirmed ? 'check' : 'clock'} size={32} className="text-white" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-headings text-2xl font-bold text-foreground">
          {confirmed
            ? 'Paiement confirmé !'
            : stillPending
              ? 'Confirmation en cours'
              : 'Paiement en cours de confirmation'}
        </h1>
        <p className="font-body text-sm text-muted-foreground">
          {confirmed &&
            (isSubscription
              ? 'Ton abonnement Pro est actif.'
              : `Ton paiement de ${formatPrice(order.amount)} F a bien été reçu.`)}
          {!confirmed &&
            stillPending &&
            'Ça prend plus de temps que prévu — vérifie à nouveau dans quelques minutes.'}
          {!confirmed &&
            !stillPending &&
            'On attend la confirmation de ta banque ou de ton opérateur...'}
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground"
      >
        {isSubscription ? 'Voir mon tableau de bord' : "Retour à l'accueil"}
      </Link>
    </main>
  );
}
