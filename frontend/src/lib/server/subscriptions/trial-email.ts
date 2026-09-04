// frontend/src/lib/server/subscriptions/trial-email.ts
//
// Email template for the trial-ending reminder (see trial-reminder.ts).
// Mirrors the {subject, html, text} + htmlEscape() pattern in
// renewal-email.ts (the paid-subscription sibling of this reminder).
import 'server-only';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface TrialEndingEmailArgs {
  /** 1-3 in practice (gated by TRIAL_BANNER_URGENT_DAYS upstream). */
  daysLeft: number;
  /** ISO-8601 — the trial's currentPeriodEnd. */
  periodEnd: string;
  /** Personalization per the spec ("Rappel de fin d'essai" — a concrete,
   * chiffré loss converts better than a vague one) — how many active
   * envelopes/goals this user would lose access to. */
  envelopeCount: number;
  savingsGoalCount: number;
  /** Defaults to `process.env.APP_URL ?? 'http://localhost:3000'` — same
   * fallback convention as renewal-email.ts / oauth/error-redirect.ts. */
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'bientôt';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "4 enveloppes et 2 objectifs d'épargne" — falls back to a generic phrase
 * when the trial user hasn't set anything up yet, rather than printing
 * "Tu as  actifs" with nothing to point at. */
function describeUsage(envelopeCount: number, savingsGoalCount: number): string {
  const parts: string[] = [];
  if (envelopeCount > 0) {
    parts.push(`${envelopeCount} enveloppe${envelopeCount > 1 ? 's' : ''}`);
  }
  if (savingsGoalCount > 0) {
    parts.push(`${savingsGoalCount} objectif${savingsGoalCount > 1 ? 's' : ''} d'épargne`);
  }
  return parts.length > 0 ? parts.join(' et ') : 'tes fonctionnalités Pro';
}

export function trialEndingEmail(args: TrialEndingEmailArgs): EmailTemplate {
  const dateLabel = htmlEscape(formatDate(args.periodEnd));
  const daysLabel = args.daysLeft <= 1 ? 'demain' : `dans ${args.daysLeft} jours`;
  const appUrl = args.appUrl ?? process.env.APP_URL ?? 'http://localhost:3000';
  const upgradeUrl = `${appUrl}/subscription`;
  const usage = htmlEscape(describeUsage(args.envelopeCount, args.savingsGoalCount));

  const subject =
    args.daysLeft <= 1
      ? 'Ton essai Pro se termine demain'
      : `Ton essai Pro se termine dans ${args.daysLeft} jours`;

  // "Continuer à en profiter", never "garder tes données" — nothing is
  // deleted on downgrade (surplus is archived, not destroyed), so the
  // honest framing is a loss of ACCESS, not a loss of data. Non-negotiable
  // per the spec. Phrased with the invariable pronoun "en" (not a trailing
  // adjective like "actifs/actives") so it stays grammatically correct
  // regardless of how many envelopes vs. goals get named — "enveloppes"
  // is feminine, "objectifs" is masculine, and the fallback phrase
  // ("tes fonctionnalités Pro") is feminine too.
  return {
    subject,
    html: `<p>Bonjour,</p>
<p>Ton essai Pro gratuit se termine <strong>${daysLabel}</strong>, le ${dateLabel}.</p>
<p>Tu profites actuellement de ${usage} : passe à Pro pour continuer à en profiter.</p>
<p><a href="${upgradeUrl}">Passer à Pro</a></p>
<p>Sans abonnement, ton compte repasse automatiquement en Free à l'échéance. Tes données restent en sécurité, seul l'accès aux fonctionnalités Pro se désactive.</p>`,
    text: `Ton essai Pro gratuit se termine ${daysLabel}, le ${formatDate(args.periodEnd)}. Tu profites actuellement de ${describeUsage(args.envelopeCount, args.savingsGoalCount)} : passe à Pro sur ${upgradeUrl} pour continuer à en profiter. Sans abonnement, ton compte repasse en Free à l'échéance.`,
  };
}
