// POST /api/envelopes tests — focused on the duplicate-name guard (same
// rationale as savings-goals/route.test.ts).
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
  return new NextRequest('http://test/api/envelopes', {
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

describe('POST /api/envelopes', () => {
  it('creates an envelope when the name is not taken', async () => {
    prismaMock.envelope.findMany.mockResolvedValue([]);
    prismaMock.envelope.create.mockResolvedValue({
      id: 'env-1',
      name: 'Transport',
      icon: 'car',
      color: 'envelope-1',
      monthlyLimit: 20000,
    } as never);

    const res = await POST(
      makePost({ name: 'Transport', icon: 'car', color: 'envelope-1', monthlyLimit: 20000 }),
    );
    expect(res.status).toBe(201);
    expect(prismaMock.envelope.create).toHaveBeenCalled();
  });

  it('rejects a name that already exists for this user with ENVELOPE_NAME_TAKEN', async () => {
    prismaMock.envelope.findMany.mockResolvedValue([{ name: 'Transport' } as never]);

    const res = await POST(
      makePost({ name: 'Transport', icon: 'car', color: 'envelope-1', monthlyLimit: 20000 }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('ENVELOPE_NAME_TAKEN');
    expect(typeof body.message).toBe('string');
    expect(prismaMock.envelope.create).not.toHaveBeenCalled();
  });

  it('matches accent/case-insensitively', async () => {
    prismaMock.envelope.findMany.mockResolvedValue([{ name: 'transport' } as never]);

    const res = await POST(
      makePost({ name: 'TRANSPORT', icon: 'car', color: 'envelope-1', monthlyLimit: 20000 }),
    );
    expect(res.status).toBe(409);
    expect(prismaMock.envelope.create).not.toHaveBeenCalled();
  });
});
