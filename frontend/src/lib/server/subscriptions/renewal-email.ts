// frontend/src/lib/server/subscriptions/renewal-email.ts
//
// Email template for the subscription-renewal-reminders cron. Mirrors the
// {subject, html, text} + htmlEscape() pattern in
// lib/server/auth/email-templates.ts (kept as a separate file — this is the
// subscriptions domain, not auth).
import 'server-only';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface RenewalReminderEmailArgs {
  /** 1-7 in practice (gated by RENEWAL_BANNER_URGENT_DAYS upstream). */
  daysLeft: number;
  /** ISO-8601 — the subscription's current `currentPeriodEnd`. */
  periodEnd: string;
  /** FCFA, the amount that will be charged on renewal. */
  amount: number;
  period: 'monthly' | 'annual';
  /** Defaults to `process.env.APP_URL ?? 'http://localhost:3000'` — same
   * fallback convention as oauth/error-redirect.ts. */
  appUrl?: string;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'bientôt';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function renewalReminderEmail(args: RenewalReminderEmailArgs): EmailTemplate {
  const dateLabel = htmlEscape(formatDate(args.periodEnd));
  const amountLabel = htmlEscape(formatFcfa(args.amount));
  const daysLabel = args.daysLeft <= 1 ? 'demain' : `dans ${args.daysLeft} jours`;
  const periodLabel = args.period === 'annual' ? 'annuel' : 'mensuel';
  const appUrl = args.appUrl ?? process.env.APP_URL ?? 'http://localhost:3000';
  const renewUrl = `${appUrl}/subscription`;

  const subject =
    args.daysLeft <= 1
      ? 'Ton abonnement Premium expire demain'
      : `Ton abonnement Premium expire dans ${args.daysLeft} jours`;

  return {
    subject,
    html: `<p>Bonjour,</p>
<p>Ton abonnement Premium (${periodLabel}) arrive à échéance <strong>${daysLabel}</strong>, le ${dateLabel}.</p>
<p>Comme le paiement se fait par Mobile Money, il n'y a pas de prélèvement automatique — pour garder l'accès à tes enveloppes illimitées, tes objectifs d'épargne et tes tendances, il faut renouveler manuellement (${amountLabel}).</p>
<p><a href="${renewUrl}">Renouveler mon abonnement</a></p>
<p>Si tu ne renouvelles pas, ton compte repasse automatiquement en Free à l'échéance — tes données restent en sécurité, seules les fonctionnalités Premium se désactivent.</p>`,
    text: `Ton abonnement Premium (${periodLabel}) arrive à échéance ${daysLabel}, le ${formatDate(args.periodEnd)}. Comme le paiement se fait par Mobile Money, il n'y a pas de prélèvement automatique — renouvelle manuellement (${formatFcfa(args.amount)}) sur ${renewUrl} pour garder ton accès Premium. Sans renouvellement, ton compte repasse en Free à l'échéance.`,
  };
}
