import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { envelopeSwatch, type EnvelopeSwatchKey } from '@/lib/envelope-colors';
import { formatPrice } from '@/lib/utils';

interface EnvelopeCardProps {
  name: string;
  icon: IconName;
  spent: number;
  total: number;
  color: EnvelopeSwatchKey;
}

/** Budget envelope card — remaining amount + progress bar, turns red past 85%. */
export function EnvelopeCard({ name, icon, spent, total, color }: EnvelopeCardProps) {
  const remaining = total - spent;
  const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
  const danger = pct >= 85;
  const swatch = envelopeSwatch(color);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`${swatch.bg} flex h-8 w-8 items-center justify-center rounded-md`}>
            <Icon i={icon} size={15} className={swatch.text} />
          </div>
          <span className="font-body text-sm font-medium text-foreground">{name}</span>
        </div>
        <span className={`font-body text-xs ${danger ? 'text-accent' : 'text-muted-foreground'}`}>
          <AnimatedNumber value={pct} />%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`transition-bar h-full rounded-full ${danger ? 'bg-accent' : swatch.bg}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-headings text-xl font-bold text-foreground">
          <AnimatedNumber value={remaining} format={formatPrice} />
          <span className="ml-1 font-body text-xs font-normal text-muted-foreground">FCFA</span>
        </span>
        <span className="font-body text-xs text-muted-foreground">sur {formatPrice(total)}</span>
      </div>
    </div>
  );
}
