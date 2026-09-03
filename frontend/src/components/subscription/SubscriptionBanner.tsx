'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from 'lucide-react/dynamic';
import { useRipple } from '@/hooks/useRipple';
import { useRevalidateOnRestore } from '@/hooks/useRevalidateOnRestore';
import {
  computeModel,
  dayLabel,
  dismissValue,
  isDismissed,
  type Dismissible,
  type SubscriptionStatus,
} from './banner-model';

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** State-aware subscription nudge for the dashboard. Renders nothing while
 * loading, on error, for a healthy paid subscriber, or while the relevant
 * banner is dismissed. Closing a conversion banner (upsell / lapsed) only
 * snoozes it — it comes back on the next visit after a day. */
export function SubscriptionBanner() {
  const router = useRouter();
  const ripple = useRipple();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(() => {
    api<SubscriptionStatus>('/api/subscription')
      .then(setSub)
      .catch(() => {
        /* non-critical — no banner rather than an error */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRevalidateOnRestore(load);

  if (!sub || hidden) return null;

  const model = computeModel(sub);
  if (!model) return null;
  const dismiss: Dismissible | null = 'dismiss' in model ? model.dismiss : null;
  if (dismiss && isDismissed(dismiss, readKey(dismiss.key))) return null;

  function handleDismiss() {
    if (dismiss) {
      try {
        localStorage.setItem(dismiss.key, dismissValue(dismiss));
      } catch {
        /* private mode — hide for this session at least */
      }
    }
    setHidden(true);
  }

  const config: {
    icon: IconName;
    tone: 'calm' | 'urgent' | 'neutral';
    text: string;
    cta: string;
  } = (() => {
    switch (model.kind) {
      case 'trial-calm':
        return {
          icon: 'sparkles',
          tone: 'calm',
          text: `Essai Pro en cours — il te reste ${model.days} jour${model.days > 1 ? 's' : ''}.`,
          cta: 'Passer à Pro',
        };
      case 'trial-urgent':
        return {
          icon: 'alert-triangle',
          tone: 'urgent',
          text: `Ton essai Pro se termine ${dayLabel(model.days)}. Passe à Pro pour garder enveloppes illimitées, objectifs et tendances.`,
          cta: 'Passer à Pro',
        };
      case 'renewal-urgent':
        return {
          icon: 'alert-triangle',
          tone: 'urgent',
          text: `Ton abonnement Pro se termine ${dayLabel(model.days)}. Renouvelle pour rester Pro sans interruption.`,
          cta: 'Renouveler',
        };
      case 'free-lapsed':
        return {
          icon: 'lock',
          tone: 'neutral',
          text: 'Ton accès Pro est terminé — objectifs, tendances et historique complet sont verrouillés (rien n’est supprimé).',
          cta: 'Repasser à Pro',
        };
      case 'free-upsell':
        return {
          icon: 'sparkles',
          tone: 'calm',
          text: 'Passe à Pro : objectifs d’épargne, tendances et conseils personnalisés, enveloppes et historique illimités.',
          cta: 'Découvrir Pro',
        };
    }
  })();

  const toneClass =
    config.tone === 'urgent'
      ? 'border-transparent bg-accent text-accent-foreground'
      : config.tone === 'calm'
        ? 'border-secondary/30 bg-secondary/10 text-foreground'
        : 'border-border bg-card text-foreground';

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${toneClass}`}>
      <Icon i={config.icon} size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm leading-snug">{config.text}</p>
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/subscription')}
            onPointerDown={ripple}
            className={`relative overflow-hidden rounded-lg px-3 py-1.5 font-body text-xs font-bold whitespace-nowrap ${
              config.tone === 'urgent'
                ? 'bg-accent-foreground text-accent'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {config.cta}
          </button>
          {dismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={dismiss.snoozeHours ? 'Masquer pour aujourd’hui' : 'Masquer'}
              className="flex-shrink-0 opacity-60 hover:opacity-100"
            >
              <Icon i="x" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
