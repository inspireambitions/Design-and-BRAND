import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { EvaluationReportView } from '@/components/EvaluationReportView';
import { sampleEvaluationReport } from '@/lib/fixtures/evaluation-report';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Sample candidate evaluation',
  description: 'A fictional Muqabala stored evidence report.',
  openGraph: { title: 'Sample candidate evaluation', description: 'A fictional Muqabala stored evidence report.' },
  twitter: { card: 'summary', title: 'Sample candidate evaluation', description: 'A fictional Muqabala stored evidence report.' },
};

export default function SampleEvaluationReportPage() {
  return <main className={styles.page}><nav><Link href="/for-employers"><ArrowLeft aria-hidden="true" /> For employers</Link><span>Fictional data</span></nav><EvaluationReportView report={sampleEvaluationReport} sample /></main>;
}
