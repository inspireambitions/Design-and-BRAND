import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'How Muqabala feedback works',
  description: 'Learn how Muqabala scores the evidence in an interview answer and what it never assesses.',
  alternates: { canonical: '/how-feedback-works' },
};

export default function HowFeedbackWorksPage() {
  return <MarketingInfoPage content={infoPages['how-feedback-works']} />;
}
