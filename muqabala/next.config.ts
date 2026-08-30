import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const posthogOrigin = origin(process.env.NEXT_PUBLIC_POSTHOG_HOST) ?? 'https://eu.i.posthog.com';
const supabaseOrigin = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseSocketOrigin = supabaseOrigin?.replace(/^http/, 'ws') ?? null;
const sentryOrigin = origin(process.env.SENTRY_DSN);
const connectSources = [
  "'self'",
  posthogOrigin,
  'https://eu-assets.i.posthog.com',
  supabaseOrigin,
  supabaseSocketOrigin,
  sentryOrigin,
  'https://*.api.sanity.io',
  'https://*.apicdn.sanity.io',
  ...(isDevelopment ? ['ws:', 'http:'] : []),
].filter((value): value is string => Boolean(value));

// Static App Router pages need Next's small inline bootstrap scripts. The
// policy still blocks third-party scripts and every inline event handler. Move
// to per-request nonces only if the whole marketing site becomes dynamic.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.sanity.io",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  `media-src 'self' blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(!isDevelopment ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const baseline = [
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
    ];
    return [
      { source: '/:path*', headers: baseline },
      {
        source: '/share/:path*',
        headers: [
          ...baseline.filter((header) => header.key !== 'Referrer-Policy'),
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/blog', destination: '/guides', permanent: true },
      { source: '/blog/:path*', destination: '/guides/:path*', permanent: true },
      { source: '/articles', destination: '/guides', permanent: true },
      { source: '/articles/:path*', destination: '/guides/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
