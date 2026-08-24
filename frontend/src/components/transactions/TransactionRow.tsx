import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';

interface TransactionRowProps {
  label: string;
  category: string;
  amount: number; // signed, smallest unit — negative = expense, positive = income
  time: string;
  icon: IconName;
}

/** Single transaction entry in a history list. */
export function TransactionRow({ label, category, amount, time, icon }: TransactionRowProps) {
  const isPositive = amount > 0;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon i={icon} size={16} className="text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-body text-sm font-medium text-foreground">{label}</div>
        <div className="font-body text-xs text-muted-foreground">
          {category} · {time}
        </div>
      </div>
      <span
        className={`font-headings text-base font-bold ${isPositive ? 'text-primary' : 'text-foreground'}`}
      >
        {isPositive ? '+' : ''}
        {formatPrice(amount)} F
      </span>
    </div>
  );
}
