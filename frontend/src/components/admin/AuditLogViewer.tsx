'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatRelativeDateTime } from '@/lib/format-date';
import { InlineError } from './primitives';
import { DataTable, type Column } from './DataTable';
import { useCursorList } from './useCursorList';

interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export function AuditLogViewer() {
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '20' };
    if (action.trim()) p.action = action.trim();
    if (actor.trim()) p.actor = actor.trim();
    return p;
  }, [action, actor]);

  const list = useCursorList<AuditRow>('/api/admin/audit-log', params);

  const columns: Column<AuditRow>[] = [
    {
      key: 'action',
      header: 'Action',
      width: '160px',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-foreground">{r.action}</span>
      ),
    },
    {
      key: 'target',
      header: 'Cible',
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.targetType ?? '—'}
          {r.targetId ? ` · ${r.targetId.slice(0, 12)}` : ''}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Acteur',
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.actorId.slice(0, 12)}</span>
      ),
    },
    {
      key: 'meta',
      header: 'Détail',
      render: (r) =>
        r.metadata ? (
          <span className="line-clamp-1 max-w-[220px] font-mono text-[11px] text-muted-foreground">
            {JSON.stringify(r.metadata)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'when',
      header: 'Quand',
      align: 'right',
      render: (r) => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {formatRelativeDateTime(new Date(r.createdAt))}
        </span>
      ),
    },
  ];

  return (
    <div className="px-5 py-5">
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Icon i="filter" size={13} className="text-muted-foreground" />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="action (ex: settings.update)"
            className="w-48 bg-transparent font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Icon i="users" size={13} className="text-muted-foreground" />
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="ID acteur"
            className="w-40 bg-transparent font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {list.error && <InlineError message={list.error} />}

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(r) => r.id}
        emptyLabel="Aucune action enregistrée."
        busy={list.busy}
        pager={{
          hasPrev: list.hasPrev,
          hasNext: list.hasNext,
          onPrev: list.prev,
          onNext: list.next,
          rangeLabel: list.items ? `${list.items.length} entrée(s)` : '',
        }}
      />
    </div>
  );
}
