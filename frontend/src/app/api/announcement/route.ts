// GET /api/announcement — PUBLIC. The app-wide banner set by an admin in
// /admin/config (AppSetting "announcement"), or null when there's nothing to
// show. Consumed by <AnnouncementBanner> in the root layout. Unauthenticated
// — the banner is shown to everyone; a 60s cache header blunts polling.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getAnnouncement } from '@/lib/server/settings';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const announcement = await getAnnouncement();
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
