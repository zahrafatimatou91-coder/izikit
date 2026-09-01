import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { monerooFixtureRequest } from '@/test-utils/moneroo-mock';

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const orderFindFirst = vi.fn();
const orderUpdate = vi.fn();
const outboxCreate = vi.fn();
const subscriptionFindUnique = vi.fn();
const subscriptionUpsert = vi.fn();
const envelopeUpdateMany = vi.fn();
const savingsGoalUpdateMany = vi.fn();
const verifyPayment = vi.fn();

const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>, _opts?: unknown) =>
  fn({
    webhookLog: { findUnique, create, update },
    order: { findFirst: orderFindFirst, update: orderUpdate },
    outboxEvent: { create: outboxCreate },
    subscription: { findUnique: subscriptionFindUnique, upsert: subscriptionUpsert },
    envelope: { updateMany: envelopeUpdateMany },
    savingsGoal: { updateMany: savingsGoalUpdateMany },
  }),
);

vi.mock('@/lib/server/prisma', () => ({
  prisma: { $transaction },
}));

// The route re-queries Moneroo for defense-in-depth before trusting a
// payment.success event — mock the provider singleton rather than hitting
// the network. Defaults to "no live data" (verifyPayment resolves null),
// which the route treats as "trust the signed webhook".
vi.mock('@/lib/server/payments/provider-singleton', () => ({
  getMonerooProvider: () => ({ verifyPayment }),
}));

beforeEach(() => {
  vi.stubEnv('MONEROO_API_KEY', 'test-api-key');
  vi.stubEnv('MONEROO_WEBHOOK_SECRET', 'test-webhook-secret');
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  orderFindFirst.mockReset();
  orderUpdate.mockReset();
  outboxCreate.mockReset();
  subscriptionFindUnique.mockReset();
  subscriptionUpsert.mockReset();
  envelopeUpdateMany.mockReset();
  savingsGoalUpdateMany.mockReset();
  verifyPayment.mockReset();
  verifyPayment.mockResolvedValue(null); // default: re-query inconclusive → trust webhook
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/webhooks/moneroo', () => {
  it('valid HMAC + first delivery returns 200 deduped:false', async () => {
    findUnique.mockResolvedValueOnce(null); // no existing WebhookLog row
    orderFindFirst.mockResolvedValueOnce(null); // unknown charge — onPaid drops
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: false });
    expect(create).toHaveBeenCalled(); // WebhookLog row inserted
  });

  it('replay of same (externalId, eventType) returns deduped:true', async () => {
    findUnique.mockResolvedValueOnce({ id: 'wl1', processedAt: new Date() });
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(create).not.toHaveBeenCalled(); // no new row written
  });

  it('tampered body returns 401', async () => {
    const { rawBody, headers } = (await import('@/test-utils/moneroo-mock')).monerooFixture({
      event: 'payment.success',
    });
    const tampered = Buffer.from(rawBody.toString('utf8').replace('success', 'failed'));
    const { POST } = await import('./route');
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/webhooks/moneroo', {
      method: 'POST',
      headers,
      body: tampered,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('missing signature header returns 401', async () => {
    const { NextRequest } = await import('next/server');
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/webhooks/moneroo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify({ event: 'payment.success', data: { id: 'py1' } })),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('onPaid enqueues outbox events when order is found', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
    });
    outboxCreate.mockResolvedValue({ id: 'ob1' });
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    await POST(req);
    expect(outboxCreate).toHaveBeenCalled();
    const kinds = outboxCreate.mock.calls.map(
      (c) => (c[0] as { data: { kind: string } }).data.kind,
    );
    expect(
      kinds.some(
        (k) => k === 'notification.payment_received' || k === 'email.payment_confirmation',
      ),
    ).toBe(true);
  });

  it('onPaid skips activation when the re-query disagrees with the webhook', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
    });
    verifyPayment.mockResolvedValueOnce({ status: 'failed' });
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    await POST(req);
    expect(orderUpdate).not.toHaveBeenCalled();
    expect(outboxCreate).not.toHaveBeenCalled();
  });

  it('onPaid proceeds when the re-query confirms the webhook', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
    });
    verifyPayment.mockResolvedValueOnce({ status: 'success' });
    outboxCreate.mockResolvedValue({ id: 'ob1' });
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    await POST(req);
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    });
  });

  it('onPaid still activates when the re-query call itself fails (network blip)', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
    });
    verifyPayment.mockRejectedValueOnce(new Error('network timeout'));
    outboxCreate.mockResolvedValue({ id: 'ob1' });
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    await POST(req);
    expect(orderUpdate).toHaveBeenCalled();
  });

  it('onPaid activates Pro and extends currentPeriodEnd for a subscription order', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1500,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'monthly' },
    });
    outboxCreate.mockResolvedValue({ id: 'ob1' });
    subscriptionFindUnique.mockResolvedValueOnce(null);
    subscriptionUpsert.mockResolvedValue({});
    envelopeUpdateMany.mockResolvedValue({ count: 0 });
    savingsGoalUpdateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success', amount: 1500 });
    await POST(req);

    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = subscriptionUpsert.mock.calls[0]?.[0];
    expect(upsertArg.where).toEqual({ userId: 'u1' });
    expect(upsertArg.update.plan).toBe('PRO');
    expect(upsertArg.update.lastOrderId).toBe('o1');
  });

  it('onPaid refuses to activate Pro when the amount does not match the expected price', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o4',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'monthly' },
    });
    outboxCreate.mockResolvedValue({ id: 'ob4' });

    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.success' });
    await POST(req);

    expect(subscriptionUpsert).not.toHaveBeenCalled();
    expect(envelopeUpdateMany).not.toHaveBeenCalled();
  });

  it('onFailed flips Order to FAILED', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({ id: 'o5' });
    const { POST } = await import('./route');
    const { req } = monerooFixtureRequest({ event: 'payment.failed' });
    await POST(req);
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'o5' }, data: { status: 'FAILED' } });
  });

  it('exports runtime=nodejs and dynamic=force-dynamic', async () => {
    const mod = (await import('./route')) as { runtime?: string; dynamic?: string };
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
