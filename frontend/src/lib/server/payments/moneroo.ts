/**
 * Moneroo provider — hosted checkout aggregator covering Mobile Money +
 * card across the whole African market (Wave, Orange Money, MTN, Moov,
 * Airtel, Free Money, Mvola…), including CEMAC/XAF countries that Bictorys
 * (UEMOA/XOF-only) does not reach. See CLAUDE.md's payments table and
 * .claude/skills/izisaas-payments-handler/references/moneroo.md.
 *
 * No separate sandbox host — test vs live is entirely determined by which
 * secret key is configured (`MONEROO_API_KEY`); the same base URL serves
 * both.
 *
 * No payouts / refunds — Moneroo's public API doesn't document either
 * endpoint at the time of writing. `payout()` / `refund()` both throw.
 * Withdrawals stay on Bictorys until Moneroo ships payouts.
 *
 * Webhook signature: `X-Moneroo-Signature` header = hex HMAC-SHA256 of the
 * RAW body with `MONEROO_WEBHOOK_SECRET` (timing-safe compare). Unlike
 * Bictorys, Moneroo does not send a stable event id — this app dedupes on
 * `WebhookLog @@unique([externalId, eventType])`, so `data.id` + `event`
 * (e.g. "py_01H..." + "payment.success") is used as that pair; a retried
 * delivery of the same event naturally collapses to the same row.
 *
 * Dev escape hatch: same `SMOKE_BYPASS_WEBHOOK_VERIFY=1` convention as
 * Bictorys — accepts any signature unconditionally. **DEV ONLY.**
 */
import crypto from 'node:crypto';
import { createLogger } from '../logger';
import type { WebhookProvider, ParsedIds, WebhookEventType } from '../webhook/handler';
import type {
  PaymentProvider,
  ChargeInput,
  ChargeResult,
  PayoutInput,
  PayoutResult,
  RefundInput,
  RefundResult,
} from './provider';

const logger = createLogger();

// ───────────────────────────────────────────────────────────────────────
// Env shape
// ───────────────────────────────────────────────────────────────────────

export interface MonerooEnv {
  /** Secret key — Bearer token for every API call. Required. */
  MONEROO_API_KEY: string;
  /** HMAC secret for `X-Moneroo-Signature` verification. Required. */
  MONEROO_WEBHOOK_SECRET: string;
}

// ───────────────────────────────────────────────────────────────────────
// Webhook payload
// ───────────────────────────────────────────────────────────────────────

export interface MonerooWebhookPayload {
  /** "payment.success" | "payment.failed" | "payment.cancelled" | "payment.initiated". */
  event?: string;
  data?: {
    id?: string;
    amount?: number | string;
    currency?: string | { code?: string };
    status?: string;
    metadata?: Record<string, unknown>;
    customer?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ───────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────

const MONEROO_API_URL = 'https://api.moneroo.io';
const HTTP_TIMEOUT_MS = 15_000; // Moneroo can be slow during African-evening peaks.

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Moneroo requires customer.first_name/last_name — split a free-text name,
 * falling back to the email local-part when no name was collected. */
function splitName(
  full: string | undefined,
  fallbackEmail: string,
): { first: string; last: string } {
  const v = (full ?? '').trim();
  if (!v) {
    const local = fallbackEmail.split('@')[0] || 'Customer';
    return { first: local, last: '-' };
  }
  const parts = v.split(/\s+/);
  return { first: parts[0]!, last: parts.slice(1).join(' ') || '-' };
}

function classifyStatus(raw: string | undefined): 'PENDING' | 'PAID' | 'FAILED' {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'success' || s === 'succeeded' || s === 'completed' || s === 'paid') return 'PAID';
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'error') return 'FAILED';
  return 'PENDING';
}

/** `payment.initiated` is informational only — the Order row is already
 * PENDING from checkout, so it maps to 'other' (no handler dispatch). */
function classifyEventKind(event: string | undefined): WebhookEventType {
  if (event === 'payment.success') return 'paid';
  if (event === 'payment.failed' || event === 'payment.cancelled') return 'failed';
  return 'other';
}

// ───────────────────────────────────────────────────────────────────────
// Factory
// ───────────────────────────────────────────────────────────────────────

export interface MonerooProviderHandle extends PaymentProvider {
  /** Webhook provider for `createWebhookHandler`. */
  webhookProvider: WebhookProvider<MonerooWebhookPayload>;
  /**
   * Re-query a payment's live status — the skill-recommended
   * defense-in-depth for Moneroo webhooks (the HMAC is safe on its own; the
   * live API call is cheap insurance). Returns `null` on any network/parse
   * failure so callers can fall back to trusting the signed webhook.
   */
  verifyPayment(
    paymentId: string,
  ): Promise<{ status: string; amount?: number; currency?: string } | null>;
}

