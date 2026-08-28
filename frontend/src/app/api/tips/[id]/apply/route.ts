// POST /api/tips/[id]/apply — "Appliquer ce conseil". Idempotent: if the
// user already applied this tip (a SavingsGoal with this tipId exists),
// returns it instead of creating a duplicate. Otherwise creates a
// SavingsGoal seeded from the tip (name/icon from the tip, targetAmount
// from its estimatedSavingsFcfa or a sensible default, period=monthly).
//
// Before creating that new goal, we also check whether the user already
// has an *unlinked* goal (tipId: null) whose name matches the tip's title
// (case/accent-insensitive) — e.g. they manually created "Fonds
// d'urgence" before ever visiting Conseils, and later apply the "Fonds
// d'urgence" tip. Spawning a second "Fonds d'urgence" card next to their
// existing one would look like a broken duplicate, not a helpful
// suggestion, so we link the tip to the goal they already have instead
// (sets its tipId) rather than creating a rival goal with the same name.
//
// The apply page (app/tips/[id]/apply/page.tsx) fires this POST from a
// plain `useEffect` on mount — with React StrictMode's dev double-invoke
// (or any other double-fire of that effect), two requests can race past
// the `findFirst` check before either commits, both seeing no existing
// goal. The `@@unique([userId, tipId])` constraint + catching P2002 below
// closes that race at the database level: whichever request loses just
// re-reads the winner's row instead of creating a second goal (and
// firing a second "conseil appliqué" notification).
export const runtime = 'nodejs';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { prisma } from '@/lib/server/prisma';
import { createNotification } from '@/lib/server/notifications';
import { tipAppliedNotification } from '@/lib/server/notifications/templates';
import { makeRequestContext, withRequestContext } from '@/lib/server/observability/request-context';
import { normalizeForCompare } from '@/lib/text';

const DEFAULT_TARGET_FCFA = 2000;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const reqCtx = makeRequestContext(req.headers);
  return withRequestContext(reqCtx, async () => {
    const csrfFail = verifyCsrf(req);
    if (csrfFail) return csrfFail;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const tip = await prisma.tip.findUnique({ where: { id } });
    if (!tip) {
      return NextResponse.json(
        { error: 'TIP_NOT_FOUND' },
        { status: 404, headers: { 'x-request-id': reqCtx.requestId } },
      );
    }

    const existing = await prisma.savingsGoal.findFirst({
      where: { userId: auth.user.sub, tipId: tip.id },
    });

    let goal = existing;
    let created = false;
    let linkedExistingGoal = false;

    if (goal === null) {
      // Does the user already have an unlinked goal with this exact name?
      // (Prisma has no accent-insensitive `where` for this, so compare in
      // JS — a user has at most a handful of goals.)
      const unlinkedGoals = await prisma.savingsGoal.findMany({
        where: { userId: auth.user.sub, tipId: null },
      });
      const nameMatch = unlinkedGoals.find(
        (g) => normalizeForCompare(g.name) === normalizeForCompare(tip.title),
      );

      if (nameMatch) {
        goal = await prisma.savingsGoal.update({
          where: { id: nameMatch.id },
          data: { tipId: tip.id },
        });
        linkedExistingGoal = true;
      } else {
        try {
          goal = await prisma.savingsGoal.create({
            data: {
              userId: auth.user.sub,
              name: tip.title,
              icon: tip.icon,
              targetAmount: tip.estimatedSavingsFcfa ?? DEFAULT_TARGET_FCFA,
              period: 'monthly',
              tipId: tip.id,
            },
          });
          created = true;
        } catch (err) {
          // Lost the race to a concurrent apply (StrictMode double-invoke,
          // a retry, ...) — the unique constraint means the winner's row
          // now exists; use it instead of creating a second goal.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            goal = await prisma.savingsGoal.findFirstOrThrow({
              where: { userId: auth.user.sub, tipId: tip.id },
            });
          } else {
            throw err;
          }
        }
      }
    }

    if (created) {
      try {
        await createNotification(prisma, tipAppliedNotification(auth.user.sub, goal));
      } catch {
        // Swallow — the goal is already committed; a notification hiccup
        // must not poison the response (same posture as withdrawals/route.ts).
      }
    }

    return NextResponse.json(
      {
        goal: {
          id: goal.id,
          name: goal.name,
          icon: goal.icon,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          period: goal.period,
          completed: goal.currentAmount >= goal.targetAmount,
        },
        alreadyApplied: !created,
        linkedExistingGoal,
      },
      { status: created ? 201 : 200, headers: { 'x-request-id': reqCtx.requestId } },
    );
  });
}
