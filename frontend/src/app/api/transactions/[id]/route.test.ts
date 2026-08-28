// GET/PATCH/DELETE /api/transactions/[id] tests.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/server/transactions/envelope-threshold', () => ({
  maybeFireEnvelopeThreshold: vi.fn().mockResolvedValue(undefined),
}));

import { requireAuth } from '@/lib/server/middleware';
import { maybeFireEnvelopeThreshold } from '@/lib/server/transactions/envelope-threshold';
import { GET, PATCH, DELETE } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockThreshold = vi.mocked(maybeFireEnvelopeThreshold);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://test/api/transactions/txn-1', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-tok',
      cookie: 'app-csrf=csrf-tok',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
});

describe('GET /api/transactions/[id]', () => {
  it('returns the transaction scoped to the requesting user', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'txn-1',
      amount: -500,
      label: 'Marché',
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      envelope: { id: 'env-1', name: 'Nourriture', icon: 'utensils' },
    } as never);

    const res = await GET(makeReq('GET'), withParams('txn-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction.envelope.name).toBe('Nourriture');
  });

  it('returns NOT_FOUND when the transaction does not belong to this user', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue(null);

    const res = await GET(makeReq('GET'), withParams('txn-1'));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/transactions/[id]', () => {
  it('updates amount/label/envelope and fires the threshold check for a negative envelope spend', async () => {
    prismaMock.envelope.findFirst.mockResolvedValue({ id: 'env-1' } as never);
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      amount: -700,
      label: 'Marché (corrigé)',
      envelopeId: 'env-1',
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never);

    const res = await PATCH(
      makeReq('PATCH', { amount: -700, label: 'Marché (corrigé)', envelopeId: 'env-1' }),
      withParams('txn-1'),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'txn-1', userId: 'user-1' },
      data: { amount: -700, label: 'Marché (corrigé)', envelopeId: 'env-1' },
    });
    expect(mockThreshold).toHaveBeenCalledWith('user-1', 'env-1');
  });

  it('does not fire the threshold check for income (positive amount)', async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      amount: 5000,
      label: 'Virement',
      envelopeId: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never);

    const res = await PATCH(
      makeReq('PATCH', { amount: 5000, label: 'Virement', envelopeId: null }),
      withParams('txn-1'),
    );
    expect(res.status).toBe(200);
    expect(mockThreshold).not.toHaveBeenCalled();
  });

  it('returns ENVELOPE_NOT_FOUND for an envelope owned by someone else', async () => {
    prismaMock.envelope.findFirst.mockResolvedValue(null);

    const res = await PATCH(
      makeReq('PATCH', { amount: -500, label: 'x', envelopeId: 'not-mine' }),
      withParams('txn-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ENVELOPE_NOT_FOUND');
    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the transaction does not belong to this user', async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(
      makeReq('PATCH', { amount: -500, label: 'x', envelopeId: null }),
      withParams('txn-1'),
    );
    expect(res.status).toBe(404);
  });

  it('rejects amount: 0 with VALIDATION_FAILED', async () => {
    const res = await PATCH(
      makeReq('PATCH', { amount: 0, label: 'x', envelopeId: null }),
      withParams('txn-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
  });
});

describe('DELETE /api/transactions/[id]', () => {
  it('deletes the transaction scoped to the requesting user', async () => {
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(makeReq('DELETE'), withParams('txn-1'));
    expect(res.status).toBe(200);
    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: 'txn-1', userId: 'user-1' },
    });
  });

  it('returns NOT_FOUND when nothing was deleted', async () => {
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 0 });

    const res = await DELETE(makeReq('DELETE'), withParams('txn-1'));
    expect(res.status).toBe(404);
  });
});
