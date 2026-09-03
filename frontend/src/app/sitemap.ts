import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Kept intentionally to the single page actually worth indexing today —
// see robots.ts for why every authenticated route is excluded. Add an
// entry here (and to robots.ts's `allow` list) if a fork adds real public
// content later (a blog, a public pricing page, legal pages, …).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
