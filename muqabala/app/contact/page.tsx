import type { Metadata } from 'next';
import { ContactPageContent } from '@/components/ContactPage';

export const metadata: Metadata = {
  title: 'Contact Muqabala',
  description: 'Contact Muqabala for product enquiries, technical support, feedback, coaching and partnerships.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Muqabala',
    description: 'Product enquiries, technical support, feedback, coaching and partnerships.',
    url: '/contact',
  },
  twitter: {
    card: 'summary',
    title: 'Contact Muqabala',
    description: 'Product enquiries, technical support, feedback, coaching and partnerships.',
  },
};

export default function ContactPage() {
  return <ContactPageContent />;
}
