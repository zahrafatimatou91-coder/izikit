// POST /api/transactions tests.
//
// Pattern mirrors notifications/route.test.ts: prismaMock first (auto-hoists
// vi.mock for '@/lib/server/prisma'), mockNextCookies() for the async
// cookies() store, vi.mock('@/lib/server/middleware') so requireAuth is
// controlled per test.
import { prismaMock } from '@/test-utils/prisma-mock';
import { mockNextCookies } from '@/test-utils/mock-cookies';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

mockNextCookies();

vi.mock('@/lib/server/middleware', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/server/middleware';
import { POST } from './route';

const mockRequireAuth = vi.mocked(requireAuth);
const authedCtx = { user: { sub: 'user-1', email: 'me@example.com' } };

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://test/api/transactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-tok',
      cookie: 'app-csrf=csrf-tok',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authedCtx as never);
});

describe('POST /api/transactions', () => {
  // Regression: the "Aucune" envelope option and every income transaction
  // send `envelopeId: null` (not omitted) — a bare `.optional()` Zod schema
  // rejects `null` (it only allows `undefined`), so this used to 400 on the
  // most common case (no envelope picked) instead of creating the row.
  it('accepts envelopeId: null (no envelope selected / income) — does NOT 400', async () => {
    prismaMock.transaction.create.mockResolvedValue({
      id: 't1',
      userId: 'user-1',
      amount: -200,
      label: 'Epingle',
      envelopeId: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never);

    const res = await POST(makePost({ amount: -200, label: 'Epingle', envelopeId: null }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.envelopeId).toBeNull();
    expect(prismaMock.envelope.findFirst).not.toHaveBeenCalled();
  });

  it('creates a transaction with a real envelopeId, checking ownership', async () => {
    prismaMock.envelope.findFirst.mockResolvedValue({ id: 'env-1' } as never);
    prismaMock.transaction.create.mockResolvedValue({
      id: 't2',
      userId: 'user-1',
      amount: -500,
      label: 'Marché',
      envelopeId: 'env-1',
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never);

    const res = await POST(makePost({ amount: -500, label: 'Marché', envelopeId: 'env-1' }));
    expect(res.status).toBe(201);
    expect(prismaMock.envelope.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'env-1', userId: 'user-1' } }),
    );
  });

  it('returns ENVELOPE_NOT_FOUND for an envelope owned by someone else', async () => {
    prismaMock.envelope.findFirst.mockResolvedValue(null);

    const res = await POST(makePost({ amount: -500, label: 'Marché', envelopeId: 'not-mine' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ENVELOPE_NOT_FOUND');
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects amount: 0 with VALIDATION_FAILED', async () => {
    const res = await POST(makePost({ amount: 0, label: 'Rien', envelopeId: null }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
  });

  it('rejects an empty label with VALIDATION_FAILED', async () => {
    const res = await POST(makePost({ amount: 100, label: '  ', envelopeId: null }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
  });
});
