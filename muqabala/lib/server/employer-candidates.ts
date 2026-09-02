import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compareCandidates, coverageFor, type Coverage } from '@/lib/employer-volume/coverage';
import { usableReportSummary, type ReportAnswer } from '@/lib/report-summary';
import { REPORT_ANSWER_COLUMNS } from '@/lib/server/report-summary';

export type RankedCandidate = {
  interviewId: string;
  inviteId: string | null;
  candidateRef: string | null;
  displayName: string;
  submittedAt: string;
  reviewedAt: string | null;
  decision: string | null;
  coverage: Coverage;
  answers: ReportAnswer[];
  roleTitle: string;
  language: 'en' | 'ar';
};

type InterviewRow = {
  id: string;
  invite_id: string | null;
  candidate_name: string | null;
  role_title: string;
  language: 'en' | 'ar';
  submitted_at: string;
  employer_reviewed_at: string | null;
  employer_decision: string | null;
  report_summary: unknown;
  role_snapshot: { competencies?: { id: string; label: string; labelAr?: string }[] } | null;
};

/**
 * Every submitted candidate for a role, ranked: full coverage first, then by
 * coverage count, then earliest submission. Works with either the employer's
 * RLS client or the admin client.
 */
export async function rankedCandidates(client: SupabaseClient, roleId: string): Promise<RankedCandidate[]> {
  const { data: rows } = await client
    .from('interviews')
    .select('id,invite_id,candidate_name,role_title,language,submitted_at,employer_reviewed_at,employer_decision,report_summary,role_snapshot')
    .eq('screening_pack_id', roleId)
    .not('submitted_at', 'is', null);
  const interviews = (rows ?? []) as InterviewRow[];
  if (interviews.length === 0) return [];

  const missingSummary = interviews.filter((row) => !usableReportSummary(row.report_summary)).map((row) => row.id);
  const liveAnswers = new Map<string, ReportAnswer[]>();
  if (missingSummary.length) {
    const { data: answerRows } = await client
      .from('interview_answers')
      .select(`interview_id,${REPORT_ANSWER_COLUMNS}`)
      .in('interview_id', missingSummary)
      .order('question_index');
    for (const row of (answerRows ?? []) as unknown as (ReportAnswer & { interview_id: string })[]) {
      const list = liveAnswers.get(row.interview_id) ?? [];
      list.push(row);
      liveAnswers.set(row.interview_id, list);
    }
  }

  const inviteIds = interviews.map((row) => row.invite_id).filter((id): id is string => Boolean(id));
  const refs = new Map<string, string>();
  if (inviteIds.length) {
    const { data: invites } = await client.from('role_invites').select('id,candidate_ref').in('id', inviteIds);
    for (const invite of invites ?? []) refs.set(invite.id as string, invite.candidate_ref as string);
  }

  return interviews
    .map((row) => {
      const summary = usableReportSummary(row.report_summary);
      const answers = summary ? summary.answers : (liveAnswers.get(row.id) ?? []);
      const candidateRef = row.invite_id ? refs.get(row.invite_id) ?? null : null;
      return {
        interviewId: row.id,
        inviteId: row.invite_id,
        candidateRef,
        displayName: row.candidate_name?.trim() || candidateRef || 'Candidate',
        submittedAt: row.submitted_at,
        reviewedAt: row.employer_reviewed_at,
        decision: row.employer_decision,
        coverage: coverageFor(row.role_snapshot?.competencies, answers),
        answers,
        roleTitle: row.role_title,
        language: row.language,
      } satisfies RankedCandidate;
    })
    .sort(compareCandidates);
}
