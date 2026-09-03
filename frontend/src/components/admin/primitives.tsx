'use client';

import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────────
// Badge
// ────────────────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'primary' | 'gold' | 'accent' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  gold: 'bg-secondary/20 text-secondary-foreground',
  accent: 'bg-accent/10 text-accent',
  info: 'bg-[#5DA0D0]/15 text-[#3277a8]',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-bold whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <Icon i={icon} size={12} />}
      {children}
    </span>
  );
}

/** Effective plan badge — pass the live `effectivePlan`, plus flags. */
export function PlanBadge({
  plan,
  isTrial = false,
  isComp = false,
}: {
  plan: string;
  isTrial?: boolean;
  isComp?: boolean;
}) {
  if (plan !== 'PRO') return <Badge tone="neutral">Free</Badge>;
  if (isComp)
    return (
      <Badge tone="accent" icon="gift">
        Pro offert
      </Badge>
    );
  if (isTrial)
    return (
      <Badge tone="info" icon="clock">
        Essai Pro
      </Badge>
    );
  return (
    <Badge tone="gold" icon="crown">
      Pro
    </Badge>
  );
}

export function UserStatusBadge({ status }: { status: string }) {
  return status === 'SUSPENDED' ? (
    <Badge tone="accent" dot>
      Suspendu
    </Badge>
  ) : (
    <Badge tone="primary" dot>
      Actif
    </Badge>
  );
}

const ORDER_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  PAID: { tone: 'primary', label: 'Payé' },
  PENDING: { tone: 'gold', label: 'En attente' },
  EXPIRED: { tone: 'neutral', label: 'Expiré' },
  FAILED: { tone: 'accent', label: 'Échoué' },
  REFUNDED: { tone: 'accent', label: 'Remboursé' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const WITHDRAWAL_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  COMPLETED: { tone: 'primary', label: 'Effectué' },
  PENDING: { tone: 'gold', label: 'En attente' },
  PROCESSING: { tone: 'gold', label: 'En cours' },
  FAILED: { tone: 'accent', label: 'Échoué' },
  CANCELLED: { tone: 'neutral', label: 'Annulé' },
};

export function WithdrawalStatusBadge({ status }: { status: string }) {
  const s = WITHDRAWAL_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const SUB_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  ACTIVE: { tone: 'primary', label: 'Active' },
  PAST_DUE: { tone: 'accent', label: 'Impayée' },
  CANCELED: { tone: 'neutral', label: 'Annulée' },
};

export function SubStatusBadge({ status }: { status: string }) {
  const s = SUB_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

// ────────────────────────────────────────────────────────────────────
// StatCard
// ────────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon,
  hint,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  hint?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-body text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon i={icon} size={16} />
        </span>
      </div>
      {loading ? (
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <p className="font-headings text-2xl font-bold text-foreground">{value}</p>
      )}
      {hint && <p className="font-body text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Layout helpers
// ────────────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-input bg-card', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-input px-5 py-4">
          <div>
            {title && (
              <h3 className="font-headings text-base font-bold text-foreground">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 font-body text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function AdminPageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-headings text-xl font-bold text-foreground lg:text-2xl">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 font-body text-sm text-accent">
      <Icon i="alert-triangle" size={16} />
      {message}
    </div>
  );
}
