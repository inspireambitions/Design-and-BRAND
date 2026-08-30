import type { MetadataRoute } from 'next';
import { sanityClient } from '@/lib/sanity/client';
import { guidesQuery, type GuideListItem } from '@/lib/sanity/queries';
import { ROLES } from '@/lib/roles';

const pages = [
  '',
  '/practice',
  '/guides',
  '/how-it-works',
  '/how-feedback-works',
  '/interview-roles',
  '/about',
  '/faq',
  '/privacy',
  '/terms',
  '/contact',
  '/accessibility',
  '/for-employers',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = pages.map((path, index) => ({
    url: `https://trymuqabala.com${path}`,
    changeFrequency: index < 3 ? 'weekly' : 'monthly',
    priority: index === 0 ? 1 : index === 1 ? 0.9 : index === 2 ? 0.8 : 0.7,
  }));

  const guides = await sanityClient.fetch<GuideListItem[]>(guidesQuery).catch(() => []);
  const guidePages: MetadataRoute.Sitemap = (guides ?? []).map((guide) => ({
    url: `https://trymuqabala.com/guides/${guide.slug}`,
    lastModified: guide.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));

  const rolePages: MetadataRoute.Sitemap = ROLES.map((role) => ({
    url: `https://trymuqabala.com/practice/${role.id}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticPages, ...rolePages, ...guidePages];
}
