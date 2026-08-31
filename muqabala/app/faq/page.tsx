import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Muqabala questions and answers',
  description: 'Answers about cost, privacy, Arabic practice, cameras, transcripts and how Muqabala scores interview answers.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: infoPages.faq.en.sections.map((section) => ({
      '@type': 'Question',
      name: section.title,
      acceptedAnswer: { '@type': 'Answer', text: section.body },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
      />
      <MarketingInfoPage content={infoPages.faq} />
    </>
  );
}
