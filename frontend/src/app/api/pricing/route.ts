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
import { getSubscriptionPricing } from '@/lib/server/settings';
import { SUBSCRIPTION_TRIAL_DAYS } from '@/lib/server/subscriptions/tier';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const pricing = await getSubscriptionPricing();
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
