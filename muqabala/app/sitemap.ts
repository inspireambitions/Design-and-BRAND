import type { MetadataRoute } from 'next';

const pages = [
  '',
  '/practice',
  '/how-it-works',
  '/how-feedback-works',
  '/interview-roles',
  '/about',
  '/faq',
  '/privacy',
  '/terms',
  '/contact',
  '/accessibility',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path, index) => ({
    url: `https://trymuqabala.com${path}`,
    changeFrequency: index < 2 ? 'weekly' : 'monthly',
    priority: index === 0 ? 1 : index === 1 ? 0.9 : 0.7,
  }));
}
