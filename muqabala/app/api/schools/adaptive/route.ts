import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { touchSchoolsSession } from '@/lib/schools/session';
import {
  getOrCreateAdaptiveAssignmentSession,
  submitAdaptiveAssignmentTurn,
  finalizeAdaptiveAssignmentSubmission,
} from '@/lib/schools/adaptive-adapter';

export const runtime = 'nodejs';
export const maxDuration = 45;

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('get_or_create'),
    payload: z.object({
      assignmentId: z.string().uuid(),
      studentProfile: z.object({
        experience_level: z.enum(['ENTRY', 'PROFESSIONAL', 'MANAGER', 'SENIOR_MANAGER', 'EXECUTIVE']).optional(),
        years_experience: z.number().nonnegative().optional(),
        current_or_previous_role: z.string().optional(),
        academic_field: z.string().optional(),
        qualification: z.string().optional(),
        academic_stage: z.string().optional(),
        project_highlight: z.string().optional(),
        evidence_sources: z.array(z.enum(['EMPLOYMENT', 'INTERNSHIP', 'ACADEMIC', 'VOLUNTEER', 'PERSONAL_PROJECT', 'HYPOTHETICAL'])).optional(),
        career_change: z.boolean().optional(),
        management_experience: z.boolean().optional(),
      }).optional(),
      retry: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    action: z.literal('submit_turn'),
    payload: z.object({
      attemptId: z.string().uuid(),
      answerText: z.string().min(1).max(12000),
    }).strict(),
  }),
  z.object({
    action: z.literal('finalize'),
    payload: z.object({
      attemptId: z.string().uuid(),
    }).strict(),
  }),
]);

export async function POST(request: Request) {
  const unavailable = schoolsUnavailable();
  if (unavailable) return unavailable;
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Request not allowed' }, { status: 403 });

  const client = await createClient();
  if (!client) return Response.json({ error: 'Service unavailable' }, { status: 503 });

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return Response.json({ error: 'Sign in again to continue.' }, { status: 401 });

  if (!await touchSchoolsSession(client)) return Response.json({ error: 'Your session ended. Sign in again.' }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Check your request payload.' }, { status: 400 });
  }

  const studentUserId = authData.user.id;

  try {
    if (parsed.data.action === 'get_or_create') {
      const session = await getOrCreateAdaptiveAssignmentSession({
        assignmentId: parsed.data.payload.assignmentId,
        studentUserId,
        studentProfile: parsed.data.payload.studentProfile,
        retry: parsed.data.payload.retry,
      });

      return Response.json({
        result: {
          attemptId: session.attemptId,
          universalInterviewId: session.universalInterviewId,
          attemptNumber: session.attemptNumber,
          status: session.status,
          questionNumber: session.state.question_number,
          totalQuestions: session.canonicalQuestions.length,
          currentQuestion: session.state.current_question ? {
            text: session.state.current_question.candidate_text,
            kind: session.state.current_question.kind,
            interviewerIntent: session.state.current_question.interviewer_intent,
          } : null,
          probeCount: session.state.probe_count_current,
          completed: session.state.phase === 'COMPLETE',
        },
      }, { headers: privateNoStoreHeaders() });
    }

    if (parsed.data.action === 'submit_turn') {
      const result = await submitAdaptiveAssignmentTurn({
        attemptId: parsed.data.payload.attemptId,
        studentUserId,
        answerText: parsed.data.payload.answerText,
      });

      return Response.json({
        result: {
          attemptId: result.attemptId,
          questionNumber: result.state.question_number,
          totalQuestions: result.state.plan.length,
          currentQuestion: result.state.current_question ? {
            text: result.state.current_question.candidate_text,
            kind: result.state.current_question.kind,
            interviewerIntent: result.state.current_question.interviewer_intent,
          } : null,
          action: result.action,
          probeCount: result.state.probe_count_current,
          completed: result.completed,
          evidenceCount: result.state.evidence_ledger.length,
        },
      }, { headers: privateNoStoreHeaders() });
    }

    if (parsed.data.action === 'finalize') {
      await finalizeAdaptiveAssignmentSubmission({
        attemptId: parsed.data.payload.attemptId,
        studentUserId,
      });

      return Response.json({ result: { success: true } }, { headers: privateNoStoreHeaders() });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
