// Wraps every /admin/* route. Gate: GET /api/admin/me returns 200 with the
// admin object + capability list, or 401/403 for everyone else — non-admins
// are bounced to the app home. A skeleton renders during the round trip.
//
// The server re-checks the role on every /api/admin/* call, so this is a UX
// gate, not the security boundary.
'use client';

import { useEffect, useState, type ReactNode } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<MeResponse>('/api/admin/me');
        if (!cancelled) setMe(res);
      } catch (err) {
        if (cancelled) return;
        // Any failure — 401, 403, or unknown — fails safe to the home page.
        setDenied(true);
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login?next=/admin');
        } else {
          router.replace('/');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
