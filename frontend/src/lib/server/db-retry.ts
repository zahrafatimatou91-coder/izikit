// Neon's serverless compute auto-suspends after a few minutes idle; the
// first query after a suspend sometimes fails outright (P1001 — "can't
// reach database server") while the compute wakes up, then succeeds a
// moment later. This wraps a *read-only* Prisma call with a single retry
// after a short delay so that cold-start blip doesn't surface as a 500 to
// the user. Mirrors the "retry only idempotent operations" rule already
// applied client-side in lib/api.ts — never wrap a mutating query with
// this (a retried write after a dropped connection can double-write if
// the first attempt actually reached the server).
import { Prisma } from '@prisma/client';

const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);
const RETRY_DELAY_MS = 400;

function isTransientConnectionError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT_CODES.has(err.code);
}

export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransientConnectionError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fn();
  }
}
