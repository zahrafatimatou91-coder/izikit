// frontend/src/test-utils/moneroo-mock.ts
//
// Fixture builder for /api/webhooks/moneroo route tests, mirroring
// bictorys-mock.ts. Returns:
//   - rawBody (Buffer) — exact bytes Moneroo would have signed
//   - headers (Record<string,string>) — including a valid HMAC signature
//   - payload (MonerooWebhookPayload) — the parsed shape
//
// Tests can mutate any field to simulate a tampered body / wrong signature.
//
// HMAC algorithm mirrors `frontend/src/lib/server/payments/moneroo.ts`
// verbatim (sha256 of the raw body, no timestamp prefix — unlike Bictorys,
// Moneroo has no replay-window concept). Drift between fixture and verifier
// is impossible by construction — the fixture re-derives from the same
// canonical recipe.
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import type { MonerooWebhookPayload } from '@/lib/server/payments/moneroo';

export interface MonerooFixtureOpts {
  event?: 'payment.success' | 'payment.failed' | 'payment.cancelled' | 'payment.initiated';
  paymentId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  webhookSecret?: string;
}

export function monerooFixture(opts: MonerooFixtureOpts = {}): {
  rawBody: Buffer;
  headers: Record<string, string>;
  payload: MonerooWebhookPayload;
} {
  const event = opts.event ?? 'payment.success';
  const payload: MonerooWebhookPayload = {
    event,
    data: {
      id: opts.paymentId ?? 'py_test_001',
      amount: opts.amount ?? 1500,
      currency: opts.currency ?? 'XOF',
      status: opts.status ?? 'success',
    },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const secret = opts.webhookSecret ?? 'test-webhook-secret';
  const sig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return {
    rawBody,
    headers: {
      'content-type': 'application/json',
      'x-moneroo-signature': sig,
    },
    payload,
  };
}

/** Build a NextRequest with the fixture body + headers. Use in route tests. */
export function monerooFixtureRequest(opts: MonerooFixtureOpts = {}): {
  req: NextRequest;
  payload: MonerooWebhookPayload;
} {
  const { rawBody, headers, payload } = monerooFixture(opts);
  // Buffer is a Uint8Array subclass at runtime but TS' BodyInit type rejects
  // both. Cast to BodyInit — the bytes are byte-identical to what fetch
  // would send and the underlying NextRequest accepts ArrayBufferView.
  const body = rawBody as unknown as BodyInit;
  return {
    req: new NextRequest('http://localhost/api/webhooks/moneroo', {
      method: 'POST',
      headers,
      body,
    }),
    payload,
  };
}
