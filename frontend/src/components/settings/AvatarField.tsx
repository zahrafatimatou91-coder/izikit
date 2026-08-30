'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/upload-file';
import { validateImageFile, ALLOWED_IMAGE_TYPES } from '@/lib/validate-image';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useRipple } from '@/hooks/useRipple';

const ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

function uploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413 || err.code === 'FILE_TOO_LARGE')
      return 'Image trop lourde (10 Mo max).';
    if (err.status === 415) return 'Format non supporté — choisis un JPEG, PNG ou WebP.';
    if (err.status === 503 || err.code === 'STORAGE_NOT_CONFIGURED')
      return "L'hébergement d'images n'est pas encore configuré.";
    return err.message;
  }
  return 'Erreur réseau. Réessaie.';
}

interface AvatarFieldProps {
  name: string;
  avatarUrl: string | null;
  onChanged: () => Promise<void>;
}

/** "Compte" row: avatar preview + add/change (file upload) / remove. */
export function AvatarField({ name, avatarUrl, onChanged }: AvatarFieldProps) {
  const { toast } = useToast();
  const ripple = useRipple();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'upload' | 'remove'>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked later
    if (!file) return;

    // Pre-flight: reject oversized / wrong-type files before spending an
    // upload. The server re-checks (and magic-byte sniffs) regardless.
    const invalid = validateImageFile(file);
    if (invalid) {
      toast(invalid, 'error');
      return;
    }

    setBusy('upload');
    try {
      const url = await uploadFile(file);
      await api('/api/auth/me', { method: 'PATCH', body: { avatarUrl: url } });
      await onChanged();
      toast('Photo de profil mise à jour.', 'success');
    } catch (err) {
      toast(uploadErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto() {
    setBusy('remove');
    try {
      await api('/api/auth/me', { method: 'PATCH', body: { avatarUrl: null } });
      await onChanged();
      toast('Photo retirée.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur réseau. Réessaie.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const changeLabel = avatarUrl ? 'Changer la photo' : 'Ajouter une photo';

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-4 text-center sm:flex-row sm:justify-between sm:gap-3 sm:text-left lg:px-6">
      <div className="flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:gap-3">
        <UserAvatar
          name={name}
          avatarUrl={avatarUrl}
          className="h-16 w-16 flex-shrink-0 rounded-lg sm:h-14 sm:w-14"
        />
        <div className="min-w-0">
          <p className="font-body text-sm font-medium text-foreground">Photo de profil</p>
          <p className="font-body text-xs text-muted-foreground">JPEG, PNG ou WebP — 10 Mo max.</p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-shrink-0 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onPointerDown={ripple}
          disabled={busy !== null}
          className="relative flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 sm:w-auto"
        >
          <Icon i="camera" size={15} />
          {busy === 'upload' ? 'Envoi…' : changeLabel}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={busy !== null}
            className="font-body text-sm font-medium text-muted-foreground hover:text-accent disabled:opacity-50"
          >
            {busy === 'remove' ? '…' : 'Retirer'}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} className="hidden" />
    </div>
  );
}
