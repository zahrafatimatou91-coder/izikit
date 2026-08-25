// Local-dev-only convenience: polls the cron routes every 10s so queued
// work (verification emails, outbox events) doesn't sit stuck until
// someone manually curls the endpoint. In production, Vercel Cron calls
// these same routes on its own schedule (frontend/vercel.json) — this
// script exists ONLY because `pnpm dev` has no such scheduler. It is never
// deployed; it runs alongside `next dev` via the `dev` script's
// `concurrently` call (see package.json).
import { pathToFileURL } from 'node:url';

const PORT = process.env.PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;
const CRON_SECRET = process.env.CRON_SECRET;
const POLL_MS = 10_000;

const ROUTES = ['/api/cron/outbox-drain', '/api/cron/email-queue-drain'];

async function tick(): Promise<void> {
  if (!CRON_SECRET) return; // nothing to authenticate with — stay silent

  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE_URL}${route}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      if (!res.ok) continue; // server likely still booting — try again next tick
      const body = (await res.json()) as { processed?: number };
      if (body.processed && body.processed > 0) {
        console.log(`[dev-cron] ${route} → processed ${body.processed}`);
      }
    } catch {
      // Server not up yet, or a transient network hiccup — silent, next
      // tick retries. This is dev-only convenience, not a monitored job.
    }
  }
}

function main(): void {
  if (!CRON_SECRET) {
    console.warn('[dev-cron] CRON_SECRET not set — local auto-drain disabled.');
    return;
  }
  console.log(`[dev-cron] polling ${ROUTES.join(', ')} every ${POLL_MS / 1000}s`);
  setInterval(() => {
    void tick();
  }, POLL_MS);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
