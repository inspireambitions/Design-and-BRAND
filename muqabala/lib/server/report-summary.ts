import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildReportSummary, type ReportAnswer, type ReportSummary } from '@/lib/report-summary';

export const REPORT_ANSWER_COLUMNS =
  'question_index,question_text,transcript,feedback,scoring_status,video_path,video_duration_seconds,response_saved_at';

/**
 * Rebuilds interviews.report_summary from interview_answers for one submitted
 * interview. Service role only. Safe to repeat: it only ever copies what the
 * answers already hold.
 */
export async function refreshReportSummary(admin: SupabaseClient, interviewId: string): Promise<ReportSummary | null> {
  const { data, error } = await admin.from('interview_answers')
    .select(REPORT_ANSWER_COLUMNS)
    .eq('interview_id', interviewId)
    .order('question_index');
  if (error || !data) return null;
  const summary = buildReportSummary(data as ReportAnswer[]);
  const { error: writeError } = await admin.from('interviews')
    .update({ report_summary: summary, report_summary_at: new Date().toISOString() })
    .eq('id', interviewId)
    .not('submitted_at', 'is', null);
  return writeError ? null : summary;
}
