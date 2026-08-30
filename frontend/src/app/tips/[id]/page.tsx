// TipDetailDesktop.jsx → /tips/[id].
//
// Deviations (see .planning/banani/tips.md):
// - Dropped the fabricated "28% D'économie" / "15 Jours pour voir l'effet"
//   stats — real only for the one worked Banani example (Transport malin),
//   no other tip's card content implies a percentage or day-count. Kept
//   only the real estimatedSavingsFcfa stat.
// - Dropped the "Exemple réel" (50 000 → 36 000 → ~14 000 F) comparison box
//   — specific to the moto-taxi illustration, doesn't generalize.
// - "Comment ça marche" steps + "Conseils pratiques" folded into one
//   numbered list, rendered from Tip.body's paragraphs (no separate
//   structured fields).
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { FormPageSkeleton } from '@/components/skeletons/FormPageSkeleton';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { formatPrice } from '@/lib/utils';
import { useRipple } from '@/hooks/useRipple';

interface TipDetail {
  id: string;
  title: string;
  icon: string;
  category: string;
  estimatedSavingsFcfa: number | null;
  steps: string[];
}

export default function TipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();
  const ripple = useRipple();
  const [tip, setTip] = useState<TipDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ tip: TipDetail }>(`/api/tips/${id}`)
      .then((res) => setTip(res.tip))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Conseil introuvable.'));
  }, [user, id]);

  if (!user) return <FormPageSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="font-body text-sm text-accent">{error}</p>
      </div>
    );
  }

  if (!tip) return null;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="tips"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-32 lg:pb-0">
        <div className="flex items-center gap-4 border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <button
            type="button"
            onClick={() => router.push('/tips')}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon i="arrow-left" size={20} />
          </button>
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">
            {tip.title}
          </h2>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 lg:gap-8">
            <div className="flex items-center gap-4 rounded-lg bg-gradient-to-r from-primary to-secondary p-8 text-primary-foreground">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20">
                <Icon i={tip.icon as IconName} size={32} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-headings text-2xl font-bold lg:text-3xl">{tip.title}</h1>
                {tip.estimatedSavingsFcfa !== null && (
                  <p className="text-sm opacity-80 lg:text-base">
                    Économise jusqu&apos;à ~{formatPrice(tip.estimatedSavingsFcfa)} FCFA/mois
                  </p>
                )}
              </div>
            </div>

            {tip.estimatedSavingsFcfa !== null && (
              <div className="rounded-lg border border-border bg-card p-6 text-center">
                <p className="mb-2 font-headings text-4xl font-bold text-primary">
                  ~{formatPrice(tip.estimatedSavingsFcfa)}
                </p>
                <p className="font-body text-sm text-muted-foreground">FCFA/mois à économiser</p>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card p-8">
              <h2 className="mb-6 font-headings text-2xl font-bold text-foreground">
                Comment ça marche ?
              </h2>
              <div className="space-y-6">
                {tip.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                      <span className="font-headings text-sm font-bold text-secondary-foreground">
                        {i + 1}
                      </span>
                    </div>
                    <p className="font-body text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push(`/tips/${id}/apply`)}
                onPointerDown={ripple}
                className="relative flex-1 overflow-hidden rounded-lg bg-primary px-6 py-3 font-body text-sm font-bold text-primary-foreground"
              >
                Appliquer ce conseil
              </button>
              <Link
                href="/tips"
                onPointerDown={ripple}
                className="relative flex-1 overflow-hidden rounded-lg border border-border bg-input px-6 py-3 text-center font-body text-sm font-medium text-foreground"
              >
                Revenir aux conseils
              </Link>
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
