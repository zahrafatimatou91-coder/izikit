// SettingsDesktop.jsx → /settings, rebuilt inside the standard nav shell
// (the page previously had no sidebar/bottom-nav — a real inconsistency
// with every other authenticated page, fixed here).
//
// Deviations from Banani's source (see .planning/banani/notifications-settings.md
// for the full per-section reasoning table):
// - Téléphone dropped — no `phone` field exists anywhere in the schema.
// - Email shown read-only — no re-verification flow exists for email changes;
//   a live "Modifier" button here would be the same broken-affordance class
//   as Phase 4's inert checkboxes.
// - Devise/Langue shown as plain info rows (no fake dropdown chevron) —
//   true facts, but no multi-currency/i18n system exists to select from.
// - "Répartition automatique" and "Sessions actives" dropped — no backend
//   feature exists for either.
// - "Modifié il y a 3 mois" dropped — no passwordChangedAt is tracked.
// - "Supprimer le compte" is real, not decorative — see DELETE /api/account.
'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth, useUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Icon } from '@/components/ui/Icon';
import { BottomNav } from '@/components/nav/BottomNav';
import { DesktopSidebarNav } from '@/components/nav/DesktopSidebarNav';
import { ListPageSkeleton } from '@/components/skeletons/ListPageSkeleton';
import { formatPrice } from '@/lib/utils';

