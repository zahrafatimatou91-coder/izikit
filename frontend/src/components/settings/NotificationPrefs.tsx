'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { SwitchRow } from './primitives';

type ChannelPrefs = { email?: boolean; inApp?: boolean };
type Prefs = Record<string, ChannelPrefs>;

// Only "nags" the user might reasonably want to silence. GOAL_MILESTONE
// stays always-on — it celebrates the user's own win, it's not an
// interruption. Each type here has an isChannelEnabled() guard wired at
// its trigger site, so these switches are real, not decorative.
const TOGGLES = [
  {
    type: 'ENVELOPE_THRESHOLD',
    label: 'Alertes de dépassement',
    desc: 'Quand une enveloppe dépasse sa limite.',
  },
  {
    type: 'SAVINGS_GOAL_PACE_MISSED',
    label: 'Objectifs en retard',
    desc: 'Rappel quand tu épargnes moins que le rythme prévu pour un objectif.',
  },
  {
    type: 'INACTIVITY_NUDGE',
    label: "Rappels d'activité",
    desc: "Petit rappel les jours où tu n'as rien noté.",
  },
] as const;

/** Missing type / missing channel ⇒ enabled (matches the server's D-10 opt-out). */
function isEnabled(prefs: Prefs, type: string): boolean {
  return prefs[type]?.inApp !== false;
}

/** The 3 notification toggles, rendered as rows inside the "Préférences" card. */
export function NotificationPrefs() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    api<{ prefs: Prefs }>('/api/notifications/prefs')
      .then((res) => setPrefs(res.prefs ?? {}))
      .catch(() => {
        /* keep defaults — everything enabled */
      })
      .finally(() => setLoaded(true));
  }, []);

  async function toggle(type: string) {
    const next = !isEnabled(prefs, type);
    setPrefs((p) => ({ ...p, [type]: { ...p[type], inApp: next } }));
    setPending(type);
    try {
      await api('/api/notifications/prefs', {
        method: 'PATCH',
        body: { prefs: { [type]: { inApp: next } } },
      });
    } catch {
      setPrefs((p) => ({ ...p, [type]: { ...p[type], inApp: !next } }));
      toast('Erreur réseau. Réessaie.', 'error');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {TOGGLES.map((t) => (
        <SwitchRow
          key={t.type}
          label={t.label}
          description={t.desc}
          checked={isEnabled(prefs, t.type)}
          onChange={() => toggle(t.type)}
          disabled={!loaded || pending === t.type}
        />
      ))}
    </>
  );
}
