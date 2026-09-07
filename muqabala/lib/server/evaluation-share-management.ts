import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';

export async function closeOwnedEvaluationShare(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  interviewId: string,
  employerId: string,
  shareId: string,
) {
  const { data: reports, error: reportError } = await admin.from('candidate_evaluation_reports')
    .select('id,version').eq('interview_id', interviewId).eq('employer_id', employerId);
  if (reportError || !reports?.length) return null;
  const { data: share, error } = await admin.from('evaluation_report_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId).in('report_id', reports.map((report) => report.id))
    .is('revoked_at', null).select('id,report_id').maybeSingle();
  if (error || !share) return null;
  return { reportDatabaseId: share.report_id, reportVersion: reports.find((report) => report.id === share.report_id)!.version };
}
