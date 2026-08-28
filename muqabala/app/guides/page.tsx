import type { Metadata } from 'next';
import { GuidesIndex } from '@/components/GuidesIndex';
import { sanityClient } from '@/lib/sanity/client';
import { guidesQuery, type GuideListItem } from '@/lib/sanity/queries';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Gulf interview guides',
  description: 'Practical guidance for Gulf job interviews in English and Arabic. Then practise. No employer can see your practice.',
  alternates: { canonical: '/guides' },
};

export default async function GuidesPage() {
  const guides = await sanityClient.fetch<GuideListItem[]>(guidesQuery).catch(() => []);
  return <GuidesIndex guides={guides ?? []} />;
}