export function createMonerooProvider(env: MonerooEnv): MonerooProviderHandle {
  if (!env.MONEROO_API_KEY) throw new Error('createMonerooProvider: MONEROO_API_KEY is required');
  if (!env.MONEROO_WEBHOOK_SECRET)
    throw new Error('createMonerooProvider: MONEROO_WEBHOOK_SECRET is required');

  async function monerooFetch(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      return await fetch(`${MONEROO_API_URL}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // ── charge ─────────────────────────────────────────────────────────
  async function charge(input: ChargeInput): Promise<ChargeResult> {
    const customerEmail = input.customer.email;
    if (!customerEmail) {
      // Moneroo silently 400s without customer.email — fail fast with a
      // clear message rather than surfacing their generic error text.
      throw new Error('Moneroo charge requires customer.email');
    }
    const { first, last } = splitName(input.customer.name, customerEmail);

    // Moneroo has no `cancel_url` — only `return_url`. The hosted page
    // redirects there with `?paymentId=...&paymentStatus=...` regardless of
    // outcome, so `input.failureUrl` is intentionally unused here; a caller
    // wiring Moneroo into checkout should branch its return page on that
    // query param instead of relying on a distinct failure redirect.
    const body: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency,
      description: `Order ${input.externalRef}`.slice(0, 200),
      return_url: input.successUrl,
      customer: {
        email: customerEmail,
        first_name: first,
        last_name: last,
        ...(input.customer.phone ? { phone: input.customer.phone } : {}),
      },
      metadata: {
        paymentId: input.externalRef,
        ...Object.fromEntries(
          Object.entries(input.metadata ?? {})
            .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
            .map(([k, v]) => [k, String(v)]),
        ),
      },
    };

    let res: Response;
    try {
      res = await monerooFetch('/v1/payments/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.MONEROO_API_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Moneroo network error: ${msg}`);
    }

    let parsed: {
      data?: { id?: string; checkout_url?: string; status?: string };
      message?: string;
    };
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      throw new Error(`Moneroo returned HTTP ${res.status} (non-JSON)`);
    }

    // Moneroo can return 200 OK with an incomplete body — both id AND
    // checkout_url must be present before we treat this as success.
    if (!res.ok || !parsed.data?.id || !parsed.data?.checkout_url) {
      throw new Error(parsed.message || `Moneroo charge failed: HTTP ${res.status}`);
    }

    return {
      providerChargeId: parsed.data.id,
      paymentUrl: parsed.data.checkout_url,
      status: classifyStatus(parsed.data.status),
    };
  }

  // ── payout / refund (not supported by Moneroo's public API) ────────
  async function payout(_input: PayoutInput): Promise<PayoutResult> {
    throw new Error('Payout not supported by Moneroo provider');
  }

  async function refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error('Refund not supported by Moneroo provider');
  }

  // ── re-query (defense-in-depth) ─────────────────────────────────────
  async function verifyPayment(
    paymentId: string,
  ): Promise<{ status: string; amount?: number; currency?: string } | null> {
    let res: Response;
    try {
      res = await monerooFetch(`/v1/payments/${encodeURIComponent(paymentId)}/verify`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${env.MONEROO_API_KEY}`, Accept: 'application/json' },
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const json = (await res.json().catch(() => null)) as {
      data?: { status?: string; amount?: number | string; currency?: { code?: string } | string };
    } | null;
    if (!json?.data?.status) return null;

    const currency =
      typeof json.data.currency === 'string' ? json.data.currency : json.data.currency?.code;
    const amount =
      typeof json.data.amount === 'string' ? parseInt(json.data.amount, 10) : json.data.amount;

    // exactOptionalPropertyTypes forbids assigning `undefined` to an
    // optional property — omit amount/currency entirely rather than setting
    // them to undefined when the API didn't report a value.
    return {
      status: String(json.data.status).toLowerCase(),
      ...(amount !== undefined ? { amount } : {}),
      ...(currency !== undefined ? { currency } : {}),
    };
  }

  // ── webhook provider ──────────────────────────────────────────────
  const webhookProvider: WebhookProvider<MonerooWebhookPayload> = {
    name: 'moneroo',

    verifySignature(rawBody, headers) {
      // DEV ONLY escape hatch.
      if (process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1') {
        logger.warn(
          '[moneroo] !! SMOKE_BYPASS_WEBHOOK_VERIFY=1 — webhook signature ACCEPTED unconditionally. NEVER set this in production.',
        );
        return { valid: true };
      }

      const sig = headers['x-moneroo-signature'];
      if (!sig) return { valid: false, reason: 'missing x-moneroo-signature header' };

      const expected = crypto
        .createHmac('sha256', env.MONEROO_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      if (timingSafeStringEqual(sig.trim(), expected)) {
        return { valid: true };
      }
      return { valid: false, reason: 'HMAC mismatch' };
    },

    parsePayload(rawBody) {
      return JSON.parse(rawBody.toString('utf8')) as MonerooWebhookPayload;
    },

    extractIds(payload): ParsedIds {
      const externalId = String(payload.data?.id ?? '');
      const eventType = String(payload.event ?? 'unknown');
      const kind = classifyEventKind(payload.event);
      return { externalId, eventType, kind };
    },
  };

  return {
    name: 'moneroo',
    charge,
    payout,
    refund,
    verifyPayment,
    webhookProvider,
  };
}
