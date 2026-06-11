import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Results pages are per-search app state (infinite param combos), not
      // content — keep them out of the index.
      disallow: ['/api/', '/*/results'],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
