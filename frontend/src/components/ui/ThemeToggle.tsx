'use client';

import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { Icon } from './Icon';
import { useRipple } from '@/hooks/useRipple';

const OPTIONS: { value: Theme; label: string; icon: 'sun' | 'monitor' | 'moon' }[] = [
  { value: 'light', label: 'Clair', icon: 'sun' },
  { value: 'system', label: 'Système', icon: 'monitor' },
  { value: 'dark', label: 'Sombre', icon: 'moon' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const ripple = useRipple();

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-input p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          onPointerDown={ripple}
          aria-pressed={theme === opt.value}
          className={`relative flex items-center gap-1.5 overflow-hidden rounded-md px-3 py-1.5 font-body text-xs font-medium transition-colors ${
            theme === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon i={opt.icon} size={14} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
