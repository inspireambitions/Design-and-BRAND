import type { Metadata } from 'next';
import { BlogHoldingPage } from '@/components/MarketingSite';

export const metadata: Metadata = {
  title: 'Gulf interview guides',
  description: 'Practical guidance for Gulf job interviews in English and Arabic.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  return <BlogHoldingPage />;
}
