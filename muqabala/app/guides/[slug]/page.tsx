import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuidePage } from '@/components/GuidePage';
import { sanityClient } from '@/lib/sanity/client';
import { guideBySlugQuery, guidesQuery, type GuideDocument, type GuideListItem } from '@/lib/sanity/queries';

export const revalidate = 60;

function safeJsonLd(raw: string): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw)).replace(/</g, '\\u003c');
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  const guides = await sanityClient.fetch<GuideListItem[]>(guidesQuery).catch(() => []);
  return (guides ?? []).map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await sanityClient.fetch<GuideDocument | null>(guideBySlugQuery, { slug }).catch(() => null);
  if (!guide) return { title: 'Guide' };
  return {
    title: guide.title,
    description: guide.metaDescription || guide.excerpt || 'A Gulf interview guide from Muqabala.',
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: guide.heroImageUrl ? { images: [{ url: guide.heroImageUrl }] } : undefined,
  };
}

export default async function GuideSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const guide = await sanityClient.fetch<GuideDocument | null>(guideBySlugQuery, { slug }).catch(() => null);
  if (!guide) notFound();
  const articleJsonLd = safeJsonLd(guide.jsonLdRaw);
  const faqJsonLd = safeJsonLd(guide.faqJsonLdRaw);
  return (
    <>
      {articleJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd }} />}
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />}
      <GuidePage guide={guide} />
    </>
  );
}
