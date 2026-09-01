import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  monerooWebhookProvider,
  getMonerooWebhookProvider,
  __resetMonerooWebhookProvider,
} from './moneroo';

const SECRET = 'test-webhook-secret';

beforeEach(() => {
  vi.stubEnv('MONEROO_API_KEY', 'test-api-key');
  vi.stubEnv('MONEROO_WEBHOOK_SECRET', SECRET);
  __resetMonerooWebhookProvider();
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetMonerooWebhookProvider();
});

describe('monerooWebhookProvider', () => {
  it('verifies a valid HMAC of the raw body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.success', data: { id: 'py1' } }));
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    const r = monerooWebhookProvider.verifySignature(body, { 'x-moneroo-signature': sig });
    expect(r.valid).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = Buffer.from(
      JSON.stringify({ event: 'payment.success', data: { id: 'py1', status: 'success' } }),
    );
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    const tampered = Buffer.from(
      JSON.stringify({ event: 'payment.success', data: { id: 'py1', status: 'failed' } }),
    );
    const r = monerooWebhookProvider.verifySignature(tampered, { 'x-moneroo-signature': sig });
    expect(r.valid).toBe(false);
  });

  it('rejects a missing signature header', () => {
    const body = Buffer.from('{}');
    const r = monerooWebhookProvider.verifySignature(body, {});
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/missing/i);
  });

  it('throws when env unset (lazy init)', () => {
    vi.stubEnv('MONEROO_API_KEY', '');
    __resetMonerooWebhookProvider();
    expect(() => getMonerooWebhookProvider()).toThrow(/not configured/i);
  });

  it('extractIds maps payment.success to kind=paid', () => {
    const payload = { event: 'payment.success', data: { id: 'py1', status: 'success' } };
    const ids = monerooWebhookProvider.extractIds(payload as never);
    expect(ids.kind).toBe('paid');
    expect(ids.externalId).toBe('py1');
    expect(ids.eventType).toBe('payment.success');
  });

  it('extractIds maps payment.failed to kind=failed', () => {
    const payload = { event: 'payment.failed', data: { id: 'py2', status: 'failed' } };
    const ids = monerooWebhookProvider.extractIds(payload as never);
    expect(ids.kind).toBe('failed');
  });

  it('extractIds maps payment.cancelled to kind=failed', () => {
    const payload = { event: 'payment.cancelled', data: { id: 'py3', status: 'cancelled' } };
    const ids = monerooWebhookProvider.extractIds(payload as never);
    expect(ids.kind).toBe('failed');
  });

  it('extractIds maps payment.initiated to kind=other (ignored)', () => {
    const payload = { event: 'payment.initiated', data: { id: 'py4', status: 'pending' } };
    const ids = monerooWebhookProvider.extractIds(payload as never);
    expect(ids.kind).toBe('other');
  });
});
