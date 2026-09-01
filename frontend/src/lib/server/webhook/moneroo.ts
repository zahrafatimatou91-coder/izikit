// frontend/src/lib/server/webhook/moneroo.ts
//
// Thin lazy-init wrapper mirroring webhook/bictorys.ts — the real HMAC +
// payload logic lives in payments/moneroo.ts (webhookProvider) and is not
// duplicated here.
//
// Why lazy? `createMonerooProvider({...})` throws synchronously if
// MONEROO_API_KEY / MONEROO_WEBHOOK_SECRET is missing (payments/moneroo.ts).
// Reading env at module-import time would crash this route module on
// import whenever Moneroo isn't configured. Lazy-init also supports
// `vi.stubEnv` in tests — see webhook/bictorys.test.ts for the pattern.
import 'server-only';
import type { WebhookProvider } from './handler';
import { createMonerooProvider, type MonerooWebhookPayload } from '../payments/moneroo';

export type { MonerooWebhookPayload };

let _provider: WebhookProvider<MonerooWebhookPayload> | null = null;

/** Lazy-init — env reads happen at first call so `vi.stubEnv` works in tests. */
export function getMonerooWebhookProvider(): WebhookProvider<MonerooWebhookPayload> {
  if (_provider) return _provider;
  const env = {
    MONEROO_API_KEY: process.env.MONEROO_API_KEY ?? '',
    MONEROO_WEBHOOK_SECRET: process.env.MONEROO_WEBHOOK_SECRET ?? '',
  };
  if (!env.MONEROO_API_KEY || !env.MONEROO_WEBHOOK_SECRET) {
    throw new Error('Moneroo webhook provider not configured (env missing)');
  }
  _provider = createMonerooProvider(env).webhookProvider;
  return _provider;
}

/** Convenience binding for the route file. */
export const monerooWebhookProvider: WebhookProvider<MonerooWebhookPayload> = {
  name: 'moneroo',
  verifySignature: (raw, headers) => getMonerooWebhookProvider().verifySignature(raw, headers),
  parsePayload: (raw) => getMonerooWebhookProvider().parsePayload(raw),
  extractIds: (payload) => getMonerooWebhookProvider().extractIds(payload),
};

/** Test-only — clear the cached provider for `vi.stubEnv` reuse. */
export function __resetMonerooWebhookProvider(): void {
  _provider = null;
}
