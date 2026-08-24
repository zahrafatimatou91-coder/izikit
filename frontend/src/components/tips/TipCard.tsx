import Link from 'next/link';
import type { IconName } from 'lucide-react/dynamic';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/utils';

interface TipCardProps {
  id: string;
  title: string;
  excerpt: string;
  icon: IconName;
  estimatedSavingsFcfa: number | null;
}

/** Grid card for /tips — the summary text is a one-line excerpt of the
 * tip's body (first paragraph), not a separate field. */
export function TipCard({ id, title, excerpt, icon, estimatedSavingsFcfa }: TipCardProps) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon i={icon} size={20} className="text-secondary-foreground" />
        </div>
        <h3 className="font-headings text-base font-bold text-foreground">{title}</h3>
      </div>
      <p className="mb-4 flex-1 font-body text-sm leading-relaxed text-foreground">{excerpt}</p>
      {estimatedSavingsFcfa !== null && (
        <div className="mb-4 rounded-lg bg-muted p-3 font-body text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Économies possibles :</span> ~
          {formatPrice(estimatedSavingsFcfa)} FCFA/mois
        </div>
      )}
      <Link
        href={`/tips/${id}`}
        className="w-full rounded-lg border border-border bg-input px-4 py-2 text-center font-body text-sm font-medium text-primary"
      >
        En savoir plus
      </Link>
    </div>
  );
}
