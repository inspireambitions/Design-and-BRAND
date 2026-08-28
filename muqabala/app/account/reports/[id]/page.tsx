import { notFound, redirect } from 'next/navigation';
import { FullReport, type FullReportData } from '@/components/FullReport';
import { ReportActions } from '@/components/ReportActions';
import { TopBar } from '@/components/TopBar';
import { reportProjection, type StoredAnswer, type StoredInterview } from '@/lib/interviews';
import { createClient, currentUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/account/reports/${id}`)}`);
  const client = await createClient();
  const [{ data: interview }, { data: answers }, { data: shares }] = await Promise.all([
    client!.from('interviews').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
    client!.from('interview_answers').select('question_index,question_id,question_text,transcript,feedback,scoring_status').eq('interview_id', id).order('question_index'),
    client!.from('report_shares').select('id,expires_at').eq('interview_id', id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
  ]);
  if (!interview) notFound();
  const report = {
    ...(reportProjection(interview as StoredInterview, (answers ?? []) as StoredAnswer[], true) as FullReportData),
    allowRescore: true,
  };
  return <main className="shell shell-narrow" lang={report.language} dir={report.language === 'ar' ? 'rtl' : 'ltr'}><TopBar showProgressLink={false} /><FullReport report={report} /><ReportActions interviewId={id} roleId={report.roleId} roleTitle={report.roleTitle} language={report.language} initialShares={shares ?? []} initialSaved={Boolean(interview.saved)} /></main>;
}