const ENVELOPE_THRESHOLD_PREF = 'ENVELOPE_THRESHOLD';

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 font-headings text-lg font-bold text-foreground">{title}</h3>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-foreground">{label}</p>
        <p className="truncate font-body text-xs text-muted-foreground">{value}</p>
      </div>
      {action}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const user = useUser();
  const router = useRouter();
  const { refresh, logout, loggingOut } = useAuth();
  const { toast } = useToast();

  // Nom complet
  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSubmitting, setNameSubmitting] = useState(false);

  // Notification preference
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsSubmitting, setPrefsSubmitting] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Delete account
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setNameValue(user.name ?? '');
    api<{ prefs: Record<string, { email?: boolean; inApp?: boolean }> }>('/api/notifications/prefs')
      .then((res) => {
        const pref = res.prefs[ENVELOPE_THRESHOLD_PREF];
        setAlertsEnabled(pref?.inApp !== false);
        setPrefsLoaded(true);
      })
      .catch(() => setPrefsLoaded(true));
  }, [user]);

  if (!user) return <ListPageSkeleton rows={6} />;

  const hasPassword = user.hasPassword;
  const googleLinked = user.linkedProviders.includes('google');
  const displayName = user.name ?? user.email.split('@')[0] ?? user.email;

  async function saveName() {
    if (nameValue.trim().length === 0) return;
    setNameSubmitting(true);
    try {
      await api('/api/auth/me', { method: 'PATCH', body: { name: nameValue.trim() } });
      await refresh();
      toast('Nom mis à jour.', 'success');
      setNameEditing(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setNameSubmitting(false);
    }
  }

  async function toggleAlerts() {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    setPrefsSubmitting(true);
    try {
      await api('/api/notifications/prefs', {
        method: 'PATCH',
        body: { prefs: { [ENVELOPE_THRESHOLD_PREF]: { inApp: next } } },
      });
    } catch {
      setAlertsEnabled(!next);
      toast('Erreur réseau. Réessaie.', 'error');
    } finally {
      setPrefsSubmitting(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);

    if (newPassword.length === 0) {
      setPwError('Saisis un nouveau mot de passe.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setPwSubmitting(true);
    try {
      if (hasPassword) {
        await api('/api/auth/change-password', {
          method: 'PUT',
          body: { currentPassword, newPassword },
        });
        toast('Mot de passe mis à jour.', 'success');
      } else {
        await api('/api/auth/set-password', { method: 'POST', body: { newPassword } });
        toast('Mot de passe défini. Tu peux maintenant te connecter par email.', 'success');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          INVALID_CREDENTIALS: 'Mot de passe actuel incorrect.',
          PASSWORD_BANNED: 'Ce mot de passe est trop courant.',
          PASSWORD_TOO_SHORT: err.message || 'Mot de passe trop court.',
          PASSWORD_PWNED: 'Ce mot de passe a fuité — choisis-en un autre.',
          PASSWORD_ALREADY_SET:
            'Un mot de passe est déjà défini. Utilise « changer le mot de passe ».',
          VALIDATION_FAILED: 'Champs invalides.',
        };
        setPwError(map[err.code] ?? err.message);
      } else {
        setPwError('Erreur réseau. Réessaie.');
      }
    } finally {
      setPwSubmitting(false);
    }
  }

  async function onDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await api('/api/account', {
        method: 'DELETE',
        body: hasPassword ? { password: deletePassword } : { confirmEmail: deleteEmailConfirm },
      });
      await refresh();
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        const map: Record<string, string> = {
          INVALID_CREDENTIALS: 'Mot de passe incorrect.',
          CONFIRMATION_MISMATCH: 'L’email ne correspond pas.',
        };
        setDeleteError(map[err.code] ?? err.message);
      } else {
        setDeleteError('Erreur réseau. Réessaie.');
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function onLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen bg-background font-body">
      <DesktopSidebarNav
        active="settings"
        userName={displayName}
        userEmail={user.email}
        avatarUrl={user.avatarUrl}
      />

      <div className="flex flex-1 flex-col pb-24 lg:pb-0">
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-5 lg:px-8 lg:py-6">
          <h2 className="font-headings text-lg font-bold text-foreground lg:text-xl">Paramètres</h2>
        </div>

        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-8">
            {/* Apparence */}
            <SectionCard title="Apparence">
              <div className="flex flex-col gap-3 px-5 py-4 lg:px-6">
                <p className="font-body text-xs text-muted-foreground">
                  « Système » suit le réglage clair/sombre de ton appareil.
                </p>
                <ThemeToggle />
              </div>
            </SectionCard>

            {/* Compte */}
            <SectionCard title="Compte">
              <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-foreground">Nom complet</p>
                  {nameEditing ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        className="w-full max-w-[220px] rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={saveName}
                        disabled={nameSubmitting}
                        className="font-body text-xs font-medium text-primary disabled:opacity-50"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <p className="truncate font-body text-xs text-muted-foreground">
                      {user.name ?? 'Non défini'}
                    </p>
                  )}
                </div>
                {!nameEditing && (
                  <button
                    type="button"
                    onClick={() => setNameEditing(true)}
                    className="font-body text-sm font-medium text-primary"
                  >
                    Modifier
                  </button>
                )}
              </div>
              <Row label="Email" value={user.email} />
            </SectionCard>

            {/* Préférences */}
            <SectionCard title="Préférences">
              <Row label="Devise" value="Franc CFA (FCFA)" />
              <Row label="Langue" value="Français" />
              <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium text-foreground">
                    Alertes de dépassement
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    Notifie quand une enveloppe dépasse 80% de sa limite.
                  </p>
                </div>
                <Toggle
                  checked={alertsEnabled}
                  onChange={toggleAlerts}
                  disabled={!prefsLoaded || prefsSubmitting}
                />
              </div>
            </SectionCard>

            {/* Budget */}
            <SectionCard title="Budget">
              <Row
                label="Budget"
                value={
                  user.totalBudget != null
                    ? `${formatPrice(user.totalBudget)} FCFA / ${
                        user.budgetFrequency === 'weekly'
                          ? 'semaine'
                          : user.budgetFrequency === 'daily'
                            ? 'jour'
                            : 'mois'
                      }`
                    : 'Non défini'
                }
                action={
                  <button
                    type="button"
                    onClick={() => router.push('/onboarding')}
                    className="font-body text-sm font-medium text-primary"
                  >
                    Modifier
                  </button>
                }
              />
            </SectionCard>

            {/* Sécurité */}
            <SectionCard title="Sécurité">
              <div className="px-5 py-4 lg:px-6">
                <p className="mb-3 font-body text-sm font-medium text-foreground">
                  {hasPassword ? 'Changer le mot de passe' : 'Définir un mot de passe'}
                </p>
                <form onSubmit={onSubmitPassword} className="flex flex-col gap-3">
                  {hasPassword && (
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="Mot de passe actuel"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="rounded-md border border-border bg-input px-3 py-2 font-body text-sm text-foreground"
                    />
                  )}
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-md border border-border bg-input px-3 py-2 font-body text-sm text-foreground"
                  />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Confirmer le nouveau mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-md border border-border bg-input px-3 py-2 font-body text-sm text-foreground"
                  />
                  {pwError && (
                    <p role="alert" className="font-body text-sm text-accent">
                      {pwError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={pwSubmitting}
                    className="self-start rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {pwSubmitting
                      ? 'Enregistrement…'
                      : hasPassword
                        ? 'Changer le mot de passe'
                        : 'Définir le mot de passe'}
                  </button>
                </form>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium text-foreground">Google</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {googleLinked
                      ? 'Tu peux te connecter via Google.'
                      : 'Lie ton compte Google pour te connecter en un clic.'}
                  </p>
                </div>
                {googleLinked ? (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-body text-xs font-medium text-primary">
                    Lié
                  </span>
                ) : (
                  <a
                    href="/api/auth/oauth/google/start?next=/settings"
                    className="rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Lier Google
                  </a>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Session">
              <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
                <div>
                  <p className="font-body text-sm font-medium text-foreground">Se déconnecter</p>
                  <p className="font-body text-xs text-muted-foreground">
                    Termine ta session sur cet appareil.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={loggingOut}
                  className="flex-shrink-0 rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
                </button>
              </div>
            </SectionCard>

            {/* Zone dangereuse */}
            <SectionCard title="Zone dangereuse">
              <div className="p-6">
                {!deleteConfirming ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">
                        Supprimer le compte
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        Cette action ne peut pas être annulée.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirming(true)}
                      className="flex-shrink-0 rounded-lg border border-accent px-4 py-2 font-body text-sm font-bold text-accent"
                    >
                      Supprimer le compte
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onDeleteAccount} className="flex flex-col gap-3">
                    <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3">
                      <Icon
                        i="alert-triangle"
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-accent"
                      />
                      <p className="font-body text-xs text-foreground">
                        Toutes tes données (enveloppes, transactions, objectifs, notifications)
                        seront supprimées définitivement.
                      </p>
                    </div>
                    {hasPassword ? (
                      <input
                        type="password"
                        required
                        placeholder="Confirme avec ton mot de passe"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="rounded-md border border-border bg-input px-3 py-2 font-body text-sm text-foreground"
                      />
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder={`Tape ton email (${user.email}) pour confirmer`}
                        value={deleteEmailConfirm}
                        onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                        className="rounded-md border border-border bg-input px-3 py-2 font-body text-sm text-foreground"
                      />
                    )}
                    {deleteError && (
                      <p role="alert" className="font-body text-sm text-accent">
                        {deleteError}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirming(false);
                          setDeleteError(null);
                          setDeletePassword('');
                          setDeleteEmailConfirm('');
                        }}
                        className="flex-1 rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={deleteSubmitting}
                        className="flex-1 rounded-lg bg-accent px-4 py-2 font-body text-sm font-bold text-accent-foreground disabled:opacity-50"
                      >
                        {deleteSubmitting ? 'Suppression…' : 'Confirmer la suppression'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
