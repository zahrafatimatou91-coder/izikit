'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useRipple } from '@/hooks/useRipple';

interface GoogleAccountRowProps {
  linked: boolean;
  /** true when a password or another provider remains — required to unlink. */
  canUnlink: boolean;
  onChanged: () => Promise<void>;
}

/** "Sécurité" row: link Google, or unlink it (blocked when it's the only way in). */
export function GoogleAccountRow({ linked, canUnlink, onChanged }: GoogleAccountRowProps) {
  const { toast } = useToast();
  const ripple = useRipple();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  async function unlink() {
    setUnlinking(true);
    try {
      await api('/api/auth/oauth/google', { method: 'DELETE' });
      await onChanged();
      toast('Compte Google délié.', 'success');
      setConfirmOpen(false);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'LAST_LOGIN_METHOD'
          ? 'Définis un mot de passe avant de délier Google.'
          : err instanceof ApiError
            ? err.message
            : 'Erreur réseau. Réessaie.';
      toast(msg, 'error');
      setConfirmOpen(false);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-foreground">Google</p>
        <p className="font-body text-xs text-muted-foreground">
          {!linked
            ? 'Lie ton compte Google pour te connecter en un clic.'
            : canUnlink
              ? 'Tu peux te connecter via Google.'
              : 'Définis un mot de passe ci-dessus pour pouvoir délier Google.'}
        </p>
      </div>
      {!linked ? (
        <a
          href="/api/auth/oauth/google/start?next=/settings"
          onPointerDown={ripple}
          className="relative flex-shrink-0 overflow-hidden rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted"
        >
          Lier Google
        </a>
      ) : canUnlink ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          onPointerDown={ripple}
          className="relative flex-shrink-0 overflow-hidden rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted"
        >
          Délier
        </button>
      ) : (
        <span className="flex-shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-body text-xs font-medium text-primary">
          Lié
        </span>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Délier ton compte Google ?"
        description="Tu ne pourras plus te connecter en un clic via Google. Ton mot de passe (ou une autre méthode) reste actif."
        confirmLabel={unlinking ? 'Déliaison…' : 'Délier'}
        destructive
        confirming={unlinking}
        onConfirm={unlink}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
