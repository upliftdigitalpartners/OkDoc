/**
 * Canonical site origin for SEO (sitemap, robots, OG, canonical URLs).
 * Priority: explicit SITE_URL → Vercel's deployment URL → localhost. Always
 * returned without a trailing slash. Used server-side only, so it's a plain
 * (non-NEXT_PUBLIC) env var and stays runtime-configurable.
 */
export function getSiteUrl(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
