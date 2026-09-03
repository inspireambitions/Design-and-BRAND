import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  CandidateEvaluationReportSchema,
  REPORT_FORMAT_VERSION,
  REPORT_PIPELINE_VERSION,
  bandFromEvidence,
  type CandidateEvaluationReport,
  type StoredEvidenceRecord,
} from '@/lib/evaluation-report';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStoredInterviewForReporting } from '@/lib/universal-interview/repository';
import type { ExperienceLevel } from '@/lib/universal-interview/types';
import { generateEvidenceLines, generateFollowupQuestion } from './evaluation-report-language';

type ReportRow = {
  id: string;
  report_id: string;
  version: number;
  payload: unknown;
  employer_id: string;
  created_at: string;
};

type DecisionRow = {
  decision: 'shortlist' | 'pass' | 'later';
  reviewer_id: string;
  created_at: string;
};

function personName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const metadata = user?.user_metadata ?? {};
  const value = metadata.full_name || metadata.name || metadata.display_name;
  if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim().slice(0, 100);
  const emailName = user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName ? emailName.slice(0, 100) : 'Hiring team';
}

function seniorityLabel(value: ExperienceLevel): string {
  return value.split('_').map((part) => `${part[0]}${part.slice(1).toLowerCase()}`).join(' ');
}

async function decisionForReport(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  interviewId: string,
): Promise<CandidateEvaluationReport['decision']> {
  const { data } = await admin.from('employer_decisions')
    .select('decision,reviewer_id,created_at')
    .eq('interview_id', interviewId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DecisionRow>();
  if (!data) return null;
  const { data: reviewer } = await admin.auth.admin.getUserById(data.reviewer_id);
  const outcome = data.decision === 'shortlist' ? 'SHORTLIST' : data.decision === 'pass' ? 'PASS' : 'HOLD';
  return {
    outcome,
    decided_by_id: data.reviewer_id,
    decided_by_name: personName(reviewer.user),
    decided_at: data.created_at,
  };
}

async function notesForReport(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  reportDatabaseId: string,
): Promise<CandidateEvaluationReport['employer_notes']> {
  const { data } = await admin.from('evaluation_report_notes')
    .select('author_id,author_name,note_text,created_at')
    .eq('report_id', reportDatabaseId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((note) => ({
    author_id: note.author_id,
    author_name: note.author_name,
    created_at: note.created_at,
    text: note.note_text,
  }));
}

export async function hydrateEvaluationReport(row: ReportRow): Promise<CandidateEvaluationReport | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const parsed = CandidateEvaluationReportSchema.safeParse(row.payload);
  if (!parsed.success) {
    console.warn('evaluation_report_payload_invalid', { reportId: row.report_id });
    return null;
  }
  const [notes, decision] = await Promise.all([
    notesForReport(admin, row.id),
    decisionForReport(admin, parsed.data.interview_id),
  ]);
  return CandidateEvaluationReportSchema.parse({ ...parsed.data, employer_notes: notes, decision });
}

export async function loadCurrentEvaluationReport(interviewId: string): Promise<{ databaseId: string; report: CandidateEvaluationReport } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from('candidate_evaluation_reports')
    .select('id,report_id,version,payload,employer_id,created_at')
    .eq('interview_id', interviewId)
    .is('superseded_at', null)
    .maybeSingle<ReportRow>();
  if (!data) return null;
  const report = await hydrateEvaluationReport(data);
  return report ? { databaseId: data.id, report } : null;
}

export async function loadOwnedEvaluationReport(interviewId: string, employerId: string) {
  const current = await loadCurrentEvaluationReport(interviewId);
  return current?.report.employer_id === employerId ? current : null;
}

export async function loadOwnedEvaluationReportVersion(interviewId: string, employerId: string, version: number) {
  const admin = createAdminClient();
  if (!admin || !Number.isInteger(version) || version < 1 || version > 100) return null;
  const { data } = await admin.from('candidate_evaluation_reports')
    .select('id,report_id,version,payload,employer_id,created_at')
    .eq('interview_id', interviewId)
    .eq('employer_id', employerId)
    .eq('version', version)
    .maybeSingle<ReportRow>();
  if (!data) return null;
  const report = await hydrateEvaluationReport(data);
  return report ? { databaseId: data.id, report } : null;
}

