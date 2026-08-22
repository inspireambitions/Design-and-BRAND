import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'How Muqabala works',
  description: 'Choose a Gulf job, speak or type your answer, check the words and get clear feedback.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  return <MarketingInfoPage content={infoPages['how-it-works']} />;
}
