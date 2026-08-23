import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClaimReportView } from '@/components/ClaimReportView';

export const metadata: Metadata = {
  title: 'Saving report',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ClaimReportPage() { return <Suspense><ClaimReportView /></Suspense>; }
