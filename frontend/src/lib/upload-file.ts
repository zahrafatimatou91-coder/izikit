// Multipart upload helper for POST /api/upload.
//
// The shared `api()` wrapper always sends `Content-Type: application/json`
// and JSON.stringifies the body, so it can't post a `FormData`. This is the
// one place that needs its own fetch. It still attaches the double-submit
// CSRF token the same way `api()` does (header echoed from the readable
// cookie / localStorage mirror).

import { API_URL, COOKIE_PREFIX } from './constants';
import { ApiError } from './api';

const CSRF_KEY = `${COOKIE_PREFIX}-csrf`;

function csrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem(CSRF_KEY);
  if (fromStorage) return fromStorage;
  const escaped = CSRF_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Upload a single file to POST /api/upload and return its public URL
 * (a Cloudinary secure_url). Throws `ApiError` on failure — `.status`
 * distinguishes the cases the caller cares about (413 too large, 415 bad
 * type, 503 storage not configured); `.code` carries the route's stable
 * code string (e.g. `FILE_TOO_LARGE`, `STORAGE_NOT_CONFIGURED`).
 */
export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const token = csrfToken();
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { 'x-csrf-token': token } : {},
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof body.message === 'string'
        ? body.message
        : typeof body.code === 'string'
          ? body.code
          : `Error ${res.status}`;
    // The upload route returns `{ code }` rather than `{ error }`; normalize
    // so `ApiError.code` is populated like every other call.
    throw new ApiError(res.status, message, { error: body.code, ...body });
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
