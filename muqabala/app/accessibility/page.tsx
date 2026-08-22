import type { Metadata } from 'next';
import { MarketingInfoPage } from '@/components/MarketingSite';
import { infoPages } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'How Muqabala supports keyboard, camera-free, reduced-motion and mobile interview practice.',
  alternates: { canonical: '/accessibility' },
};

export default function AccessibilityPage() {
  return <MarketingInfoPage content={infoPages.accessibility} />;
}
