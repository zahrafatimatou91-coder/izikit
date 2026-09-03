// GET /api/announcement — PUBLIC. The app-wide banner set by an admin in
// /admin/config (AppSetting "announcement"), or null when there's nothing to
// show. Consumed by <AnnouncementBanner> in the root layout. Unauthenticated
// — the banner is shown to everyone; a 60s cache header blunts polling.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getAnnouncement } from '@/lib/server/settings';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { createLogger } from '@/lib/server/logger';

const log = createLogger();

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    // Public, non-critical chrome — a transient DB error (Neon waking up) must
    // not 500 every page in the app. Degrade to "no banner".
    let announcement: Awaited<ReturnType<typeof getAnnouncement>> = null;
    try {
      announcement = await getAnnouncement();
    } catch (err) {
      log.warn('announcement: settings read failed, serving none', { err: String(err) });
    }
    return NextResponse.json(
      { announcement },
      {
        headers: {
          'x-request-id': ctx.requestId,
          'cache-control': 'public, max-age=60, s-maxage=60',
        },
      },
    );
  });
}
