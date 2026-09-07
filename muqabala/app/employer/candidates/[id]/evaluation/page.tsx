import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { EvaluationControls } from '@/components/EvaluationControls';
import { EvaluationReportView } from '@/components/EvaluationReportView';
import { DashboardDecisionActions } from '@/components/DashboardDecisionActions';
import { loadOwnedEvaluationReportVersion, recordEvaluationAccess } from '@/lib/server/evaluation-report';
import { loadEvaluationForEmployer } from '@/lib/server/evaluation-load';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import { openPrivateText } from '@/lib/server/private-data';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {
  title: 'Candidate evaluation', description: 'Private employer evidence report.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Candidate evaluation', description: 'Private employer evidence report.' },
  twitter: { card: 'summary', title: 'Candidate evaluation', description: 'Private employer evidence report.' },
};

export default async function CandidateEvaluationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/employer/candidates/${id}/evaluation`)}`);
  const client = await createClient();
  const { data: owned } = await client!.from('interviews').select('id,candidate_name,employer_decision').eq('id', id).not('submitted_at', 'is', null).maybeSingle();
  if (!owned) notFound();

  const { current, failed, legacy } = await loadEvaluationForEmployer(id, user.id);
  if (!current && legacy) {
      return <main className={styles.unavailable}><Link href="/employer"><ArrowLeft aria-hidden="true" /> Employer dashboard</Link><div><p>Candidate evaluation</p><h1>Review this earlier interview</h1><p>This interview was submitted before timestamped evaluation reports were introduced. Its saved recordings and answer review are still available. A new timestamped report will not appear by retrying this page.</p><Link href={`/employer/interviews/${id}`}>Open recordings and answer review</Link></div></main>;
  }
  if (!current) {
    return <main className={styles.unavailable}><Link href="/employer"><ArrowLeft aria-hidden="true" /> Employer dashboard</Link><div><p>Candidate evaluation</p><h1>{failed ? 'We could not open this evaluation' : 'Evaluation not yet available'}</h1><p>{failed ? 'The saved interview has not been changed. You can review the recordings while we resolve the report problem.' : 'The interview evidence is still being prepared. No incomplete report is shown.'}</p><Link href={`/employer/interviews/${id}`}>Review saved recordings</Link><p><Link href={`/employer/candidates/${id}/evaluation`}>Try the evaluation again</Link></p></div></main>;
  }

  const requestedVersion = Number((await searchParams).version);
  const viewed = Number.isInteger(requestedVersion) && requestedVersion > 0
    ? await loadOwnedEvaluationReportVersion(id, user.id, requestedVersion) ?? current
    : current;
  const viewingCurrent = viewed.report.report_version === current.report.report_version;
  const admin = createAdminClient();
  const [{ data: shareRows }, { data: versionRows }, { data: accessRows }] = await Promise.all([
    admin!.from('evaluation_report_shares').select('id,expires_at,revoked_at').eq('report_id', current.databaseId).order('created_at', { ascending: false }),
    admin!.from('candidate_evaluation_reports').select('id,version,created_at,superseded_at').eq('interview_id', id).order('version', { ascending: false }),
    admin!.from('evaluation_report_access_log').select('action,created_at,actor_user_id,viewer_email_ciphertext').eq('report_id', current.databaseId).order('created_at', { ascending: false }).limit(20),
  ]);
  await recordEvaluationAccess({ reportDatabaseId: viewed.databaseId, reportVersion: viewed.report.report_version, action: 'VIEW', actorUserId: user.id });

  return (
    <main className={styles.page}>
      <nav className={styles.nav}><Link href="/employer"><ArrowLeft aria-hidden="true" /> Employer dashboard</Link><span>Private employer view</span></nav>
      {!viewingCurrent && <div className={styles.archived}>Viewing archived version {viewed.report.report_version}. <Link href={`/employer/candidates/${id}/evaluation`}>Return to current</Link></div>}
      <EvaluationReportView report={viewed.report} interactiveEvidence />
      <section className={styles.decisionAction}>
        <div><h2>Record the hiring decision</h2><p>This unlocks the PDF and private sharing controls.</p></div>
        <DashboardDecisionActions interviewId={id} candidateLabel={owned.candidate_name || 'candidate'} currentDecision={owned.employer_decision} />
      </section>
      {viewingCurrent && <EvaluationControls
        interviewId={id}
        decisionRecorded={Boolean(current.report.decision)}
        interviewerName={current.report.interviewer_of_record}
        shares={(shareRows ?? []).map((row) => ({ id: row.id, expiresAt: row.expires_at, revokedAt: row.revoked_at }))}
      />}
      <section className={styles.audit}>
        <div><h2>Versions</h2><ul>{(versionRows ?? []).map((row) => <li key={row.id}><Link href={`/employer/candidates/${id}/evaluation?version=${row.version}`}>Version {row.version}</Link> · {new Date(row.created_at).toLocaleString('en-GB')}{row.superseded_at ? ' · Archived' : ' · Current'}</li>)}</ul></div>
        <div><h2>Recent access</h2><ul>{(accessRows ?? []).map((row, index) => {
          let viewer = '';
          if (row.viewer_email_ciphertext) {
            try { viewer = ` · ${openPrivateText(row.viewer_email_ciphertext)}`; } catch { viewer = ' · verified viewer'; }
          }
          return <li key={`${row.created_at}-${index}`}>{String(row.action).toLocaleLowerCase().replace('_', ' ')}{viewer} · {new Date(row.created_at).toLocaleString('en-GB')}</li>;
        })}</ul></div>
      </section>
    </main>
  );
}
