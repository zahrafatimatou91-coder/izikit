// AllTipsDesktop.jsx → /tips.
//
// Deviations (see .planning/banani/tips.md):
// - Title/intro softened — Banani's "Conseils personnalisés" +
//   "personnalisé des conseils basés sur tes enveloppes et ton profil de
//   dépenses" overclaims personalization the locked decision doesn't build
//   (static curated content, not AI). The one real bit of targeting we do —
//   sorting tips whose category matches a real envelope name first — is a
//   plain string match done server-side (see /api/tips), not AI.
// - The "Conseils pour tes enveloppes personnalisées" section (implying
//   dynamic generation for custom envelopes) folded into one flat grid —
//   all 9 tips are equally static curated content.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { useUser } from '@/contexts/AuthContext';
import { TipsSkeleton } from '@/components/skeletons/TipsSkeleton';
import { api, ApiError } from '@/lib/api';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Icon } from '@/components/ui/Icon';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { MobileDrawerNav } from '@/components/nav/MobileDrawerNav';
import { TipCard } from '@/components/tips/TipCard';

interface TipRow {
  id: string;
  title: string;
  icon: string;
  category: string;
  estimatedSavingsFcfa: number | null;
  excerpt: string;
}

export default function TipsPage() {
  const user = useUser();
  const [tips, setTips] = useState<TipRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ tips: TipRow[] }>('/api/tips')
      .then((res) => setTips(res.tips))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.'));
  }, [user]);

  if (!user) return <TipsSkeleton />;
  if (tips === null && !error) return <TipsSkeleton />;

  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="tips"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="text-foreground lg:hidden"
            >
              <Icon i="menu" size={22} />
            </button>
            <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">Conseils</h2>
          </div>
          <NotificationBell />
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
            {error && (
              <p role="alert" className="font-body text-sm text-accent">
                {error}
              </p>
            )}

            <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-6">
              <p className="font-body text-sm text-foreground">
                Des conseils pratiques pour économiser sur tes dépenses courantes. Ceux qui
                correspondent à tes enveloppes remontent en premier. Clique sur un conseil pour voir
                le détail et l&apos;appliquer.
              </p>
            </div>

            {tips && tips.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {tips.map((t) => (
                  <TipCard
                    key={t.id}
                    id={t.id}
                    title={t.title}
                    excerpt={t.excerpt}
                    icon={t.icon as IconName}
                    estimatedSavingsFcfa={t.estimatedSavingsFcfa}
                  />
                ))}
              </div>
            )}

            {tips && tips.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">
                  Pas encore de conseils disponibles.
                </p>
              </div>
            )}

            <div className="flex flex-col items-start gap-4 rounded-lg border border-primary/20 bg-primary/10 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="mb-1 font-headings font-bold text-foreground">
                  Prêt à transformer tes finances ?
                </h3>
                <p className="font-body text-sm text-muted-foreground">
                  Sélectionne un conseil ci-dessus et applique-le à tes objectifs.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="rounded-lg border border-primary bg-card px-6 py-2 font-body text-sm font-medium text-primary"
              >
                Revenir au tableau
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>

      <MobileDrawerNav
        active="tips"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
