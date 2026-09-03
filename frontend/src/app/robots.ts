import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Only the public marketing homepage (and the auth entry points a search
// result might legitimately land a new visitor on) are worth crawling.
// Everything else is either:
//   - per-user private data (dashboard, envelopes, history, insights,
//     progress, savings, settings, tips, transactions, notifications,
//     orders) — nothing there is indexable content, and letting a
//     crawler spend budget on thousands of near-identical auth-gated
//     shells actively hurts how the homepage itself gets crawled;
//   - the back-office (`/admin`) — no reason a search engine should ever
//     know this exists;
//   - `/api/*` — JSON endpoints, not pages; several are POST-only or
//     auth-gated and return errors to an unauthenticated GET anyway.
// Disallowing these is defense-in-depth on top of the app's own auth
// checks, not a substitute for them — nothing here is a security boundary
// (robots.txt is advisory; a misbehaving crawler can ignore it).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/signup'],
      disallow: [
        '/api/',
        '/admin',
        '/admin/',
        '/dashboard',
        '/envelopes',
        '/history',
        '/insights',
        '/notifications',
        '/onboarding',
        '/orders',
        '/orders/',
        '/progress',
        '/savings',
        '/savings/',
        '/settings',
        '/subscription',
        '/tips',
        '/tips/',
        '/transactions',
        '/transactions/',
        '/verify-email',
        '/forgot-password',
        '/reset-password',
        '/auth/error',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
