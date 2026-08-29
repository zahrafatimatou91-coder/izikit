import type { ReactNode } from 'react';

/** Titled card wrapping a stack of rows, divided by hairlines. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 font-headings text-lg font-bold text-foreground">{title}</h3>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

/** Static label / value row with an optional trailing action. */
export function Row({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-foreground">{label}</p>
        <p className="truncate font-body text-xs text-muted-foreground">{value}</p>
      </div>
      {action}
    </div>
  );
}

/** Accessible on/off switch. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
