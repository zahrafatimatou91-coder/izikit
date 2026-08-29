'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  /** Native `minLength` passthrough — signup enforces 10. */
  minLength?: number;
  placeholder?: string;
}

/** Password input with a show/hide eye toggle. The button is `type="button"`
 * so it never submits the form, starts hidden, and swaps the field between
 * `type="password"` and `type="text"`. Matches the bordered lock-icon field
 * used on /login and /signup. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  placeholder = '••••••••',
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Masquer le mot de passe' : 'Voir le mot de passe';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-2.5 focus-within:border-primary">
      <Icon i="lock" size={16} className="flex-shrink-0 text-muted-foreground" />
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="-my-2.5 -mr-1.5 flex flex-shrink-0 items-center justify-center rounded-md px-2 py-2.5 text-muted-foreground outline-offset-2 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70"
      >
        <Icon i={visible ? 'eye-off' : 'eye'} size={16} />
      </button>
    </div>
  );
}
