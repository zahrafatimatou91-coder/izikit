import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

import { POST } from './route';

const VALID_CODE = 'ABCD2345';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://test/api/auth/verify-reset-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/verify-reset-code', () => {
  it('returns valid:true and does NOT consume the code', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    const res = await POST(makeReq({ email: 'valid@example.com', code: VALID_CODE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: true });
    expect(prismaMock.verificationCode.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns VERIFICATION_CODE_INVALID for an unknown email (enumeration-resist)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeReq({ email: 'nobody@example.com', code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VERIFICATION_CODE_INVALID');
  });

  it('returns VERIFICATION_CODE_INVALID when no matching code exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue(null);

    const res = await POST(makeReq({ email: 'wrong-code@example.com', code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VERIFICATION_CODE_INVALID');
  });

  it('returns VERIFICATION_CODE_EXPIRED when the code is past expiry', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as never);
    prismaMock.verificationCode.findFirst.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1_000),
    } as never);

    const res = await POST(makeReq({ email: 'expired@example.com', code: VALID_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VERIFICATION_CODE_EXPIRED');
  });

  it('shares the auth:reset bucket — returns 429 TOO_MANY_RESET_ATTEMPTS after 5/15m', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const calls = await Promise.all(
      Array.from({ length: 6 }, () =>
        POST(makeReq({ email: 'rl-verify@example.com', code: VALID_CODE })),
      ),
    );
    const limited = calls.find((r) => r.status === 429)!;
    expect(limited).toBeTruthy();
    const body = await limited.json();
    expect(body.error).toBe('TOO_MANY_RESET_ATTEMPTS');
  });

  it('rejects malformed code with VALIDATION_FAILED', async () => {
    const res = await POST(makeReq({ email: 'bad-format@example.com', code: 'short' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
  });

  it("source exports runtime='nodejs' and never marks the code used", () => {
    const src = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
    expect(src).not.toContain('usedAt: new Date()');
    expect(src).not.toContain('updateMany');
  });
});
