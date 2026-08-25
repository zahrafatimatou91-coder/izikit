// POST /api/auth/verify-reset-code — checks whether a PASSWORD_RESET code is
// valid (unused, unexpired) WITHOUT consuming it or touching the password.
//
// Purely a UX step: /reset-password only reveals the new-password field
// after this returns { valid: true }, so a user isn't typing a new password
// next to a code that turns out to be wrong. The actual reset — code
// consumption + password update — still happens exclusively inside
// POST /api/auth/reset-password's atomic tx; this route MUST NOT mark the
// code used, or the real reset that follows would find it already consumed.
//
// Shares the SAME rate-limit bucket ('auth:reset') as POST /reset-password
// so verify-only attempts and full-reset attempts draw from one combined
// 5-per-15-min budget. Without this, a verify-only endpoint — cheaper to
// call since it skips password-policy work — would be an easier oracle for
// brute-forcing codes than the existing route.
//
// Enumeration-resistant: identical VERIFICATION_CODE_INVALID whether the
// email doesn't exist, the code doesn't match, or it was already used.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { zEmail } from '@/lib/server/zod-helpers';
import { prisma } from '@/lib/server/prisma';
import { redis } from '@/lib/server/redis';
import { createEmailLimiter } from '@/lib/server/middleware/rate-limit-by-email';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { VERIFICATION_CODE_REGEX } from '@/lib/server/auth';

const Body = z.object({
  email: zEmail,
  code: z.string().regex(VERIFICATION_CODE_REGEX, 'Invalid verification code format'),
});

const limiter = createEmailLimiter(redis ? { redis } : {}, {
  bucket: 'auth:reset',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RESET_RATE_LIMIT_MAX ?? 5),
  code: 'TOO_MANY_RESET_ATTEMPTS',
  message: 'Too many password-reset attempts. Try again later.',
});

function formatIssues(err: z.ZodError) {
  return err.issues.map((e) => ({ path: e.path.join('.'), message: e.message }));
}

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      const res = NextResponse.json(
        { error: 'VALIDATION_FAILED', issues: formatIssues(parsed.error) },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }
    const { email, code } = parsed.data;

    const rateFail = await limiter.check(req, email);
    if (rateFail) return rateFail;

    function invalid(): NextResponse {
      const res = NextResponse.json(
        { error: 'VERIFICATION_CODE_INVALID', message: 'Verification code is invalid.' },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return invalid();

    const codeRow = await prisma.verificationCode.findFirst({
      where: { userId: user.id, code, type: 'PASSWORD_RESET', usedAt: null },
      select: { expiresAt: true },
    });
    if (!codeRow) return invalid();

    if (codeRow.expiresAt.getTime() < Date.now()) {
      const res = NextResponse.json(
        { error: 'VERIFICATION_CODE_EXPIRED', message: 'Verification code has expired.' },
        { status: 400 },
      );
      res.headers.set('x-request-id', ctx.requestId);
      return res;
    }

    const res = NextResponse.json({ valid: true });
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  });
}
