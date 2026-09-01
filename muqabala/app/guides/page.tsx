import type { Metadata } from 'next';
import { GuidesIndex } from '@/components/GuidesIndex';
import { sanityClient } from '@/lib/sanity/client';
import { guidesQuery, type GuideListItem } from '@/lib/sanity/queries';

// Static between edits. Sanity calls /api/revalidate when a guide changes;
// the daily revalidation is only a safety net if a webhook is ever missed.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Gulf interview guides',
  description: 'Practical guidance for Gulf job interviews in English and Arabic. Then practise. No employer can see your practice.',
  alternates: { canonical: '/guides' },
};

export default async function GuidesPage() {
  const guides = await sanityClient.fetch<GuideListItem[]>(guidesQuery).catch(() => []);
  return <GuidesIndex guides={guides ?? []} />;
}
