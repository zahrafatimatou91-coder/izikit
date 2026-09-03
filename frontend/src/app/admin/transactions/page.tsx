'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import { useAdmin } from '@/components/admin/AdminContext';
import {
  AdminPageHeader,
  InlineError,
  OrderStatusBadge,
  WithdrawalStatusBadge,
} from '@/components/admin/primitives';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { useCursorList } from '@/components/admin/useCursorList';

interface OrderRow {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string | null;
  provider: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface WithdrawalRow {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  destination: unknown;
  provider: string;
  failureReason: string | null;
  requestedAt: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function maskDestination(d: unknown): string {
  if (d && typeof d === 'object') {
    const rec = d as Record<string, unknown>;
    const method = typeof rec.method === 'string' ? rec.method : '';
    const phone = typeof rec.phone === 'string' ? rec.phone : '';
    const tail = phone ? `··· ${phone.slice(-4)}` : '';
    return [method, tail].filter(Boolean).join(' ');
  }
  return '—';
}

const ORDER_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED'];
const WITHDRAWAL_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function AdminTransactionsPage() {
  const { isSuperadmin } = useAdmin();
  const { toast } = useToast();
  const [tab, setTab] = useState<'payments' | 'withdrawals'>('payments');
  const [status, setStatus] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '20' };
    if (status) p.status = status;
    return p;
  }, [status]);

  const orders = useCursorList<OrderRow>('/api/admin/orders', params);
  const withdrawals = useCursorList<WithdrawalRow>('/api/admin/withdrawals', params);
  const active = tab === 'payments' ? orders : withdrawals;

  async function cancelWithdrawal(id: string) {
    const reason = window.prompt("Motif de l'annulation (obligatoire) :")?.trim();
    if (!reason) return;
    setCancelling(id);
    try {
      await api(`/api/admin/withdrawals/${id}/cancel`, { method: 'POST', body: { reason } });
      toast('Retrait annulé.', 'success');
      withdrawals.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Annulation impossible.', 'error');
    } finally {
      setCancelling(null);
    }
  }

  const orderColumns: Column<OrderRow>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      width: '180px',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{o.customerEmail ?? o.userId}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Montant',
      render: (o) => (
        <span className="font-bold text-foreground">
          {formatPrice(o.amount)} {o.currency}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Moyen',
      render: (o) => (
        <span className="text-xs text-muted-foreground">
          {o.provider}
          {o.paymentMethod ? ` · ${o.paymentMethod}` : ''}
        </span>
      ),
    },
    { key: 'status', header: 'Statut', render: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'date',
      header: 'Date',
      render: (o) => (
        <span className="text-xs text-muted-foreground">{fmtDate(o.paidAt ?? o.createdAt)}</span>
      ),
    },
  ];

  const withdrawalColumns: Column<WithdrawalRow>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      width: '150px',
      render: (w) => <span className="text-xs text-muted-foreground">{w.userId}</span>,
    },
    {
      key: 'amount',
      header: 'Montant',
      render: (w) => (
        <span className="font-bold text-foreground">
          {formatPrice(w.amount)} {w.currency}
        </span>
      ),
    },
    {
      key: 'dest',
      header: 'Destination',
      render: (w) => (
        <span className="text-xs text-muted-foreground">{maskDestination(w.destination)}</span>
      ),
    },
    { key: 'status', header: 'Statut', render: (w) => <WithdrawalStatusBadge status={w.status} /> },
    {
      key: 'date',
      header: 'Demandé le',
      render: (w) => (
        <span className="text-xs text-muted-foreground">{fmtDate(w.requestedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (w) =>
        isSuperadmin && (w.status === 'PENDING' || w.status === 'PROCESSING') ? (
          <button
            type="button"
            onClick={() => cancelWithdrawal(w.id)}
            disabled={cancelling === w.id}
            className="rounded-lg border border-accent px-2.5 py-1 font-body text-xs font-bold text-accent disabled:opacity-50"
          >
            {cancelling === w.id ? '…' : 'Annuler'}
          </button>
        ) : null,
    },
  ];

  const statuses = tab === 'payments' ? ORDER_STATUSES : WITHDRAWAL_STATUSES;

  return (
    <div>
      <AdminPageHeader title="Transactions" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(
            [
              ['payments', 'Paiements'],
              ['withdrawals', 'Retraits'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setTab(val);
                setStatus('');
              }}
              className={`rounded-md px-4 py-1.5 font-body text-sm font-bold ${
                tab === val ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 font-body text-sm text-foreground focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {active.error && <InlineError message={active.error} onRetry={active.reload} />}

      {tab === 'payments' && (
        <p className="mb-3 font-body text-xs text-muted-foreground">
          Lecture seule. Aucun remboursement n&apos;est déclenché depuis l&apos;admin — cela se fait
          côté fournisseur de paiement.
        </p>
      )}

      {tab === 'payments' ? (
        <DataTable
          columns={orderColumns}
          rows={orders.items}
          rowKey={(o) => o.id}
          emptyLabel="Aucun paiement."
          busy={orders.busy}
          pager={{
            hasPrev: orders.hasPrev,
            hasNext: orders.hasNext,
            onPrev: orders.prev,
            onNext: orders.next,
            rangeLabel: orders.items ? `${orders.items.length} sur cette page` : '',
          }}
        />
      ) : (
        <DataTable
          columns={withdrawalColumns}
          rows={withdrawals.items}
          rowKey={(w) => w.id}
          emptyLabel="Aucun retrait."
          busy={withdrawals.busy}
          pager={{
            hasPrev: withdrawals.hasPrev,
            hasNext: withdrawals.hasNext,
            onPrev: withdrawals.prev,
            onNext: withdrawals.next,
            rangeLabel: withdrawals.items ? `${withdrawals.items.length} sur cette page` : '',
          }}
        />
      )}
    </div>
  );
}
