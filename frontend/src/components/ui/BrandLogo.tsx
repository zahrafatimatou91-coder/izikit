// Brand lockup: the notched-coin mark + the "Chaque Franc" wordmark.
// Wordmark type follows the brand kit — "Chaque" in Montserrat, "Franc" in
// Playfair Display (the two faces are loaded in app/layout.tsx and exposed as
// --font-brand / --font-brand-serif). Single source of truth for every place
// the name shows up (landing nav/footer, sidebar, auth, onboarding).

interface BrandLogoProps {
  /**
   * `default` — green rounded tile + dark/green wordmark, for light surfaces.
   * `onColor` — bare gold diamond + light/gold wordmark, for the green panels
   *   (auth left panel). The notch is cut in `#1e6b45`, so only use it on that green.
   */
  variant?: 'default' | 'onColor';
  size?: 'sm' | 'md' | 'lg';
  /** Render the mark alone, without the "Chaque Franc" text. */
  iconOnly?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: 'h-7 w-7', text: 'text-lg', gap: 'gap-2' },
  md: { box: 'h-9 w-9', text: 'text-xl', gap: 'gap-2.5' },
  lg: { box: 'h-11 w-11', text: 'text-2xl', gap: 'gap-3' },
} as const;

function Mark({ variant, className }: { variant: 'default' | 'onColor'; className: string }) {
  if (variant === 'onColor') {
    return (
      <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
        <g transform="rotate(45 100 100)">
          <rect x="48" y="48" width="104" height="104" fill="#f5c842" />
          <circle cx="145.76" cy="54.24" r="20.8" fill="#1e6b45" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <rect x="0" y="0" width="200" height="200" rx="44" fill="#1e6b45" />
      <g transform="rotate(45 100 100)">
        <rect x="48" y="48" width="104" height="104" fill="#f5c842" />
        <circle cx="145.76" cy="54.24" r="20.8" fill="#1e6b45" />
      </g>
    </svg>
  );
}

export function BrandLogo({
  variant = 'default',
  size = 'md',
  iconOnly = false,
  className = '',
}: BrandLogoProps) {
  const s = SIZES[size];
  const chaque = variant === 'onColor' ? 'text-primary-foreground' : 'text-foreground';
  const franc = variant === 'onColor' ? 'text-secondary' : 'text-primary';

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${className}`}
      role="img"
      aria-label="Chaque Franc"
    >
      <Mark variant={variant} className={`${s.box} flex-shrink-0`} />
      {!iconOnly && (
        <span className={`whitespace-nowrap font-brand ${s.text} font-semibold leading-none`}>
          <span className={chaque}>Chaque</span>{' '}
          <span className={`font-brand-serif font-bold ${franc}`}>Franc</span>
        </span>
      )}
    </span>
  );
}
