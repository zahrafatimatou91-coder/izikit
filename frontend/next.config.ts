import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Static security headers applied to every response.
// Set via next.config.ts (not middleware.ts) so Vercel's edge can serve them
// from the CDN cache without invoking a function — zero per-request latency.
//
// CSP is intentionally NOT included here. App Router pages need a per-request
// nonce (server-rendered) for inline scripts; ship CSP via middleware.ts when
// the first frontend page lands. For now, the API-only surface doesn't render
// HTML and doesn't need CSP.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const config: NextConfig = {
  reactStrictMode: true,
  // Next's own dev-mode indicator badge (route info / build errors) sits
  // bottom-left by default — on a narrow mobile viewport that's exactly
  // where BottomNav's first tab lives, which read as an app bug in
  // testing (it isn't; this badge never ships to production). Moved out
  // of the way instead of leaving it to collide with app UI during dev.
  devIndicators: {
    position: 'top-right',
  },
  // Standalone output bundles a self-contained server.js + minimal node_modules
  // into .next/standalone — required by the Docker runtime image (frontend/Dockerfile).
  // Has no impact on `next dev` / `next start` workflows.
  output: 'standalone',
  // Every authenticated page is a 'use client' component reading live,
  // per-user financial data (budget/envelopes/transactions) via its own
  // useEffect + fetch — never safe to serve from Next's client-side Router
  // Cache. Without this, navigating dashboard -> envelopes -> dashboard
  // within the cache window can flash the PREVIOUS render's stale state
  // before the page's own effect refetches and replaces it. Explicit 0
  // (rather than relying on the framework default) so a future Next
  // upgrade can't silently reintroduce stale-financial-data flashes.
  // `static` is left at the framework default (300s) — Next enforces a
  // 30s floor on this field (0 is rejected as invalid config, which was
  // breaking `next dev` startup entirely), and none of this app's pages
  // are eligible for static rendering anyway (all client-side auth-gated).
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

// Sentry build-time wrapper. Uploads source maps when SENTRY_AUTH_TOKEN +
// SENTRY_ORG + SENTRY_PROJECT are present (typically only in CI). Without
// those env vars the wrapper still works — it just skips the upload step.
// silent:true keeps the build log clean when nothing is configured.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Tunnel client requests through a Next.js route to bypass ad-blockers
  // that filter direct Sentry calls. Off by default — turn on if your
  // user base has heavy ad-blocker usage.
  // tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
});
