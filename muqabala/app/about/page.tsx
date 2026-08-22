import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'About Muqabala',
  description: 'Why Inspire Ambitions created a private, candidate-first interview practice coach for Gulf jobs.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <MarketingInfoPage content={infoPages.about} />;
}
