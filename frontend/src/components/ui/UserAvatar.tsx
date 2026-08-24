import { cn } from '@/lib/utils';
import { swatchBgClassFromString } from '@/lib/envelope-colors';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
}

function initials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

/** Real user avatar (Cloudinary URL) with an initials-on-swatch fallback —
 * replaces Banani's stock-photo `UserAvatar` demo prop shape (gender/
 * ageGroup/heritage/index), which has no equivalent in our User model. */
export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  if (avatarUrl) {
    // Plain <img>, not next/image — Cloudinary URLs aren't in next.config's
    // image domain allowlist yet, and this project's eslint config doesn't
    // run eslint-config-next's rules.
    return <img src={avatarUrl} alt={name ?? 'Avatar'} className={cn('object-cover', className)} />;
  }
  return (
    <div
      className={cn(
        swatchBgClassFromString(name),
        'flex items-center justify-center font-headings font-bold text-primary-foreground',
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
