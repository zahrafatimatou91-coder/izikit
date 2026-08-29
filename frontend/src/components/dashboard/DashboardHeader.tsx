import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatPrice } from '@/lib/utils';
import { budgetPeriodLabel } from '@/lib/budget-period-label';
import { dailyTagline, firstName, timeOfDayGreeting } from '@/lib/greeting';

interface DashboardHeaderProps {
  name: string;
  totalBudget: number;
  spent: number;
  income: number;
  daysLeft: number;
  budgetFrequency?: string | null;
  avatarUrl?: string | null;
  onMenuClick?: () => void;
}

/** Top bar: greeting, remaining balance for the period, spend progress bar. */
export function DashboardHeader({
  name,
  totalBudget,
  spent,
  income,
  daysLeft,
  budgetFrequency = null,
  avatarUrl = null,
  onMenuClick,
}: DashboardHeaderProps) {
  // Income restocks the period's available budget — "remaining" isn't just
  // the original allowance draining down, a logged income bumps it back up.
  const available = totalBudget + income;
  const remaining = available - spent;
  const pct = available > 0 ? Math.round((spent / available) * 100) : 0;
  const perDay = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining;

  return (
    <div className="bg-primary px-5 pb-8 pt-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15"
          >
            <Icon i="menu" size={18} className="text-primary-foreground" />
          </button>
          <div>
            <p className="font-body text-xs text-primary-foreground/70">{timeOfDayGreeting()},</p>
            <p className="font-headings text-lg font-bold text-primary-foreground">
              {firstName(name)} 👋
            </p>
          </div>
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

      <p className="mb-6 font-body text-sm text-primary-foreground/80">{dailyTagline()}</p>

      <div className="mb-1">
        <p className="mb-1 font-body text-xs text-primary-foreground/70">
          Reste {budgetPeriodLabel(budgetFrequency)}
        </p>
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
