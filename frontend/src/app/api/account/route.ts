// DELETE /api/account — self-service account deletion ("Zone dangereuse"
// in /settings). Not part of the stock starter; added in Phase 5 because a
// non-functional "Supprimer le compte" button (Banani's SettingsDesktop.jsx
// ships one) would repeat the fake-affordance mistake already flagged and
// avoided in Phase 4 (see .planning/banani/notifications-settings.md).
//
// Gating mirrors change-password's security bar:
//   - hasPassword accounts must confirm their current password (bcrypt).
//   - OAuth-only accounts (no password to check) must instead type their
//     own email exactly, as an explicit confirmation step.
// On success: prisma.user.delete() — every owned model cascades
// (envelopes, transactions, savings goals/entries, notifications, oauth
// accounts, ...), no orphan cleanup needed. Cookies cleared the same way
// logout does.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { clearAuthCookies, clearCsrfCookie, verifyCsrf, verifyPassword } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

const Body = z.object({
  password: z.string().min(1).optional(),
  confirmEmail: z.string().min(1).optional(),
});

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

    const body = await req.json().catch(() => null);
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    if (user.passwordHash) {
      const ok = parsed.data.password
        ? await verifyPassword(parsed.data.password, user.passwordHash)
        : false;
      if (!ok) {
        return NextResponse.json(
          { error: 'INVALID_CREDENTIALS', message: 'Mot de passe incorrect' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    } else {
      const matches = parsed.data.confirmEmail?.trim().toLowerCase() === user.email.toLowerCase();
      if (!matches) {
        return NextResponse.json(
          { error: 'CONFIRMATION_MISMATCH', message: 'L’email ne correspond pas' },
          { status: 400, headers: { 'x-request-id': ctx.requestId } },
        );
      }
    }

    await prisma.user.delete({ where: { id: user.id } });

    await clearAuthCookies();
    await clearCsrfCookie();

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
