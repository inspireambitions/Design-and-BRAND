import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/employer/candidates/[id]/evaluation/pdf': [
      './node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',
      './node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',
    ],
  },
  async headers() {
    const baseline = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
    ];
    // The HTML links to these with a content hash in the query string
    // (for example /icon.svg?icon.abc123.svg), so a long immutable lifetime is
    // safe: a new image gets a new URL. There is no public/ folder.
    const immutable = { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' };
    return [
      { source: '/:path*', headers: baseline },
      { source: '/icon.svg', headers: [immutable] },
      { source: '/opengraph-image', headers: [immutable] },
      { source: '/twitter-image', headers: [immutable] },
      { source: '/for-employers/opengraph-image', headers: [immutable] },
      { source: '/for-employers/twitter-image', headers: [immutable] },
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
