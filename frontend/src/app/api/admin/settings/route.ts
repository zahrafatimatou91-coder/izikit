// ADMIN — GET/PATCH /api/admin/settings
//
// GET (ADMIN): every known AppSetting key with its current effective value,
//   whether that value is the shipped default or an admin override, and
//   who last wrote it. Backs the /admin/config form.
// PATCH (SUPERADMIN): update one setting. Body `{ key, value }` — `value`
//   is validated against that key's Zod schema (SETTING_SCHEMAS) before the
//   write. The row upsert + the AdminAction audit row commit in one
//   transaction (action: "settings.update").
//
// Never returns or accepts a secret — the only keys are pricing, the
// support email, and the announcement banner. Real provider keys are Vercel
// deploy secrets, surfaced elsewhere only as "configured: yes/no".
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAdmin, requireSuperadmin } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { logAdminAction } from '@/lib/server/admin/audit';
import { enforceAdminRateLimit } from '@/lib/server/middleware/rate-limit-by-userid';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import {
  getAllSettings,
  writeSetting,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  SUBSCRIPTION_TRIAL_DAYS_DISPLAY,
} from '@/lib/server/settings';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAdmin('ADMIN');
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const settings = await getAllSettings();
    // Read-only "is this provider wired?" booleans — env presence only, never
    // a key value. Surfaced on /admin/config so an operator can see at a
    // glance what's configured on the current deploy.
    const integrations = {
      redis: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      resend: Boolean(process.env.RESEND_API_KEY),
      bictorys: Boolean(process.env.BICTORYS_API_KEY),
      moneroo: Boolean(process.env.MONEROO_API_KEY),
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      cloudinary: Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_API_KEY),
      sentry: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    };
    return NextResponse.json(
      { settings, trialDays: SUBSCRIPTION_TRIAL_DAYS_DISPLAY, integrations },
      { headers: { 'x-request-id': ctx.requestId } },
    );
  });
}

const Body = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.unknown(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireSuperadmin();
    if (auth instanceof NextResponse) return auth;

    const limited = await enforceAdminRateLimit(auth.admin.id);
    if (limited) return limited;

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const { key } = parsed.data;
    const valueParsed = SETTING_SCHEMAS[key].safeParse(parsed.data.value);
    if (!valueParsed.success) {
      return NextResponse.json(
        {
          error: 'INVALID_SETTING_VALUE',
          message: `Invalid value for "${key}"`,
          issues: valueParsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    await prisma.$transaction(async (tx) => {
      await writeSetting(tx, key, valueParsed.data, auth.admin.id);
      await logAdminAction(tx, {
        actorId: auth.admin.id,
        action: 'settings.update',
        targetType: 'AppSetting',
        targetId: key,
        metadata: { key, value: valueParsed.data as Record<string, unknown> },
      });
    });

    return NextResponse.json(
      { setting: { key, value: valueParsed.data } },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
