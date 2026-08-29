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

/**
 * Full-width row that toggles a boolean setting. The whole row is the hit
 * target (title + description included) — not just the switch — so it's
 * comfortable to tap on a phone. The switch on the right is the visual
 * affordance; `role="switch"` + `aria-checked` live on the row button.
 */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 lg:px-6"
    >
      <span className="min-w-0">
        <span className="block font-body text-sm font-medium text-foreground">{label}</span>
        <span className="block font-body text-xs text-muted-foreground">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-primary/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card ${
          checked ? 'bg-primary' : 'bg-muted-foreground/35'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
