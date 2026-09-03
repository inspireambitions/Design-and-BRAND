import type { Metadata } from 'next';
import { EvaluationReportView } from '@/components/EvaluationReportView';
import { ShareEmailGate } from '@/components/ShareEmailGate';
import { currentEvaluationShareViewer, loadEvaluationShare, logEvaluationShareOpen } from '@/lib/server/evaluation-share';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {
  title: 'Private candidate report', description: 'A private stored evidence report.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Private candidate report', description: 'A private stored evidence report.' },
  twitter: { card: 'summary', title: 'Private candidate report', description: 'A private stored evidence report.' },
};

export default async function EvaluationSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await loadEvaluationShare(token);
  if (state.status !== 'ok') {
    return <main className={styles.closed}><div><p>Private Muqabala report</p><h1>{state.status === 'closed' ? 'This link is closed' : 'Report not available'}</h1><span>Ask the hiring team for a new private link.</span></div></main>;
  }
  const viewer = await currentEvaluationShareViewer(state);
  if (!viewer) return <ShareEmailGate token={token} employer={state.report.workplace} />;
  await logEvaluationShareOpen(state, viewer.viewerEmailHash);
  return <main className={styles.page}><div className={styles.readOnly}>View only · Open until {new Date(state.expiresAt).toLocaleDateString('en-GB')}</div><EvaluationReportView report={state.report} /></main>;
}
