// Shared SEO constants — canonical site URL + name, consumed by
// robots.ts, sitemap.ts, the root layout's metadataBase, per-page
// metadata, and opengraph-image.tsx. Kept as one small source of truth
// so a domain change is a one-line edit, not a grep-and-replace.
//
// Reuses `APP_URL` (already documented in .env.example as "Public origin
// URL — used for email link generation, OAuth callback base, and CORS
// construction") rather than introducing a second, redundant env var for
// the same concept. Falls back to the production domain shown in the
// homepage's own hero mockup (`chaquefranc.com` / `app.chaquefranc.com`)
// so `next build` never ships relative/localhost URLs into a metadata
// export if APP_URL is forgotten in a deploy's env config.
const FALLBACK_SITE_URL = 'https://chaquefranc.com';

const rawAppUrl = process.env.APP_URL?.trim();
// A localhost/dev value is a valid APP_URL for running the app, but it is
// never a valid *public* URL to bake into robots.txt/sitemap.xml/Open
// Graph tags — those must resolve for a real crawler or social scraper
// hitting the production domain. Metadata always uses the fallback in
// that case; runtime code that legitimately needs the dev origin (email
// links, OAuth callback, payment redirects) keeps reading
// `process.env.APP_URL` directly and is unaffected by this file.
const isPublicUrl = !!rawAppUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawAppUrl);

/** Canonical public origin, no trailing slash. */
export const SITE_URL = (isPublicUrl ? rawAppUrl! : FALLBACK_SITE_URL).replace(/\/+$/, '');

export const SITE_NAME = 'Chaque Franc';

export const SITE_DESCRIPTION =
  'Chaque Franc est une application de budget par enveloppes pensée pour les étudiants africains : planifie ton argent dès qu’il arrive, suis tes dépenses en temps réel et atteins tes objectifs d’épargne.';
