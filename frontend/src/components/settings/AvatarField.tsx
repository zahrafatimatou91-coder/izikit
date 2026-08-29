'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { uploadFile } from '@/lib/upload-file';
import { useToast } from '@/contexts/ToastContext';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';

const ACCEPT = 'image/jpeg,image/png,image/webp';

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

/** "Compte" row: avatar preview + change (file upload) / remove. */
export function AvatarField({ name, avatarUrl, onChanged }: AvatarFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'upload' | 'remove'>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked later
    if (!file) return;
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

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar name={name} avatarUrl={avatarUrl} className="h-14 w-14 rounded-lg" />
        <div className="min-w-0">
          <p className="font-body text-sm font-medium text-foreground">Photo de profil</p>
          <p className="font-body text-xs text-muted-foreground">JPEG, PNG ou WebP — 10 Mo max.</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <Icon i="camera" size={15} />
          {busy === 'upload' ? 'Envoi…' : 'Changer'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} className="hidden" />
    </div>
  );
}
