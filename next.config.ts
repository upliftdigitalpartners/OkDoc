import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/*
 * Content-Security-Policy for OkDoc. The app loads no external scripts,
 * fonts, or images and makes no client-side cross-origin fetches (all data
 * access is server-side), so the policy is tight:
 *  - script-src 'unsafe-inline': Next's App Router emits inline hydration
 *    scripts and our pages are statically generated, so per-request nonces
 *    aren't viable. 'self' still blocks any external script. (A nonce-based
 *    policy is a future hardening step if pages move to dynamic rendering.)
 *  - 'unsafe-eval' is intentionally omitted (only dev/Turbopack needs it).
 *  - connect-src 'self': no client-side calls to Supabase/payers/etc.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Origin only cross-origin → never leaks the results URL's plan/specialty/
  // ZIP params to Google Maps etc. (the directions link is also noreferrer).
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
