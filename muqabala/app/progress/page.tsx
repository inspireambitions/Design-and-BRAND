import type { Metadata } from 'next';
import { ProgressView } from '@/components/ProgressView';

export const metadata: Metadata = {
  title: 'My progress',
  robots: { index: false, follow: false },
};

export default function ProgressPage() {
  return <ProgressView />;
}
