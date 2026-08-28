'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (delete, etc.) —
   * accent color instead of primary. */
  destructive?: boolean;
  /** Disables both buttons and is meant to be paired with a busy confirmLabel
   * (e.g. "Suppression…") while the action is in flight. */
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Branded confirm/cancel modal — replaces the browser's native
 * window.confirm(), which can't be styled, blocks the render thread, and
 * looks like an OS alert rather than part of the app. Used anywhere an
 * irreversible action (delete a goal, an envelope, sign out...) needs a
 * "are you sure?" gate. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h3
          id="confirm-dialog-title"
          className="mb-2 font-headings text-lg font-bold text-foreground"
        >
          {title}
        </h3>
        {description && (
          <p className="mb-6 font-body text-sm text-muted-foreground">{description}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`flex-1 rounded-lg px-4 py-2 font-body text-sm font-bold disabled:opacity-50 ${
              destructive
                ? 'bg-accent text-accent-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
