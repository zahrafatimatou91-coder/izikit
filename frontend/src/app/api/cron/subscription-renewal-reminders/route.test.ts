import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/subscriptions/renewal-reminder', () => ({
  sendUpcomingRenewalReminders: vi.fn().mockResolvedValue({ checked: 5, reminded: 2 }),
}));
vi.mock('@/lib/server/subscriptions/trial-reminder', () => ({
  sendTrialEndingReminders: vi.fn().mockResolvedValue({ checked: 3, reminded: 1 }),
}));
vi.mock('@/lib/server/queues/email-queue-singleton', () => ({
  getEmailQueue: vi.fn().mockReturnValue(null),
}));

import { POST } from './route';
import { sendUpcomingRenewalReminders } from '@/lib/server/subscriptions/renewal-reminder';
import { sendTrialEndingReminders } from '@/lib/server/subscriptions/trial-reminder';

function makeReq(authHeader?: string): NextRequest {
  return new NextRequest('http://test/api/cron/subscription-renewal-reminders', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
});

describe('POST /api/cron/subscription-renewal-reminders', () => {
  it('rejects without a valid CRON_SECRET bearer token', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(sendUpcomingRenewalReminders).not.toHaveBeenCalled();
    expect(sendTrialEndingReminders).not.toHaveBeenCalled();
  });

  it('sends both renewal and trial-ending reminders and reports combined + per-kind counts', async () => {
    const res = await POST(makeReq('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      checked: 8,
      reminded: 3,
      renewal: { checked: 5, reminded: 2 },
      trial: { checked: 3, reminded: 1 },
    });
    expect(sendUpcomingRenewalReminders).toHaveBeenCalledTimes(1);
    expect(sendTrialEndingReminders).toHaveBeenCalledTimes(1);
  });

  it("exports runtime='nodejs' and dynamic='force-dynamic'", async () => {
    const mod = (await import('./route')) as { runtime?: string; dynamic?: string };
    expect(mod.runtime).toBe('nodejs');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
