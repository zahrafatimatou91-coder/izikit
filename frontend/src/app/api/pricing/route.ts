// GET /api/pricing — PUBLIC. The live subscription price, so the
// /subscription page and the landing "Tarifs" section always show whatever
// the admin last set (AppSetting "subscription.pricing"), not a hard-coded
// constant. Unauthenticated on purpose (the price is public information);
// a 60s cache header blunts any scraping.
//
// The client keeps SUBSCRIPTION_PRICES (lib/subscription-plans.ts) as the
// SSR / first-paint default to avoid a layout flash, then reconciles with
// this response.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getSubscriptionPricing, SETTING_DEFAULTS } from '@/lib/server/settings';
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/server/subscriptions/tier';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { createLogger } from '@/lib/server/logger';

const log = createLogger();

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    // Public, display-only, with a client-side constant fallback — a transient
    // DB error (Neon waking up) must not 500 the landing page. The webhook
    // path still calls getSubscriptionPricing(tx) directly and surfaces the
    // error, so a real fault is never silently swallowed where it matters.
    let pricing: { monthly: number; annual: number };
    try {
      pricing = await getSubscriptionPricing();
    } catch (err) {
      log.warn('pricing: settings read failed, serving default', { err: String(err) });
      pricing = SETTING_DEFAULTS['subscription.pricing']();
    }
    return NextResponse.json(
      {
        monthly: pricing.monthly,
        annual: pricing.annual,
        trialDays: SUBSCRIPTION_TRIAL_DAYS,
      },
      {
        headers: {
          'x-request-id': ctx.requestId,
          'cache-control': 'public, max-age=60, s-maxage=60',
        },
      },
    );
  });
}
