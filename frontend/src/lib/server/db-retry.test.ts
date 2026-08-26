import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { withDbRetry } from './db-retry';

function p1001(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
    code: 'P1001',
    clientVersion: '5.22.0',
  });
}

describe('withDbRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withDbRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries once after a transient connection error then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(p1001()).mockResolvedValueOnce('recovered');
    await expect(withDbRetry(fn)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows if the retry also fails', async () => {
    const fn = vi.fn().mockRejectedValue(p1001());
    await expect(withDbRetry(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient errors', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });
    const fn = vi.fn().mockRejectedValue(notFound);
    await expect(withDbRetry(fn)).rejects.toBe(notFound);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-Prisma errors', async () => {
    const err = new Error('boom');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withDbRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
