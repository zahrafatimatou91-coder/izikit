// /orders/[id]/failed — generic post-checkout failure landing page. POST
// /api/orders hardcodes this as its failureUrl for every order. No polling
// needed here: Bictorys only redirects to this URL once the payment
// attempt has actually failed.
//
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { useRipple } from '@/hooks/useRipple';

interface OrderStatus {
  id: string;
  status: string;
  amount: number;
  currency: string;
  purpose: string | null;
}

export default function OrderFailedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const ripple = useRipple();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<OrderStatus>(`/api/orders/${id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Commande introuvable.'));
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  const isSubscription = order?.purpose === 'subscription';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        <Icon i="x" size={32} className="text-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-headings text-2xl font-bold text-foreground">Paiement non abouti</h1>
        <p className="font-body text-sm text-muted-foreground">
          {error ??
            "Ton paiement n'a pas pu être confirmé. Réessaie ou choisis un autre moyen de paiement."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link
          href={isSubscription ? '/subscription' : '/dashboard'}
          onPointerDown={ripple}
          className="relative overflow-hidden rounded-lg bg-primary px-6 py-3 text-center font-body text-sm font-bold text-primary-foreground"
        >
          {isSubscription ? 'Réessayer' : "Retour à l'accueil"}
        </Link>
      </div>
    </main>
  );
}
