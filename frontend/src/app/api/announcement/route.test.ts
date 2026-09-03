import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { GET } from './route';

function makeGet(): NextRequest {
  return new NextRequest('http://test/api/announcement', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/announcement', () => {
  it('returns null when no announcement is set', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ announcement: null });
  });

  it('returns message + tone when enabled', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      key: 'announcement',
      value: { message: 'Maintenance dimanche', tone: 'warn', enabled: true },
      updatedAt: new Date(),
      updatedBy: 'super-1',
    } as never);
    const res = await GET(makeGet());
    expect(await res.json()).toEqual({
      announcement: { message: 'Maintenance dimanche', tone: 'warn' },
    });
  });

  it('degrades to null when the AppSetting table is missing (migration not applied)', async () => {
    prismaMock.appSetting.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('table does not exist', {
        code: 'P2021',
        clientVersion: 'test',
      }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ announcement: null });
  });

  it('degrades to null when the database is unreachable (P1001)', async () => {
    prismaMock.appSetting.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Can’t reach database server', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ announcement: null });
  });
});
