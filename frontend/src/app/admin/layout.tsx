// Wraps every /admin/* route. Gate: GET /api/admin/me returns 200 with the
// admin object + capability list, or 401/403 for everyone else — non-admins
// are bounced to the app home. A skeleton renders during the round trip.
//
// The server re-checks the role on every /api/admin/* call, so this is a UX
// gate, not the security boundary.
'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { AdminContext, type AdminMe } from '@/components/admin/AdminContext';
import { AdminShell } from '@/components/admin/AdminShell';

interface MeResponse {
  admin: AdminMe;
  can: string[];
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [denied, setDenied] = useState(false);
  // A transient failure (DB waking up, network blip) is NOT "not an admin" —
  // 500 / 0 land here and offer a retry instead of ejecting to the home page.
  const [transientError, setTransientError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setTransientError(false);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<MeResponse>('/api/admin/me');
        if (!cancelled) setMe(res);
      } catch (err) {
        if (cancelled) return;
        // Only an explicit 401/403 means "you can't be here" — fail safe out.
        // Anything else (500, network) is transient: keep the user put.
        if (err instanceof ApiError && err.status === 401) {
          setDenied(true);
          router.replace('/login?next=/admin');
        } else if (err instanceof ApiError && err.status === 403) {
          setDenied(true);
          router.replace('/');
        } else {
          setTransientError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  if (transientError && !me) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center font-body text-sm text-muted-foreground">
        <Icon i="alert-triangle" size={20} className="text-accent" />
        <p>Impossible de joindre le serveur. Il est peut-être en train de redémarrer.</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
        >
          <Icon i="refresh-cw" size={14} />
          Réessayer
        </button>
      </main>
    );
  }

  if (denied || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-background font-body text-sm text-muted-foreground">
        <Icon i="lock" size={16} />
        {denied ? 'Accès refusé — redirection…' : 'Vérification des accès…'}
      </main>
    );
  }

  return (
    <AdminContext.Provider
      value={{ admin: me.admin, can: me.can, isSuperadmin: me.admin.role === 'SUPERADMIN' }}
    >
      <AdminShell>{children}</AdminShell>
    </AdminContext.Provider>
  );
}
