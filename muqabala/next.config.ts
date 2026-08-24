import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const baseline = [
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
};

export default nextConfig;
