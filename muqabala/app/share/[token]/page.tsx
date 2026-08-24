import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FullReport, type FullReportData } from '@/components/FullReport';
import { TopBar } from '@/components/TopBar';
import { reportProjection, type StoredAnswer, type StoredInterview } from '@/lib/interviews';
import { t } from '@/lib/i18n';
import { tokenHash } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();
  const { data: share } = await admin.from('report_shares').select('interview_id,expires_at,revoked_at')
    .eq('token_hash', tokenHash(token)).maybeSingle();
  if (!share || share.revoked_at || Date.parse(share.expires_at) <= Date.now()) notFound();
  const [{ data: interview }, { data: answers }] = await Promise.all([
    admin.from('interviews').select('*').eq('id', share.interview_id).maybeSingle(),
    admin.from('interview_answers').select('question_index,question_id,question_text,transcript,feedback,scoring_status').eq('interview_id', share.interview_id).order('question_index'),
  ]);
  if (!interview) notFound();
  const report = reportProjection(interview as StoredInterview, (answers ?? []) as StoredAnswer[], true) as FullReportData;
  const expiry = new Date(share.expires_at).toLocaleDateString(report.language === 'ar' ? 'ar-AE' : 'en-GB');
  return <main className="shell shell-narrow" lang={report.language} dir={report.language === 'ar' ? 'rtl' : 'ltr'}><TopBar showProgressLink={false} /><p className="notice tiny">{t(report.language, 'shareExpiresOn')} {expiry}.</p><FullReport report={report} /></main>;
}
