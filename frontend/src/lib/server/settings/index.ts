// frontend/src/lib/server/settings/index.ts
//
// Admin-editable runtime configuration. A key/value store (the `AppSetting`
// model) fronted by typed accessors, each with a compile-time default so a
// missing OR malformed row always degrades to the shipped constant rather
// than throwing. Written only by SUPERADMIN via PATCH /api/admin/settings,
// and every write also produces an AdminAction row (the route does that in
// the same transaction — `writeSetting` here only touches `AppSetting`).
//
// Known keys (see prisma/schema.prisma `AppSetting`):
//   "subscription.pricing" → { monthly, annual }        FCFA, integer
//   "support.email"        → { email }
//   "announcement"         → { message, tone, enabled }  app-wide banner
//
// No caching in v1 — reads are rare (both webhooks, /api/pricing, the
// /api/admin/* surface). Each accessor is one indexed PK lookup. A short
// unstable_cache / Redis layer is a documented follow-up if it shows up in
// traces.
import 'server-only';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { createLogger } from '@/lib/server/logger';
import { SUBSCRIPTION_PRICE_FCFA, SUBSCRIPTION_TRIAL_DAYS } from '@/lib/server/subscriptions/tier';

const log = createLogger();

/** Narrow client shape — the same functions work with a plain `prisma` or a
 * Prisma transaction client (both carry `.appSetting` with identical
 * delegate types), so a webhook can read pricing inside its Serializable
 * tx. Mirrors `subscriptions/archive.ts`'s `ArchiveTxClient`. */
export type SettingsClient = Pick<PrismaClient, 'appSetting'>;

