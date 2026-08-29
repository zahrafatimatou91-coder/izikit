// Pure hour->slot mapping for the inactivity-nudges cron — kept separate
// from the route so it's unit-testable without mocking Prisma/Redis.
// vercel.json schedules this cron's route at two UTC times (13:00 and
// 20:00); this bucket-by-hour (rather than an exact-minute match) stays
// correct even if Vercel fires a few minutes late.
import 'server-only';
import type { InactivitySlot } from '@/lib/server/notifications/templates';

const EVENING_HOUR_THRESHOLD = 17; // midpoint between the two scheduled fire times

export function resolveInactivitySlot(now: Date = new Date()): InactivitySlot {
  return now.getUTCHours() < EVENING_HOUR_THRESHOLD ? 'midday' : 'evening';
}
