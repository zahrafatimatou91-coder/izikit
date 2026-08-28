import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';
import { paceLabel } from '@/lib/savings-pace-label';

interface SavingsGoalCardProps {
  id: string;
  name: string;
  icon: IconName;
  currentAmount: number;
  targetAmount: number;
  period: string;
  paceAmount: number | null;
  completed: boolean;
  onDelete?: () => void;
}

/** Progress card for one savings goal — used on /progress. Generalizes
 * Banani's single hardcoded "Active objective" block into a real per-goal
 * card, since a user can have more than one goal. */
export function SavingsGoalCard({
  id,
  name,
  icon,
  currentAmount,
  targetAmount,
  period,
  paceAmount,
  completed,
  onDelete,
}: SavingsGoalCardProps) {
  const pct =
    targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
  const pace = paceLabel(period, paceAmount);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Icon i={icon} size={20} className="text-secondary-foreground" />
          </div>
          <div>
            <h3 className="font-headings text-base font-bold text-foreground">{name}</h3>
            {pace && <p className="font-body text-xs text-muted-foreground">{pace}</p>}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className="font-headings text-lg font-bold text-primary">
              {formatPrice(currentAmount)}
            </p>
            <p className="font-body text-xs text-muted-foreground">
              sur {formatPrice(targetAmount)}
            </p>
          </div>
          {onDelete && (
            <button
              type="button"
              aria-label="Supprimer l'objectif"
              onClick={onDelete}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <Icon i="trash-2" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <p className="font-body text-xs font-medium text-muted-foreground">
          {completed ? 'Objectif atteint 🎉' : 'Progression'}
        </p>
        <p className="font-body text-xs font-bold text-foreground">{pct}%</p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${completed ? 'bg-secondary' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <Link
        href={`/savings/${id}/add`}
        className="mt-4 flex w-full items-center justify-center rounded-lg border border-primary px-4 py-2.5 font-body text-sm font-medium text-primary"
      >
        Ajouter une économie
      </Link>
    </div>
  );
}