export const SETTING_KEYS = ['subscription.pricing', 'support.email', 'announcement'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

// ────────────────────────────────────────────────────────────────────
// Per-key Zod schemas — the single source of truth for what a valid
// value looks like. The PATCH route `safeParse`s against these before
// calling `writeSetting`, and every accessor re-validates on read so a
// row hand-edited in the DB can't poison a live code path.
// ────────────────────────────────────────────────────────────────────

const pricingSchema = z.object({
  // FCFA has no sub-unit — integers only. Floor of 100 stops a fat-finger
  // "0" or "5"; the webhook enforces exact-equality against this value so a
  // wrong number here can never *accept* an underpayment, only misprice new
  // checkouts. Ceiling is a sanity bound, not a business rule.
  monthly: z.number().int().min(100).max(1_000_000),
  annual: z.number().int().min(100).max(10_000_000),
});

const supportEmailSchema = z.object({
  email: z.string().trim().email(),
});

const announcementSchema = z.object({
  message: z.string().trim().max(280),
  tone: z.enum(['info', 'warn']),
  enabled: z.boolean(),
});

export const SETTING_SCHEMAS = {
  'subscription.pricing': pricingSchema,
  'support.email': supportEmailSchema,
  announcement: announcementSchema,
} as const satisfies Record<SettingKey, z.ZodTypeAny>;

export type SubscriptionPricing = z.infer<typeof pricingSchema>;
export type SupportEmailSetting = z.infer<typeof supportEmailSchema>;
export type AnnouncementSetting = z.infer<typeof announcementSchema>;

// ────────────────────────────────────────────────────────────────────
// Defaults — pure functions so an env-derived default (support email) is
// read fresh, not frozen at module load.
// ────────────────────────────────────────────────────────────────────

const FALLBACK_SUPPORT_EMAIL = 'support@chaquefranc.com';

export const SETTING_DEFAULTS: {
  'subscription.pricing': () => SubscriptionPricing;
  'support.email': () => SupportEmailSetting;
  announcement: () => AnnouncementSetting;
} = {
  'subscription.pricing': () => ({
    monthly: SUBSCRIPTION_PRICE_FCFA.monthly,
    annual: SUBSCRIPTION_PRICE_FCFA.annual,
  }),
  'support.email': () => ({
    email: process.env.SUPPORT_EMAIL?.trim() || FALLBACK_SUPPORT_EMAIL,
  }),
  announcement: () => ({ message: '', tone: 'info', enabled: false }),
};

/** Trial length is surfaced (read-only) on the admin subscriptions screen —
 * editing it is low-value and touches signup, so it stays a constant. */
export const SUBSCRIPTION_TRIAL_DAYS_DISPLAY = SUBSCRIPTION_TRIAL_DAYS;

// ────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────

async function readRaw(
  client: SettingsClient,
  key: SettingKey,
): Promise<{ value: unknown; updatedAt: Date; updatedBy: string | null } | null> {
  try {
    const row = await client.appSetting.findUnique({ where: { key } });
    if (!row) return null;
    return { value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  } catch (err) {
    // The AppSetting table might not exist yet (migration not applied) or the
    // DB could be briefly unreachable. Every accessor has a safe compile-time
    // default, so degrade to it rather than 500-ing a page — or, worse,
    // failing a payment webhook's Serializable transaction.
    log.warn('settings: read failed, falling back to default', {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Parse a stored value against its key schema; on any failure fall back to
 * the key default. Never throws — a malformed row must not break a read. */
function coerce<K extends SettingKey>(key: K, raw: unknown): z.infer<(typeof SETTING_SCHEMAS)[K]> {
  const parsed = SETTING_SCHEMAS[key].safeParse(raw);
  if (parsed.success) return parsed.data as z.infer<(typeof SETTING_SCHEMAS)[K]>;
  return SETTING_DEFAULTS[key]() as z.infer<(typeof SETTING_SCHEMAS)[K]>;
}

// ────────────────────────────────────────────────────────────────────
// Public accessors
// ────────────────────────────────────────────────────────────────────

export async function getSubscriptionPricing(
  client: SettingsClient = prisma,
): Promise<SubscriptionPricing> {
  const row = await readRaw(client, 'subscription.pricing');
  return coerce('subscription.pricing', row?.value);
}

export async function getSupportEmail(client: SettingsClient = prisma): Promise<string> {
  const row = await readRaw(client, 'support.email');
  return coerce('support.email', row?.value).email;
}

/** The app-wide banner, or `null` when there's nothing to show (no row,
 * disabled, or an empty message). */
export async function getAnnouncement(
  client: SettingsClient = prisma,
): Promise<{ message: string; tone: 'info' | 'warn' } | null> {
  const row = await readRaw(client, 'announcement');
  const value = coerce('announcement', row?.value);
  if (!value.enabled || value.message.length === 0) return null;
  return { message: value.message, tone: value.tone };
}

export interface SettingEntry<K extends SettingKey = SettingKey> {
  value: z.infer<(typeof SETTING_SCHEMAS)[K]>;
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Every known setting with its current effective value + provenance —
 * backs GET /api/admin/settings so the admin form can edit even a disabled
 * announcement. */
export async function getAllSettings(
  client: SettingsClient = prisma,
): Promise<{ [K in SettingKey]: SettingEntry<K> }> {
  let rows: { key: string; value: unknown; updatedAt: Date; updatedBy: string | null }[] = [];
  try {
    rows = await client.appSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  } catch (err) {
    log.warn('settings: getAllSettings read failed, returning defaults', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const entry = <K extends SettingKey>(key: K): SettingEntry<K> => {
    const row = byKey.get(key);
    const stored = row ? SETTING_SCHEMAS[key].safeParse(row.value) : null;
    const usable = stored?.success === true;
    return {
      value: (usable ? stored.data : SETTING_DEFAULTS[key]()) as z.infer<
        (typeof SETTING_SCHEMAS)[K]
      >,
      isDefault: !usable,
      updatedAt: usable && row ? row.updatedAt.toISOString() : null,
      updatedBy: usable && row ? row.updatedBy : null,
    };
  };

  return {
    'subscription.pricing': entry('subscription.pricing'),
    'support.email': entry('support.email'),
    announcement: entry('announcement'),
  };
}

/** Validate `value` against `key`'s schema and upsert the row. Throws
 * `ZodError` on a bad value — the PATCH route `safeParse`s first for a clean
 * 400, so by the time this runs the re-parse is a cheap guarantee, not the
 * primary check. Pass a transaction client so the write commits atomically
 * with the route's `logAdminAction` call. Returns the normalized value. */
export async function writeSetting<K extends SettingKey>(
  client: SettingsClient,
  key: K,
  value: unknown,
  actorId: string,
): Promise<z.infer<(typeof SETTING_SCHEMAS)[K]>> {
  const parsed = SETTING_SCHEMAS[key].parse(value) as z.infer<(typeof SETTING_SCHEMAS)[K]>;
  await client.appSetting.upsert({
    where: { key },
    create: { key, value: parsed as object, updatedBy: actorId },
    update: { value: parsed as object, updatedBy: actorId },
  });
  return parsed;
}
