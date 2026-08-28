// Shared text-normalization helpers — safe to import from both client
// components and server code (no 'use client', no DOM/React dependency).

/** Strips common French accents so search/compare is typo- and
 * accent-insensitive (e.g. "café" matches "cafe"). */
export function stripAccents(s: string): string {
  return s
    .replace(/[àâ]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c');
}

/** Case- and accent-insensitive, whitespace-trimmed comparison key — use
 * for "is this the same name the user typed elsewhere" checks. */
export function normalizeForCompare(s: string): string {
  return stripAccents(s.trim().toLowerCase());
}
