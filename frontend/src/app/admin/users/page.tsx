'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import {
  AdminPageHeader,
  Badge,
  InlineError,
  PlanBadge,
  UserStatusBadge,
} from '@/components/admin/primitives';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { useCursorList } from '@/components/admin/useCursorList';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  effectivePlan: string;
  isTrial: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Admin',
  SUPERADMIN: 'Superadmin',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  // Debounce the search box so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '20' };
    if (query) p.q = query;
    if (role) p.role = role;
    if (status) p.status = status;
    return p;
  }, [query, role, status]);

  const list = useCursorList<AdminUser>('/api/admin/users', params);

  const columns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      width: '200px',
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground">{u.name ?? u.email.split('@')[0]}</p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rôle',
      render: (u) =>
        u.role === 'USER' ? (
          <span className="text-xs text-muted-foreground">{ROLE_LABEL.USER}</span>
        ) : (
          <Badge tone="primary" icon="shield">
            {ROLE_LABEL[u.role] ?? u.role}
          </Badge>
        ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (u) => <PlanBadge plan={u.effectivePlan} isTrial={u.isTrial} />,
    },
    { key: 'status', header: 'Statut', render: (u) => <UserStatusBadge status={u.status} /> },
    {
      key: 'created',
      header: 'Inscription',
      render: (u) => <span className="text-xs text-muted-foreground">{fmtDate(u.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: () => <Icon i="chevron-right" size={16} className="text-muted-foreground" />,
    },
  ];

  return (
    <div>
      <AdminPageHeader title="Utilisateurs" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Icon i="search" size={15} className="text-muted-foreground" />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Rechercher (email ou nom)…"
            className="w-full bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 font-body text-sm text-foreground focus:outline-none"
        >
          <option value="">Tous les rôles</option>
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPERADMIN">Superadmin</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 font-body text-sm text-foreground focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="SUSPENDED">Suspendu</option>
        </select>
      </div>

      {list.error && <InlineError message={list.error} onRetry={list.reload} />}

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(u) => u.id}
        onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
        emptyLabel="Aucun utilisateur ne correspond."
        busy={list.busy}
        pager={{
          hasPrev: list.hasPrev,
          hasNext: list.hasNext,
          onPrev: list.prev,
          onNext: list.next,
          rangeLabel: list.items ? `${list.items.length} résultat(s) sur cette page` : '',
        }}
      />
    </div>
  );
}
