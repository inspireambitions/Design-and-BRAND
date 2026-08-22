import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Muqabala questions and answers',
  description: 'Answers about cost, privacy, Arabic practice, cameras, transcripts and how Muqabala scores interview answers.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return <MarketingInfoPage content={infoPages.faq} />;
}
