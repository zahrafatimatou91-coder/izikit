'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Extra classes on both the header cell and the body cell (e.g. `text-right`). */
  align?: 'left' | 'right' | 'center';
  /** Min width hint so the column doesn't crush on horizontal scroll. */
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
  /** Cursor pager. */
  pager?: {
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    rangeLabel?: string;
  };
  busy?: boolean;
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyLabel = 'Aucun résultat.',
  pager,
  busy = false,
}: DataTableProps<T>) {
  const loading = rows === null;

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-input">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-3 font-headings text-[11px] font-bold tracking-widest text-muted-foreground uppercase whitespace-nowrap',
                    c.align && ALIGN[c.align],
                  )}
                  style={c.width ? { minWidth: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(busy && 'opacity-50')}>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-input last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-4">
                      <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center font-body text-sm text-muted-foreground"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-input last:border-0',
                    onRowClick && 'cursor-pointer transition-colors hover:bg-input',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3.5 font-body text-sm text-foreground align-middle',
                        c.align && ALIGN[c.align],
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pager && (
        <div className="flex items-center justify-between gap-3 border-t border-input px-4 py-3">
          <p className="font-body text-xs text-muted-foreground">{pager.rangeLabel ?? ''}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={pager.onPrev}
              disabled={!pager.hasPrev || busy}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-body text-xs font-medium text-foreground disabled:opacity-40"
            >
              <Icon i="chevron-left" size={14} />
              Précédent
            </button>
            <button
              type="button"
              onClick={pager.onNext}
              disabled={!pager.hasNext || busy}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-body text-xs font-medium text-foreground disabled:opacity-40"
            >
              Suivant
              <Icon i="chevron-right" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
