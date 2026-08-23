import type { Metadata } from 'next';
import { SavedReportsView } from '@/components/SavedReportsView';

export const metadata: Metadata = { title: 'My saved reports', robots: { index: false, follow: false } };
export default function ReportsPage() { return <SavedReportsView />; }
