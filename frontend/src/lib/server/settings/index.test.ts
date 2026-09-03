import { prismaMock } from '@/test-utils/prisma-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  getSubscriptionPricing,
  getSupportEmail,
  getAnnouncement,
  getAllSettings,
  writeSetting,
  SETTING_SCHEMAS,
  SETTING_KEYS,
} from './index';
import { SUBSCRIPTION_PRICE_FCFA } from '@/lib/server/subscriptions/tier';

function row(key: string, value: unknown, updatedBy: string | null = 'admin-1') {
  return {
    key,
    value,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedBy,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SUPPORT_EMAIL;
});

describe('getSubscriptionPricing', () => {
  it('falls back to the SUBSCRIPTION_PRICE_FCFA constant when the row is absent', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    await expect(getSubscriptionPricing(prismaMock)).resolves.toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
    });
  });

  it('returns the stored pricing when valid', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('subscription.pricing', { monthly: 2000, annual: 18000 }),
    );
    await expect(getSubscriptionPricing(prismaMock)).resolves.toEqual({
      monthly: 2000,
      annual: 18000,
    });
  });

  it('falls back to the constant when the stored value is malformed', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('subscription.pricing', { monthly: 'oops' }),
    );
    await expect(getSubscriptionPricing(prismaMock)).resolves.toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
    });
  });

  it('falls back to the constant when a price is a non-integer', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('subscription.pricing', { monthly: 1500.5, annual: 13500 }),
    );
    await expect(getSubscriptionPricing(prismaMock)).resolves.toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
    });
  });

  it('falls back to the constant when the AppSetting table is missing (P2021)', async () => {
    prismaMock.appSetting.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('no such table', {
        code: 'P2021',
        clientVersion: 'test',
      }),
    );
    await expect(getSubscriptionPricing(prismaMock)).resolves.toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
    });
  });

  it('propagates a real DB error (not a missing-schema error)', async () => {
    prismaMock.appSetting.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('connection lost', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );
    await expect(getSubscriptionPricing(prismaMock)).rejects.toThrow();
  });
});

describe('getSupportEmail', () => {
  it('returns the built-in fallback when nothing is configured', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    await expect(getSupportEmail(prismaMock)).resolves.toBe('support@chaquefranc.com');
  });

  it('prefers the SUPPORT_EMAIL env over the built-in fallback', async () => {
    process.env.SUPPORT_EMAIL = 'help@example.com';
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    await expect(getSupportEmail(prismaMock)).resolves.toBe('help@example.com');
  });

  it('returns the stored email when valid', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('support.email', { email: 'sav@chaquefranc.com' }),
    );
    await expect(getSupportEmail(prismaMock)).resolves.toBe('sav@chaquefranc.com');
  });
});

describe('getAnnouncement', () => {
  it('returns null when there is no row', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null);
    await expect(getAnnouncement(prismaMock)).resolves.toBeNull();
  });

  it('returns null when the announcement is disabled', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('announcement', { message: 'Maintenance ce soir', tone: 'warn', enabled: false }),
    );
    await expect(getAnnouncement(prismaMock)).resolves.toBeNull();
  });

  it('returns null when enabled but the message is empty', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('announcement', { message: '   ', tone: 'info', enabled: true }),
    );
    await expect(getAnnouncement(prismaMock)).resolves.toBeNull();
  });

  it('returns message + tone when enabled and non-empty', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(
      row('announcement', { message: 'Nouvelle version dispo', tone: 'info', enabled: true }),
    );
    await expect(getAnnouncement(prismaMock)).resolves.toEqual({
      message: 'Nouvelle version dispo',
      tone: 'info',
    });
  });
});

describe('getAllSettings', () => {
  it('reports isDefault:true for every key when the table is empty', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([] as never);
    const all = await getAllSettings(prismaMock);
    for (const key of SETTING_KEYS) {
      expect(all[key].isDefault).toBe(true);
      expect(all[key].updatedAt).toBeNull();
      expect(all[key].updatedBy).toBeNull();
    }
    expect(all['subscription.pricing'].value).toEqual({
      monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
      annual: SUBSCRIPTION_PRICE_FCFA.annual,
    });
  });

  it('reports isDefault:false + provenance for a stored, valid row', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([
      row('subscription.pricing', { monthly: 2500, annual: 20000 }, 'super-9'),
    ] as never);
    const all = await getAllSettings(prismaMock);
    expect(all['subscription.pricing']).toEqual({
      value: { monthly: 2500, annual: 20000 },
      isDefault: false,
      updatedAt: '2026-09-01T00:00:00.000Z',
      updatedBy: 'super-9',
    });
    expect(all['support.email'].isDefault).toBe(true);
  });

  it('treats a malformed stored row as default (isDefault:true)', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([
      row('support.email', { email: 'not-an-email' }),
    ] as never);
    const all = await getAllSettings(prismaMock);
    expect(all['support.email'].isDefault).toBe(true);
    expect(all['support.email'].value).toEqual({ email: 'support@chaquefranc.com' });
  });
});

describe('writeSetting', () => {
  it('upserts the row with the actor id as updatedBy and returns the normalized value', async () => {
    prismaMock.appSetting.upsert.mockResolvedValue(row('subscription.pricing', {}) as never);
    const result = await writeSetting(
      prismaMock,
      'subscription.pricing',
      { monthly: 1800, annual: 16000 },
      'super-1',
    );
    expect(result).toEqual({ monthly: 1800, annual: 16000 });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'subscription.pricing' },
      create: {
        key: 'subscription.pricing',
        value: { monthly: 1800, annual: 16000 },
        updatedBy: 'super-1',
      },
      update: { value: { monthly: 1800, annual: 16000 }, updatedBy: 'super-1' },
    });
  });

  it('throws and does not write when the value is invalid for the key', async () => {
    await expect(
      writeSetting(prismaMock, 'subscription.pricing', { monthly: 1 }, 'super-1'),
    ).rejects.toThrow();
    expect(prismaMock.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('trims an announcement message before storing', async () => {
    prismaMock.appSetting.upsert.mockResolvedValue(row('announcement', {}) as never);
    const result = await writeSetting(
      prismaMock,
      'announcement',
      { message: '  Coupure ce soir  ', tone: 'warn', enabled: true },
      'super-1',
    );
    expect(result).toEqual({ message: 'Coupure ce soir', tone: 'warn', enabled: true });
  });
});

describe('SETTING_SCHEMAS', () => {
  it('rejects a pricing payload below the 100 FCFA floor', () => {
    expect(
      SETTING_SCHEMAS['subscription.pricing'].safeParse({ monthly: 5, annual: 13500 }).success,
    ).toBe(false);
  });

  it('rejects an announcement message over 280 chars', () => {
    expect(
      SETTING_SCHEMAS.announcement.safeParse({
        message: 'x'.repeat(281),
        tone: 'info',
        enabled: true,
      }).success,
    ).toBe(false);
  });

  it('accepts a well-formed announcement', () => {
    expect(
      SETTING_SCHEMAS.announcement.safeParse({ message: 'ok', tone: 'warn', enabled: true })
        .success,
    ).toBe(true);
  });
});
