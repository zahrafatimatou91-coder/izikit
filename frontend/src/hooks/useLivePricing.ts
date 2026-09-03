'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SUBSCRIPTION_PRICES, SUBSCRIPTION_TRIAL_DAYS } from '@/lib/subscription-plans';

export interface LivePricing {
  monthly: number;
  annual: number;
  trialDays: number;
}

/**
 * The subscription price shown to users. Starts from the compile-time
 * `SUBSCRIPTION_PRICES` constant (so SSR / first paint has a value and there's
 * no layout flash), then reconciles with `GET /api/pricing` — which reflects
 * whatever the admin last set in /admin/subscriptions. The webhook enforces
 * the same source of truth server-side, so the displayed number always
 * matches what a checkout will actually cost.
 */
export function useLivePricing(): LivePricing {
  const [pricing, setPricing] = useState<LivePricing>({
    monthly: SUBSCRIPTION_PRICES.monthly,
    annual: SUBSCRIPTION_PRICES.annual,
    trialDays: SUBSCRIPTION_TRIAL_DAYS,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<LivePricing>('/api/pricing');
        if (!cancelled && res && typeof res.monthly === 'number') {
          setPricing({
            monthly: res.monthly,
            annual: res.annual,
            trialDays: res.trialDays ?? SUBSCRIPTION_TRIAL_DAYS,
          });
        }
      } catch {
        /* keep the constant fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return pricing;
}
