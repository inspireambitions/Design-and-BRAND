import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Terms for using Muqabala as an AI-supported Gulf interview practice tool.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <MarketingInfoPage content={infoPages.terms} />;
}
