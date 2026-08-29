// Multipart upload helper for POST /api/upload.
//
// The shared `api()` wrapper always sends `Content-Type: application/json`
// and JSON.stringifies the body, so it can't post a `FormData`. This is the
// one place that needs its own fetch. It mirrors the two things `api()` does
// that matter here: attach the double-submit CSRF token, and refresh once
// on a 401 (stale 15-min access token) then retry.

import { API_URL, COOKIE_PREFIX } from './constants';
import { ApiError } from './api';

const CSRF_KEY = `${COOKIE_PREFIX}-csrf`;

/** Cookie first (it's what the server's double-submit check compares against,
 * and it's the value that gets rotated on refresh), localStorage as fallback. */
function csrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const escaped = CSRF_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (match && match[1]) return decodeURIComponent(match[1]);
  return localStorage.getItem(CSRF_KEY);
}

function postUpload(form: FormData): Promise<Response> {
  const token = csrfToken();
  return fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { 'x-csrf-token': token } : {},
    body: form,
  });
}

/**
 * Upload a single file to POST /api/upload and return its public URL
 * (a Cloudinary secure_url). Throws `ApiError` on failure — `.status`
 * distinguishes the cases the caller cares about (413 too large, 415 bad
 * type, 503 storage not configured, 502 storage write failed); `.code`
 * carries the route's stable code string.
 */
export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  let res = await postUpload(form);

  // Stale access token → refresh once (single call, no lock — this is a
  // one-shot user action) and retry. The refresh rotates the CSRF cookie,
  // which `csrfToken()` re-reads on the retry.
  if (res.status === 401) {
    const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (refreshed.ok) res = await postUpload(form);
  }

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
