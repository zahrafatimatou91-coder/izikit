import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bictorysFixtureRequest } from '@/test-utils/bictorys-mock';

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

beforeEach(() => {
  vi.stubEnv('BICTORYS_API_URL', 'https://api.bictorys.test');
  vi.stubEnv('BICTORYS_API_KEY', 'test-api-key');
  vi.stubEnv('BICTORYS_WEBHOOK_SECRET', 'test-webhook-secret');
  vi.stubEnv('BICTORYS_WEBHOOK_REPLAY_WINDOW_MS', '60000');
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/webhooks/bictorys', () => {
  it('valid HMAC + first delivery returns 200 deduped:false (WH-01)', async () => {
    findUnique.mockResolvedValueOnce(null); // no existing WebhookLog row
    orderFindFirst.mockResolvedValueOnce(null); // unknown charge — onPaid drops
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: false });
    expect(create).toHaveBeenCalled(); // WebhookLog row inserted
  });

  it('replay of same (externalId, eventType) returns deduped:true (WH-02)', async () => {
    findUnique.mockResolvedValueOnce({ id: 'wl1', processedAt: new Date() });
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(create).not.toHaveBeenCalled(); // no new row written
  });

  it('tampered body returns 401', async () => {
    const { rawBody, headers } = (await import('@/test-utils/bictorys-mock')).bictorysFixture({
      status: 'succeeded',
    });
    const tampered = Buffer.from(rawBody.toString('utf8').replace('succeeded', 'failed'));
    const { POST } = await import('./route');
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/webhooks/bictorys', {
      method: 'POST',
      headers,
      body: tampered,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('expired replay window (drift > 60s) returns 401', async () => {
    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({
      status: 'succeeded',
      timestamp: Date.now() - 70_000, // 70s old
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('onPaid enqueues outbox event when order is found (WH-02 — outbox-not-closures)', async () => {
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
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);
    expect(outboxCreate).toHaveBeenCalled();
    // Assert at least one outbox row's kind starts with 'notification.' or 'email.'
    const kinds = outboxCreate.mock.calls.map(
      (c) => (c[0] as { data: { kind: string } }).data.kind,
    );
    expect(
      kinds.some(
        (k) => k === 'notification.payment_received' || k === 'email.payment_confirmation',
      ),
    ).toBe(true);
  });

  it('onPaid activates Pro and extends currentPeriodEnd when order.metadata.purpose is "subscription"', async () => {
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
    subscriptionFindUnique.mockResolvedValueOnce(null); // no existing subscription row
    subscriptionUpsert.mockResolvedValue({});
    envelopeUpdateMany.mockResolvedValue({ count: 0 });
    savingsGoalUpdateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = subscriptionUpsert.mock.calls[0]?.[0];
    expect(upsertArg.where).toEqual({ userId: 'u1' });
    expect(upsertArg.update.plan).toBe('PRO');
    expect(upsertArg.update.status).toBe('ACTIVE');
    expect(upsertArg.update.lastOrderId).toBe('o1');
    // ~30 days out (monthly), give or take a second for test execution time.
    const periodEnd = (upsertArg.update.currentPeriodEnd as Date).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(periodEnd).toBeGreaterThan(Date.now() + thirtyDaysMs - 5000);
    expect(periodEnd).toBeLessThan(Date.now() + thirtyDaysMs + 5000);

    expect(envelopeUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });

  it('onPaid extends from the existing currentPeriodEnd, not from now, when still Pro', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o2',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1500,
      currency: 'XOF',
      metadata: { purpose: 'subscription', period: 'monthly' },
    });
    outboxCreate.mockResolvedValue({ id: 'ob2' });
    const futurePeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    subscriptionFindUnique.mockResolvedValueOnce({
      userId: 'u1',
      plan: 'PRO',
      currentPeriodEnd: futurePeriodEnd,
      lastOrderId: 'o-old',
    });
    subscriptionUpsert.mockResolvedValue({});
    envelopeUpdateMany.mockResolvedValue({ count: 0 });
    savingsGoalUpdateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    const upsertArg = subscriptionUpsert.mock.calls[0]?.[0];
    const expected = futurePeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000;
    expect((upsertArg.update.currentPeriodEnd as Date).getTime()).toBe(expected);
  });

  it('onPaid does not touch Subscription for a non-subscription order', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o3',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
      metadata: null,
    });
    outboxCreate.mockResolvedValue({ id: 'ob3' });

    const { POST } = await import('./route');
    const { req } = bictorysFixtureRequest({ status: 'succeeded' });
    await POST(req);

    expect(subscriptionUpsert).not.toHaveBeenCalled();
    expect(envelopeUpdateMany).not.toHaveBeenCalled();
  });

  it('exports runtime=nodejs and dynamic=force-dynamic (WH-01)', async () => {
    const mod = (await import('./route')) as { runtime?: string; dynamic?: string };
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
