'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/contexts/ToastContext';
import { useAdmin } from '@/components/admin/AdminContext';
import { AdminPageHeader, InlineError, SectionCard } from '@/components/admin/primitives';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

interface SettingsResponse {
  settings: {
    'support.email': { value: { email: string }; isDefault: boolean; updatedBy: string | null };
    announcement: {
      value: { message: string; tone: 'info' | 'warn'; enabled: boolean };
      isDefault: boolean;
    };
  };
  integrations: Record<string, boolean>;
}

const INTEGRATION_LABELS: Record<string, string> = {
  redis: 'Redis (Upstash)',
  resend: 'Emails (Resend)',
  bictorys: 'Bictorys (paiements UEMOA)',
  moneroo: 'Moneroo (paiements CEMAC)',
  googleOAuth: 'Google OAuth',
  cloudinary: 'Cloudinary (médias)',
  sentry: 'Sentry (observabilité)',
};

export default function AdminConfigPage() {
  const { isSuperadmin } = useAdmin();
  const { toast } = useToast();

  const [data, setData] = useState<SettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [annMsg, setAnnMsg] = useState('');
  const [annTone, setAnnTone] = useState<'info' | 'warn'>('info');
  const [annEnabled, setAnnEnabled] = useState(false);
  const [savingAnn, setSavingAnn] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<SettingsResponse>('/api/admin/settings');
      setData(res);
      setEmail(res.settings['support.email'].value.email);
      setAnnMsg(res.settings.announcement.value.message);
      setAnnTone(res.settings.announcement.value.tone);
      setAnnEnabled(res.settings.announcement.value.enabled);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSetting(key: string, value: unknown, done: () => void, label: string) {
    try {
      await api('/api/admin/settings', { method: 'PATCH', body: { key, value } });
      toast(`${label} enregistré.`, 'success');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Enregistrement impossible.', 'error');
    } finally {
      done();
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div>
      <AdminPageHeader title="Configuration" />

      {error && <InlineError message={error} onRetry={load} />}

      <div className="flex flex-col gap-6">
        {/* Général */}
        <SectionCard title="Général" description="Paramètres généraux de l'application">
          <div className="flex flex-col gap-5 px-5 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-bold text-foreground">Email de support</span>
              <span className="font-body text-xs text-muted-foreground">
                Affiché aux utilisateurs et utilisé comme adresse de réponse.
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isSuperadmin}
                  className="min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 py-2 font-body text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                />
                {isSuperadmin && (
                  <button
                    type="button"
                    disabled={
                      savingEmail ||
                      !emailValid ||
                      email.trim() === data?.settings['support.email'].value.email
                    }
                    onClick={() => {
                      setSavingEmail(true);
                      void saveSetting(
                        'support.email',
                        { email: email.trim() },
                        () => setSavingEmail(false),
                        'Email de support',
                      );
                    }}
                    className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-bold text-primary-foreground disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                )}
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4 border-t border-input pt-4">
              <div>
                <p className="font-body text-xs text-muted-foreground">Devise</p>
                <p className="font-body text-sm font-medium text-foreground">FCFA (XOF / XAF)</p>
              </div>
              <div>
                <p className="font-body text-xs text-muted-foreground">Fuseau horaire</p>
                <p className="font-body text-sm font-medium text-foreground">UTC</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Bannière d'annonce */}
        <SectionCard
          title="Bannière d'annonce"
          description="Affichée en haut de l'app pour tous les utilisateurs connectés"
        >
          <div className="flex flex-col gap-4 px-5 py-5">
            <textarea
              value={annMsg}
              onChange={(e) => setAnnMsg(e.target.value.slice(0, 280))}
              disabled={!isSuperadmin}
              rows={2}
              placeholder="Ex : Maintenance prévue dimanche de 2h à 4h."
              className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 font-body text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-muted-foreground">Ton</span>
                {(['info', 'warn'] as const).map((tn) => (
                  <button
                    key={tn}
                    type="button"
                    onClick={() => setAnnTone(tn)}
                    disabled={!isSuperadmin}
                    className={`rounded-full px-3 py-1 font-body text-xs font-bold disabled:opacity-60 ${
                      annTone === tn
                        ? tn === 'warn'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-primary/10 text-primary'
                        : 'border border-border text-muted-foreground'
                    }`}
                  >
                    {tn === 'info' ? 'Info' : 'Alerte'}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={annEnabled}
                  onChange={(e) => setAnnEnabled(e.target.checked)}
                  disabled={!isSuperadmin}
                  className="h-4 w-4 accent-primary"
                />
                <span className="font-body text-sm text-foreground">Activer</span>
              </label>
              {isSuperadmin && (
                <button
                  type="button"
                  disabled={savingAnn}
                  onClick={() => {
                    setSavingAnn(true);
                    void saveSetting(
                      'announcement',
                      { message: annMsg.trim(), tone: annTone, enabled: annEnabled },
                      () => setSavingAnn(false),
                      "Bannière d'annonce",
                    );
                  }}
                  className="ml-auto rounded-lg bg-primary px-4 py-2 font-body text-sm font-bold text-primary-foreground disabled:opacity-40"
                >
                  Enregistrer
                </button>
              )}
            </div>
            {annEnabled && annMsg.trim() && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 font-body text-sm ${
                  annTone === 'warn'
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-primary/30 bg-primary/10 text-primary'
                }`}
              >
                <Icon i="megaphone" size={15} className="mt-0.5 flex-shrink-0" />
                <span>{annMsg.trim()}</span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Intégrations */}
        <SectionCard
          title="État des intégrations"
          description="Présence des clés sur ce déploiement — aucune valeur n'est affichée"
        >
          <div className="grid grid-cols-1 gap-px bg-input sm:grid-cols-2">
            {data
              ? Object.entries(data.integrations).map(([key, ok]) => (
                  <div key={key} className="flex items-center justify-between bg-card px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Icon i="plug" size={14} className="text-muted-foreground" />
                      <span className="font-body text-sm text-foreground">
                        {INTEGRATION_LABELS[key] ?? key}
                      </span>
                    </div>
                    <span
                      className={`font-body text-xs font-bold ${ok ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {ok ? 'Configuré' : 'Non configuré'}
                    </span>
                  </div>
                ))
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-11 animate-pulse bg-card" />
                ))}
          </div>
        </SectionCard>

        {/* Journal d'audit */}
        <SectionCard
          title="Journal d'audit"
          description="Toutes les actions d'administration, les plus récentes d'abord"
        >
          <AuditLogViewer />
        </SectionCard>
      </div>
    </div>
  );
}
