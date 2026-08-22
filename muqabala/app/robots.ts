import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/progress'],
    },
    sitemap: 'https://trymuqabala.com/sitemap.xml',
    host: 'https://trymuqabala.com',
  };
}
