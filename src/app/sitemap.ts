import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';
import { getSiteUrl } from '@/lib/site';

/**
 * Indexable entry points only: the localized language picker (/{locale}) and
 * the first wizard step (/{locale}/location). Each entry advertises every
 * locale as an hreflang alternate, with English as x-default.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const paths = ['', '/location'];

  return locales.flatMap((locale) =>
    paths.map((path) => ({
      url: `${site}/${locale}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
      alternates: {
        languages: {
          ...Object.fromEntries(
            locales.map((l) => [l, `${site}/${l}${path}`]),
          ),
          'x-default': `${site}/en${path}`,
        },
      },
    })),
  );
}
