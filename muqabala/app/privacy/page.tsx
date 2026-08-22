import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'A plain-language explanation of Muqabala video, audio, transcript, browser storage and analytics data use.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <MarketingInfoPage content={infoPages.privacy} />;
}
