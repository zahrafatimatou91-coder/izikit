import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { formatPrice } from '@/lib/utils';
import { budgetPeriodLabel } from '@/lib/budget-period-label';
import { dailyTagline, firstName, timeOfDayEmoji, timeOfDayGreeting } from '@/lib/greeting';
import { computeBudgetSummary } from '@/lib/budget-summary';

interface DashboardHeaderProps {
  name: string;
  totalBudget: number;
  spent: number;
  income: number;
  daysLeft: number;
  budgetFrequency?: string | null;
  avatarUrl?: string | null;
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
}: DashboardHeaderProps) {
  const {
    remaining,
    perDay,
    pctUsed: pct,
  } = computeBudgetSummary({
    totalBudget,
    income,
    spent,
    daysLeft,
  });

  return (
    <div className="bg-primary px-5 pb-8 pt-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-xs text-primary-foreground/70">{timeOfDayGreeting()},</p>
          <p className="truncate font-headings text-lg font-bold text-primary-foreground">
            {firstName(name)} {timeOfDayEmoji()}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
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
          <AnimatedNumber value={remaining} format={formatPrice} />
          <span className="ml-2 font-body text-lg font-normal text-primary-foreground/80">
            FCFA
          </span>
        </p>
        <p className="font-body text-xs text-primary-foreground/60">
          Soit <AnimatedNumber value={perDay} format={formatPrice} /> F / jour
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
            className="transition-bar h-full rounded-full bg-secondary"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
