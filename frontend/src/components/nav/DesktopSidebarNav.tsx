'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useRipple } from '@/hooks/useRipple';
import { api } from '@/lib/api';
import type { SubscriptionStatus } from '@/components/subscription/banner-model';
import { NAV_ITEMS, type NavId } from './nav-items';

export type { NavId };

interface DesktopSidebarNavProps {
  active: NavId;
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;
}

/** Left sidebar shared by every desktop-width authenticated page (dashboard,
 * envelopes, history, and later tips/progress/settings) — Banani repeated
 * this exact block across 8+ screens verbatim, so it's extracted once here
 * rather than copy-pasted per page. Hidden below `lg:` — mobile uses
 * `BottomNav` instead. */
export function DesktopSidebarNav({
  active,
  userName,
  userEmail,
  avatarUrl = null,
}: DesktopSidebarNavProps) {
  const ripple = useRipple();
  const router = useRouter();
  // Self-fetched, like NotificationBell/SubscriptionBanner — keeps this
  // change scoped to this one file instead of threading a new prop through
  // every page that renders the sidebar. Non-critical: on failure the plan
  // pill and the Premium upsell badge simply don't render, same fail-open
  // behavior as the bell's unread count.
  const [plan, setPlan] = useState<SubscriptionStatus['plan'] | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<SubscriptionStatus>('/api/subscription')
      .then((res) => {
        if (!cancelled) setPlan(res.plan);
      })
      .catch(() => {
        /* non-critical — no plan pill on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // Outer element only reserves the w-64 column in the page's flex row —
    // it carries no visuals. The real sidebar is `fixed` inside it, pinned
    // to the viewport so it never scrolls with the (often much taller) main
    // content column. A plain flex child here (even `sticky`) drifts because
    // the flex row's height is driven by the main content, not the viewport;
    // `fixed` sidesteps that entirely by not participating in document flow.
    <div className="hidden w-64 flex-shrink-0 lg:block">
      <div className="fixed inset-y-0 left-0 hidden h-screen w-64 flex-col overflow-y-auto border-r border-border bg-card px-6 py-8 lg:flex">
        <div className="mb-12">
          <BrandLogo size="md" />
        </div>

        <nav className="mb-auto flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onPointerDown={ripple}
              className={`relative flex items-center gap-3 overflow-hidden rounded-lg px-4 py-3 font-body text-sm font-medium ${
                active === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Icon i={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border pt-6">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={userName}
              avatarUrl={avatarUrl}
              className="h-10 w-10 flex-shrink-0 rounded-lg"
            />
            {/* Name gets the whole row to itself — it used to share space
                with the plan pill AND the upsell button on one line, which
                squeezed a 5-letter name down to "Z…" in a 256px-wide
                sidebar. Plan pill now sits on its own line below the name
                (per explicit instruction), upsell button below that,
                full-width. */}
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-medium text-foreground">{userName}</p>
              {plan && (
                <span className="mt-1 inline-block rounded-full bg-muted px-1.5 py-0.5 font-body text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {plan === 'PRO' ? 'Pro' : 'Free'}
                </span>
              )}
              <p className="truncate font-body text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          {/* Upsell only — a Pro member already has it, so showing this
              would just be a redundant nag (see SubscriptionBanner's own
              "no repetition" rule). Free-only, and distinct from that
              banner's full message: this is a compact entry point, not a
              second copy of the pitch.
              Also hidden on the dashboard specifically — SubscriptionBanner
              already renders the full upsell pitch there, so this button
              would double it on the one page where the two would sit
              stacked on top of each other. Every other authenticated page
              has no banner at all, so the sidebar is the only entry point
              there.
              Label is "Passer Pro" (a call to action), never "Premium" —
              this app only ever has two real plans, FREE and PRO. */}
          {plan === 'FREE' && active !== 'dashboard' && (
            <button
              type="button"
              onClick={() => router.push('/subscription')}
              onPointerDown={ripple}
              className="relative mt-3 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-secondary px-3 py-2 font-body text-xs font-bold text-secondary-foreground"
            >
              <Icon i="sparkles" size={13} />
              Passer Pro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
