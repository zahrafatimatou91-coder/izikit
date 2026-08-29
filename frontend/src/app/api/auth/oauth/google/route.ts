// DELETE /api/auth/oauth/google — unlink "Sign in with Google" from the
// current account (Settings → Sécurité). Refuses when Google is the only
// remaining way in (no password AND no other linked provider), so a user
// can never lock themselves out. Setting a password first clears the
// refusal. Does not touch the OAuth sign-in flow (start/callback) or
// lib/server/oauth/google.ts — those own state/PKCE/account-linking and
// stay off-limits.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const PROVIDER = 'google';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth(req.headers.get('authorization'));
    if (auth instanceof NextResponse) {
      auth.headers.set('x-request-id', ctx.requestId);
      return auth;
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: {
        passwordHash: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    if (!user.oauthAccounts.some((a) => a.provider === PROVIDER)) {
      return NextResponse.json(
        { error: 'NOT_LINKED', message: 'Aucun compte Google lié.' },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const hasOtherLoginMethod =
      !!user.passwordHash || user.oauthAccounts.some((a) => a.provider !== PROVIDER);
    if (!hasOtherLoginMethod) {
      return NextResponse.json(
        {
          error: 'LAST_LOGIN_METHOD',
          message: 'Définis un mot de passe avant de délier Google.',
        },
        { status: 409, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    await prisma.oAuthAccount.deleteMany({
      where: { userId: auth.user.sub, provider: PROVIDER },
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
