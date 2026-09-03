/**
 * POST /api/webhooks/bictorys — Bictorys payment webhook adapter.
 *
 * Thin shim over the battle-tested factory at `lib/server/webhook/handler.ts`
 * (PROTECTED — never modified). The factory does ALL the hard work: raw-body
 * read via arrayBuffer, HMAC verify, Serializable transaction, WebhookLog
 * upsert + dedup, dispatch, processedAt write-back. This file only wires:
 *   - the Bictorys-specific WebhookProvider (HMAC + payload parser)
 *   - per-event handlers that update Order rows + emit outbox events
 *
 * CLAUDE.md invariants honored here:
 *   - runtime = 'nodejs' is exported below (Buffer/crypto + Prisma — the
 *     runtime-enforcement test fails CI otherwise).
 *   - dynamic = 'force-dynamic' is exported below (prevents accidental POST
 *     caching by Next.js).
 *   - This file NEVER reads the request body. The factory itself reads the
 *     raw bytes for byte-identical HMAC verification — reading the body here
 *     would be a silent HMAC regression.
 *   - Side-effects use enqueueOutbox(tx, ...) INSIDE the same Serializable tx
 *     the factory opens — never via after-commit closures (D-04 outbox-not-
 *     closures invariant).
 *
 * Phase 5 / Plan 05-02. WH-01 + WH-02.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import 'server-only';
import { createWebhookHandler } from '@/lib/server/webhook/handler';
import { bictorysWebhookProvider } from '@/lib/server/webhook/bictorys';
import { enqueueOutbox } from '@/lib/server/outbox';
import { prisma } from '@/lib/server/prisma';
import {
  parseSubscriptionOrderMetadata,
  SUBSCRIPTION_PERIOD_DAYS,
} from '@/lib/server/subscriptions/tier';
import { getSubscriptionPricing } from '@/lib/server/settings';
import { reactivateArchivedForProUpgrade } from '@/lib/server/subscriptions/archive';

export const POST = createWebhookHandler({
  prisma,
  provider: bictorysWebhookProvider,

  async onPaid(payload, tx) {
    const externalRef = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
    if (!externalRef) return {}; // no id to correlate

    const order = await tx.order.findFirst({
      where: { providerChargeId: externalRef },
    });
    if (!order) return {}; // unknown charge — log + drop (no DB row to update)

    const paymentMethod = payload.payment_method ? String(payload.payment_method) : null;

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        ...(paymentMethod !== null ? { paymentMethod } : {}),
      },
    });

    // Subscription purchase — activate/extend Pro and reactivate any
    // envelopes/savings-goals archived by a prior Free downgrade. Runs
    // inside the same Serializable tx as the Order status flip so a crash
    // between the two is impossible (both commit together or neither does).
    const subMeta = parseSubscriptionOrderMetadata(order.metadata);
    if (subMeta && order.userId) {
      // Dynamic pricing — the admin-set price (AppSetting "subscription.pricing")
      // wins over the SUBSCRIPTION_PRICE_FCFA constant, read here inside the
      // Serializable tx (one indexed PK lookup, negligible contention).
      // Exact-equality check unchanged: if the admin changes the price
      // between checkout-start and this webhook, the paid amount won't match
      // and Pro isn't granted (the user retries). A `>=` check would re-open
      // the low-amount exploit this check exists to close.
      const pricing = await getSubscriptionPricing(tx);
      if (order.amount === pricing[subMeta.period]) {
        const existingSub = await tx.subscription.findUnique({ where: { userId: order.userId } });
        const now = new Date();
        const base =
          existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd.getTime() > now.getTime()
            ? existingSub.currentPeriodEnd
            : now;
        const periodMs = SUBSCRIPTION_PERIOD_DAYS[subMeta.period] * 24 * 60 * 60 * 1000;
        const currentPeriodEnd = new Date(base.getTime() + periodMs);

        await tx.subscription.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            plan: 'PRO',
            status: 'ACTIVE',
            currentPeriodEnd,
            lastOrderId: order.id,
          },
          update: {
            plan: 'PRO',
            status: 'ACTIVE',
            currentPeriodEnd,
            lastOrderId: order.id,
          },
        });

        await reactivateArchivedForProUpgrade(tx, order.userId);
      }
    }

    // Outbox emits stay inside the factory's Serializable tx so the rows
    // commit atomically with the status change. The drain cron picks them up
    // out-of-band.
    if (order.userId) {
      await enqueueOutbox(tx, {
        kind: 'notification.payment_received',
        payload: {
          userId: order.userId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    }
    if (order.customerEmail) {
      await enqueueOutbox(tx, {
        kind: 'email.payment_confirmation',
        payload: {
          to: order.customerEmail,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    }

    return {};
  },

  async onRefunded(payload, tx) {
    const externalRef = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
    if (!externalRef) return {};
    const order = await tx.order.findFirst({
      where: { providerChargeId: externalRef },
    });
    if (!order) return {};
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
    });
    // No outbox emit in v1 — `notification.refund_received` kind is not
    // declared in outbox/types.ts (RESEARCH §"Pattern 1" + A6). Adding it
    // would touch the PROTECTED dispatcher; deferred to a follow-up phase.
    return {};
  },

  async onFailed(payload, tx) {
    const externalRef = String(payload.charge_id ?? payload.chargeId ?? payload.id ?? '');
    if (!externalRef) return {};
    const order = await tx.order.findFirst({
      where: { providerChargeId: externalRef },
    });
    if (!order) return {};
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'FAILED' },
    });
    return {};
  },
});
