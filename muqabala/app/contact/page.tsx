import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Contact and support',
  description: 'Report a Muqabala problem, share interview-practice feedback or learn about personal coaching.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return <MarketingInfoPage content={infoPages.contact} />;
}
