import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatPrice } from '@/lib/utils';

interface DashboardHeaderProps {
  name: string;
  totalBudget: number;
  spent: number;
  daysLeft: number;
  avatarUrl?: string | null;
}

/** Top bar: greeting, remaining balance for the period, spend progress bar. */
export function DashboardHeader({
  name,
  totalBudget,
  spent,
  daysLeft,
  avatarUrl = null,
}: DashboardHeaderProps) {
  const remaining = totalBudget - spent;
  const pct = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
  const perDay = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining;

  return (
    <div className="bg-primary px-5 pb-8 pt-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-body text-xs text-primary-foreground/70">Bonjour,</p>
          <p className="font-headings text-lg font-bold text-primary-foreground">{name} 👋</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15"
          >
            <Icon i="bell" size={18} className="text-primary-foreground" />
          </button>
          <UserAvatar name={name} avatarUrl={avatarUrl} className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      <div className="mb-1">
        <p className="mb-1 font-body text-xs text-primary-foreground/70">Reste ce mois-ci</p>
        <p className="mb-2 font-headings text-4xl font-bold leading-none text-primary-foreground">
          {formatPrice(remaining)}
          <span className="ml-2 font-body text-lg font-normal text-primary-foreground/80">
            FCFA
          </span>
        </p>
        <p className="font-body text-xs text-primary-foreground/60">
          Soit {formatPrice(perDay)} F / jour
        </p>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-body text-xs text-primary-foreground/70">
            {formatPrice(spent)} F dépensés
          </span>
          <span className="font-body text-xs text-primary-foreground/70">
            {daysLeft} j. restants
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20">
          <div
            className="h-full rounded-full bg-secondary"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
