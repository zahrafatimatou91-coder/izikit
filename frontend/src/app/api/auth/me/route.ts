// GET /api/auth/me — AUTH-06.
//
// Source: RESEARCH.md Pattern 14.
//
// requireAuth handles the cookie/Bearer lookup, JWT verification, and the
// DB-side tokenVersion re-check (T-1-02 mitigation against stale-JWT bypass
// after change-password bumps tokenVersion). Returns AuthContext on success
// or a 401 NextResponse on failure.
//
// Extra fields beyond { sub, email } (id, emailVerifiedAt, createdAt,
// updatedAt, hasPassword, linkedProviders) are fetched via a second DB hit
// so the AuthContext / settings page can branch on them without an extra
// round-trip. `hasPassword` distinguishes OAuth-only accounts (passwordHash
// is null) — used by /settings to switch between "Set password" and
// "Change password". `linkedProviders` is a string[] of provider names
// already wired (e.g. ['google']).
//
// No CSRF: GET is a safe method; verifyCsrf is a no-op for GET anyway.
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = makeRequestContext(req.headers);
  return withRequestContext(ctx, async () => {
    const auth = await requireAuth(req.headers.get('authorization'));
    if (auth instanceof NextResponse) {
      auth.headers.set('x-request-id', ctx.requestId);
      return auth;
    }

    // Defensive shape: tests sometimes stub findUnique with a minimal
    // `{ id, email, tokenVersion }` payload (the requireAuth contract).
    // We only read fields we know are present, and default the rest.
    const dbUser = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
        name: true,
        avatarUrl: true,
        totalBudget: true,
        budgetFrequency: true,
        oauthAccounts: { select: { provider: true } },
      },
    });

    const user = {
      // Keep `sub` for back-compat with the AuthContext payload contract
      // (older callers may still read it). New code should use `id`.
      sub: auth.user.sub,
      id: dbUser?.id ?? auth.user.sub,
      email: dbUser?.email ?? auth.user.email,
      emailVerifiedAt: dbUser?.emailVerifiedAt
        ? dbUser.emailVerifiedAt instanceof Date
          ? dbUser.emailVerifiedAt.toISOString()
          : dbUser.emailVerifiedAt
        : null,
      createdAt: dbUser?.createdAt
        ? dbUser.createdAt instanceof Date
          ? dbUser.createdAt.toISOString()
          : dbUser.createdAt
        : null,
      updatedAt: dbUser?.updatedAt
        ? dbUser.updatedAt instanceof Date
          ? dbUser.updatedAt.toISOString()
          : dbUser.updatedAt
        : null,
      hasPassword: !!dbUser?.passwordHash,
      linkedProviders: (dbUser?.oauthAccounts ?? []).map((a) => a.provider),
      name: dbUser?.name ?? null,
      avatarUrl: dbUser?.avatarUrl ?? null,
      totalBudget: dbUser?.totalBudget ?? null,
      budgetFrequency: dbUser?.budgetFrequency ?? null,
    };

    return NextResponse.json({ user }, { status: 200, headers: { 'x-request-id': ctx.requestId } });
  });
}

// avatarUrl is only ever set from a URL our own POST /api/upload just
// returned (a Cloudinary secure_url) — restrict the host so this endpoint
// can't be used to point an <img src> at an arbitrary origin.
const CLOUDINARY_HOST = /^https:\/\/res\.cloudinary\.com\//;

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    avatarUrl: z
      .string()
      .url()
      .max(2048)
      .regex(CLOUDINARY_HOST, 'avatarUrl must be hosted on Cloudinary')
      .nullable()
      .optional(),
  })
  .refine((patch) => patch.name !== undefined || patch.avatarUrl !== undefined, {
    message: 'Provide at least one field to update',
  });

export async function PATCH(req: NextRequest): Promise<NextResponse> {
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
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': ctx.requestId } },
      );
    }

    const data: Prisma.UserUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl;

    const updated = await prisma.user.update({
      where: { id: auth.user.sub },
      data,
      select: { name: true, avatarUrl: true },
    });

    return NextResponse.json(
      { name: updated.name, avatarUrl: updated.avatarUrl },
      { status: 200, headers: { 'x-request-id': ctx.requestId } },
    );
  });
}