export async function recordEvaluationAccess(input: {
  reportDatabaseId: string;
  reportVersion: number;
  action: 'VIEW' | 'DOWNLOAD' | 'SHARE_CREATED' | 'SHARE_REVOKED';
  actorUserId?: string | null;
  viewerEmailHash?: string | null;
  viewerEmailCiphertext?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.from('evaluation_report_access_log').insert({
    report_id: input.reportDatabaseId,
    report_version: input.reportVersion,
    action: input.action,
    actor_user_id: input.actorUserId ?? null,
    viewer_email_hash: input.viewerEmailHash ?? null,
    viewer_email_ciphertext: input.viewerEmailCiphertext ?? null,
  });
  if (error) console.warn('evaluation_access_log_failed', { code: error.code, action: input.action });
}

export async function generateCandidateEvaluationReport(
  interviewId: string,
  options: { force?: boolean; generatedBy?: string } = {},
): Promise<CandidateEvaluationReport | null> {
  const existing = await loadCurrentEvaluationReport(interviewId);
  if (existing && !options.force) return existing.report;
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: interview } = await admin.from('interviews')
    .select('id,candidate_user_id,candidate_name,role_id,role_title,screening_pack_id,submitted_at,question_snapshot')
    .eq('id', interviewId)
    .eq('mode', 'screening')
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview?.candidate_user_id || !interview.screening_pack_id || !interview.submitted_at) return null;

  const [{ data: pack }, { data: answers }, { data: rawEvidence }, { data: versionRows }, state] = await Promise.all([
    admin.from('screening_packs').select('id,employer_id,workplace').eq('id', interview.screening_pack_id).maybeSingle(),
    admin.from('interview_answers')
      .select('id,question_index,video_duration_seconds,transcript_timing_version,scoring_status')
      .eq('interview_id', interviewId)
      .order('question_index'),
    admin.from('interview_evidence_records')
      .select('id,competency_id,transcript_span,question_index,start_ms,end_ms,evidence_strength,criterion_results')
      .eq('interview_id', interviewId)
      .order('question_index'),
    admin.from('candidate_evaluation_reports').select('version').eq('interview_id', interviewId).order('version', { ascending: false }).limit(1),
    loadStoredInterviewForReporting(interviewId),
  ]);
  if (!pack?.employer_id || !state?.screening || state.screening.pack_id !== interview.screening_pack_id) return null;
  if (
    !answers?.length
    || state.status !== 'COMPLETE'
    || state.screening.processed_answer_count !== answers.length
    || !answers.every((answer) => answer.transcript_timing_version === 'openai-whisper-segment-v1')
    || !answers.every((answer) => answer.scoring_status === 'scored' || answer.scoring_status === 'unscored')
  ) {
    console.warn('evaluation_report_waiting_for_timed_answers', { interviewId });
    return null;
  }

  const durationByQuestion = new Map((answers ?? []).map((answer) => [
    answer.question_index as number,
    Number(answer.video_duration_seconds ?? 0),
  ]));
  const evidence: StoredEvidenceRecord[] = (rawEvidence ?? []).map((record) => ({
    id: record.id,
    competency_id: record.competency_id,
    transcript_span: record.transcript_span,
    question_index: record.question_index,
    start_ms: record.start_ms,
    end_ms: record.end_ms,
    recording_duration_seconds: durationByQuestion.get(record.question_index) ?? 0,
    evidence_strength: record.evidence_strength,
    criterion_results: record.criterion_results as Record<string, unknown>,
  }));

  const competencies = await Promise.all(state.blueprint.slice(0, 8).map(async (competency, index) => {
    const records = evidence.filter((record) => record.competency_id === competency.id).slice(0, 3);
    const band = bandFromEvidence(records);
    const { lines } = await generateEvidenceLines(competency.name, records);
    const followup = band === 'EVIDENCE_FOUND'
      ? null
      : await generateFollowupQuestion(competency.name, lines, state.seniority);
    return {
      competency_id: competency.id,
      name: competency.name,
      rubric_order: index + 1,
      band,
      evidence_lines: lines,
      followup_question: followup,
    };
  }));

  const [{ data: employer }, decision] = await Promise.all([
    admin.auth.admin.getUserById(pack.employer_id),
    decisionForReport(admin, interviewId),
  ]);
  const now = new Date();
  const reportVersion = Number(versionRows?.[0]?.version ?? 0) + 1;
  const report = CandidateEvaluationReportSchema.parse({
    report_id: `EVAL-${now.getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
    report_format_version: REPORT_FORMAT_VERSION,
    report_version: reportVersion,
    rubric_version: state.prompt_version,
    interview_id: interviewId,
    candidate_id: interview.candidate_user_id,
    candidate_name: interview.candidate_name || 'Candidate',
    role_id: interview.role_id,
    role_title: interview.role_title,
    workplace: pack.workplace || 'Hiring team',
    employer_id: pack.employer_id,
    interviewer_of_record: personName(employer.user),
    interview_datetime: interview.submitted_at,
    duration_seconds: (answers ?? []).reduce((total, answer) => total + Number(answer.video_duration_seconds ?? 0), 0),
    question_count: answers.length,
    seniority_band: seniorityLabel(state.seniority),
    competencies,
    employer_notes: [],
    decision,
    generated_at: now.toISOString(),
    generated_by_pipeline_version: REPORT_PIPELINE_VERSION,
  });

  const { data: storedId, error } = await admin.rpc('store_candidate_evaluation_report', {
    p_report_id: report.report_id,
    p_interview_id: interviewId,
    p_employer_id: pack.employer_id,
    p_version: report.report_version,
    p_payload: report,
    p_pipeline_version: REPORT_PIPELINE_VERSION,
    p_rubric_version: state.prompt_version,
    p_generated_by: options.generatedBy ?? null,
  });
  if (!error && typeof storedId === 'string') return report;
  if (!error || error.code === '23505') return (await loadCurrentEvaluationReport(interviewId))?.report ?? null;
  console.warn('evaluation_report_store_failed', { interviewId, code: error.code });
  return null;
}
