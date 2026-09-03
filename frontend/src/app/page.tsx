// Server component wrapper — the only reason this file exists separately
// from HomeClient.tsx. Next.js's Metadata API (the `metadata` export
// below) is only available on Server Components; the actual landing page
// markup is a `'use client'` component (it reads auth state via
// useAuth() to swap the nav CTA), which cannot export `metadata` itself.
// Splitting it this way changes zero rendered output — same component,
// same props, same DOM — it only adds a title/description/Open
// Graph/Twitter Card specific to this page instead of falling back to
// the root layout's generic app-wide defaults.
import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from '@/lib/seo';

const TITLE = 'Budget par enveloppes pour étudiants africains';

export const metadata: Metadata = {
  // Next.js's `title.template` on the root layout does NOT apply to the
  // root page's own title (same route segment — only *child* segments
  // inherit the template), so the brand name is spelled out explicitly
  // here rather than relying on the template to append it.
  title: `${SITE_NAME} — ${TITLE}`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: `${SITE_NAME} — ${TITLE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${TITLE}`,
    description: SITE_DESCRIPTION,
  },
};

// schema.org structured data — SoftwareApplication is the closest fit for
// a budgeting web app (vs. Organization, which undersells what the
// product does, or WebSite, which says nothing about it being an app).
// Static + hand-authored, never built from user input, so inlining it as
// a script tag carries no injection risk.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'XOF',
  },
};

export default function Home() {
  return (
    <>
      {/* Static, hand-authored JSON — never built from user input. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <HomeClient />
    </>
  );
}
