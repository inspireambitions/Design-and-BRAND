import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { coverageFor } from '@/lib/employer-volume/coverage';
import { usableReportSummary, type ReportAnswer } from '@/lib/report-summary';
import { REPORT_ANSWER_COLUMNS } from '@/lib/server/report-summary';
import type { EmployerCandidateReviewPayload } from '@/lib/employer-review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReviewInterviewRow = {
  id: string;
  screening_pack_id: string;
  candidate_name: string | null;
  role_title: string;
  submitted_at: string;
  employer_reviewed_at: string | null;
  employer_decision: string | null;
  report_summary: unknown;
  role_snapshot: { competencies?: { id: string; label: string; labelAr?: string }[] } | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in to review this interview.' }, { status: 401 });

  const client = await createClient();
  if (!client) return Response.json({ error: 'Interview storage is unavailable.' }, { status: 503 });

  const { id } = await params;
  const { data: rawInterview } = await client.from('interviews')
    .select('id,screening_pack_id,candidate_name,role_title,submitted_at,employer_reviewed_at,employer_decision,report_summary,role_snapshot')
    .eq('id', id)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  const interview = rawInterview as ReviewInterviewRow | null;
  if (!interview) return Response.json({ error: 'Interview not found.' }, { status: 404 });

  // Keep the ownership check explicit even though the database also applies RLS.
  const { data: pack } = await client.from('screening_packs')
    .select('id,workplace')
    .eq('id', interview.screening_pack_id)
    .eq('employer_id', user.id)
    .maybeSingle();
  if (!pack) return Response.json({ error: 'Interview not found.' }, { status: 404 });

  const storedSummary = usableReportSummary(interview.report_summary);
  let answers = storedSummary?.answers ?? null;
  if (!answers) {
    const { data: answerRows, error } = await client.from('interview_answers')
      .select(REPORT_ANSWER_COLUMNS)
      .eq('interview_id', interview.id)
      .order('question_index');
    if (error) return Response.json({ error: 'The answers could not be loaded.' }, { status: 503 });
    answers = (answerRows ?? []) as unknown as ReportAnswer[];
  }

  const payload: EmployerCandidateReviewPayload = {
    interviewId: interview.id,
    roleId: interview.screening_pack_id,
    displayName: interview.candidate_name?.trim() || 'Candidate',
    roleTitle: interview.role_title,
    workplace: String(pack.workplace || 'Employer'),
    submittedAt: interview.submitted_at,
    reviewedAt: interview.employer_reviewed_at,
    currentDecision: interview.employer_decision,
    coverage: coverageFor(interview.role_snapshot?.competencies, answers),
    answers: answers.map((answer) => ({
      questionIndex: answer.question_index,
      questionText: answer.question_text,
      transcript: answer.transcript,
      scoringStatus: answer.scoring_status,
      hasVideo: Boolean(answer.video_path),
      durationSeconds: answer.video_duration_seconds,
    })),
  };

  return Response.json(payload, { headers: privateNoStoreHeaders() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in to delete this interview.' }, { status: 401 });

  const client = await createClient();
  const admin = createAdminClient();
  if (!client || !admin) return Response.json({ error: 'Interview storage is unavailable.' }, { status: 503 });

  const { id } = await params;
  const { data: interview } = await client.from('interviews')
    .select('id,screening_pack_id')
    .eq('id', id)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview) return Response.json({ error: 'Interview not found.' }, { status: 404 });

  const { data: answers, error: answerError } = await admin.from('interview_answers')
    .select('video_path')
    .eq('interview_id', interview.id)
    .not('video_path', 'is', null);
  if (answerError) return Response.json({ error: 'The interview could not be deleted.' }, { status: 503 });

  const paths = (answers ?? []).map((answer) => answer.video_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from('screening-videos').remove(paths);
    if (storageError) return Response.json({ error: 'The recordings could not be deleted.' }, { status: 503 });
  }

  const { error: brainDeleteError } = await admin.from('universal_interviews')
    .delete()
    .eq('id', interview.id);
  if (brainDeleteError) return Response.json({ error: 'The interview analysis could not be deleted.' }, { status: 503 });

  const { error: deleteError } = await admin.from('interviews')
    .delete()
    .eq('id', interview.id)
    .eq('screening_pack_id', interview.screening_pack_id);
  if (deleteError) return Response.json({ error: 'The interview could not be deleted.' }, { status: 503 });

  return Response.json({ deleted: true }, { headers: privateNoStoreHeaders() });
}
