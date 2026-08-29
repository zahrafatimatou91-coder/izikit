// Client-side pre-flight for avatar / image uploads. Mirrors the server's
// two cheap gates (POST /api/upload: UPLOAD_MAX_BYTES → 413, UPLOAD_ALLOWED_MIME
// → 415) so the user gets an instant French error instead of a wasted upload
// round-trip. The server stays the source of truth (it also magic-byte sniffs).

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const TOO_LARGE = 'Image trop lourde (10 Mo max).';
const BAD_TYPE = 'Format non supporté — choisis un JPEG, PNG ou WebP.';

/** Returns a user-facing French error string, or `null` when the file is fine. */
export function validateImageFile(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return BAD_TYPE;
  if (file.size > MAX_IMAGE_BYTES) return TOO_LARGE;
  return null;
}
