import 'server-only';

import { createAdminClient } from '../supabase/admin.ts';
import { createInterviewState, activateInterview } from '../universal-interview/engine.ts';
import { processUniversalTurn } from '../universal-interview/process-turn.ts';
import { sealInterviewState, openInterviewState } from '../universal-interview/crypto.ts';
import { makeBankQuestion } from '../universal-interview/questions.ts';
import type {
  CandidateProfile,
  DiscoveredCompetency,
  InterviewState,
  RolePack,
  TurnAction,
} from '../universal-interview/types.ts';
import { PROMPT_VERSION } from '../universal-interview/types.ts';
import { newOpaqueToken, tokenHash } from '../server/security.ts';
import {
  CanonicalQuestionData,
  buildAdaptivePlanFromCanonical,
} from './types.ts';

export type { CanonicalQuestionData };

export type AdaptiveAssignmentSession = {
  attemptId: string;
  universalInterviewId: string;
  assignmentId: string;
  studentUserId: string;
  deliveryMode: 'adaptive_v2';
  state: InterviewState;
  status: 'draft' | 'submitted';
  attemptNumber: number;
  canonicalQuestions: CanonicalQuestionData[];
};

function buildRolePackFromQuestions(
  roleTitle: string,
  canonicalQuestions: CanonicalQuestionData[],
  competencies: string[],
): RolePack {
  const compIds = competencies.length > 0
    ? competencies.map((c) => 'c_' + c.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30))
    : canonicalQuestions.map((_, i) => `c_canonical_${i + 1}`);

  return {
    role: roleTitle || 'Professional Role',
    version: '1.0',
    author: 'Institutional Educator',
    reviewed_by: null,
    reviewed_at: null,
    implicit_competencies: compIds.slice(0, 2),
    core_competencies: compIds,
    question_bank: canonicalQuestions.map((q, idx) => ({
      ...makeBankQuestion({
        question_id: `canonical_${idx + 1}`,
        candidate_text: q.questionText,
        interviewer_intent: `Evaluate canonical assignment criterion: ${q.rubric[0]?.label || 'core competence'}`,
        probe_targets: q.rubric.map((r) => r.id),
        question_type: idx === 0 ? 'INTRODUCTION' : 'BEHAVIOURAL',
        target_competencies: [compIds[idx % compIds.length] || `c_canonical_${idx + 1}`],
        seniority: 'ENTRY',
        kind: 'MAIN',
      }),
      slot: idx + 1,
    })),
    assessment_type: 'COMPETENCY',
    technical_reference: null,
  };
}


/**
 * Initializes or loads an adaptive assignment attempt linked to the Universal Interview Engine.
 */
export async function getOrCreateAdaptiveAssignmentSession(input: {
  assignmentId: string;
  studentUserId: string;
  studentProfile?: Partial<CandidateProfile>;
  retry?: boolean;
}): Promise<AdaptiveAssignmentSession> {
  const admin = createAdminClient();
  if (!admin) throw new Error('Database admin client unavailable');

  // 1. Fetch assignment details
  const { data: assignment, error: asgnErr } = await admin
    .from('schools_assignments')
    .select('id, cohort_id, role_id, job_title, job_description, competencies, max_attempts, delivery_mode, version')
    .eq('id', input.assignmentId)
    .single();
  if (asgnErr || !assignment) throw new Error('Assignment not found');

  // 2. Fetch canonical questions
  const { data: links, error: linkErr } = await admin
    .from('schools_assignment_questions')
    .select('question_index, question_version_id')
    .eq('assignment_id', input.assignmentId)
    .order('question_index');
  if (linkErr || !links || links.length < 3) throw new Error('Assignment questions unavailable');

  const { data: versions, error: verErr } = await admin
    .from('schools_question_versions')
    .select('id, question_text, no_example_follow_up, rubric')
    .in('id', links.map((l) => l.question_version_id));
  if (verErr || !versions) throw new Error('Question versions unavailable');

  const canonicalQuestions: CanonicalQuestionData[] = links.map((l) => {
    const v = versions.find((item) => item.id === l.question_version_id);
    return {
      versionId: l.question_version_id,
      questionIndex: l.question_index,
      questionText: v?.question_text || '',
      noExampleFollowUp: v?.no_example_follow_up || null,
      rubric: v?.rubric || [],
    };
  });

  // 3. Check for existing draft attempt for this student
  const { data: existingAttempts } = await admin
    .from('schools_assignment_attempts')
    .select('id, attempt_number, status, universal_interview_id, delivery_mode, answers, revision, evidence_ledger')
    .eq('assignment_id', input.assignmentId)
    .eq('student_user_id', input.studentUserId)
    .order('attempt_number', { ascending: false });

  const activeDraft = existingAttempts?.find((a) => a.status === 'draft');
  const maxAttemptNum = existingAttempts?.reduce((max, a) => Math.max(max, a.attempt_number), 0) || 0;

  // If retry requested and no draft exists
  if (input.retry && !activeDraft) {
    const allowed = assignment.max_attempts == null || maxAttemptNum < assignment.max_attempts;
    if (!allowed) throw new Error('Maximum attempt limit reached');
  }

  // 4. Resume existing draft if available and has universal_interview_id
  if (activeDraft && activeDraft.universal_interview_id && !input.retry) {
    const { data: storedRow } = await admin
      .from('universal_interviews')
      .select('id, state_ciphertext, status')
      .eq('id', activeDraft.universal_interview_id)
      .maybeSingle();

    if (storedRow) {
      const state = openInterviewState(storedRow.state_ciphertext);
      return {
        attemptId: activeDraft.id,
        universalInterviewId: activeDraft.universal_interview_id,
        assignmentId: input.assignmentId,
        studentUserId: input.studentUserId,
        deliveryMode: 'adaptive_v2',
        state,
        status: activeDraft.status as 'draft',
        attemptNumber: activeDraft.attempt_number,
        canonicalQuestions,
      };
    }
  }

  // 5. Create new session & draft attempt
  const universalInterviewId = crypto.randomUUID();
  const rawToken = newOpaqueToken();
  const attemptId = activeDraft?.id || crypto.randomUUID();
  const attemptNumber = activeDraft ? activeDraft.attempt_number : maxAttemptNum + 1;

  const candidateProfile: CandidateProfile = {
    experience_level: input.studentProfile?.experience_level || 'ENTRY',
    years_experience: input.studentProfile?.years_experience || 0,
    current_or_previous_role: input.studentProfile?.current_or_previous_role || 'Student / Early Career',
    target_role: assignment.job_title || assignment.role_id || 'Target Role',
    industry_background: assignment.job_title || 'Higher Education',
    career_change: Boolean(input.studentProfile?.career_change),
    management_experience: Boolean(input.studentProfile?.management_experience),
    language: 'en',
    academic_field: input.studentProfile?.academic_field,
    qualification: input.studentProfile?.qualification,
    academic_stage: input.studentProfile?.academic_stage,
    evidence_sources: input.studentProfile?.evidence_sources || ['ACADEMIC', 'PERSONAL_PROJECT'],
    country_code: input.studentProfile?.country_code,
    education_system: input.studentProfile?.education_system,
    preferred_education_terms: input.studentProfile?.preferred_education_terms,
    institution_context_id: input.studentProfile?.institution_context_id,
  };

  const assignedCompetencies: DiscoveredCompetency[] = canonicalQuestions.map((q, idx) => ({
    id: `c_canonical_${idx + 1}`,
    name: q.rubric[0]?.label || `Competency ${idx + 1}`,
    family: (idx === 0 ? 'motivation' : 'behavioural') as DiscoveredCompetency['family'],
    source: 'EXPLICIT' as const,
    source_text: q.questionText,
    importance: 'HIGH' as const,
    jd_order: idx,
  }));

  const rolePack = buildRolePackFromQuestions(
    assignment.job_title || assignment.role_id,
    canonicalQuestions,
    assignment.competencies || [],
  );

  const initialState = createInterviewState({
    interviewId: universalInterviewId,
    profile: candidateProfile,
    jdQuality: {
      outcome: 'PASS',
      score: 95,
      cleaned_text: assignment.job_description || assignment.job_title || 'Institutional assignment description',
      word_count: (assignment.job_description || '').split(/\s+/).length,
      responsibility_lines: 5,
      boilerplate_ratio: 0.1,
      detected_titles: [assignment.job_title || assignment.role_id],
      stripped_patterns: [],
      truncated: false,
      reason: null,
    },
    discovery: {
      competencies: assignedCompetencies,
      role_summary: assignment.job_description || `Institutional assignment practice for ${assignment.job_title || assignment.role_id}`,
      seniority_detected: candidateProfile.experience_level,
      management_scope: 'none',
    },
    rolePack,
  });

  const plannedQuestions = buildAdaptivePlanFromCanonical(
    canonicalQuestions,
    assignedCompetencies,
    candidateProfile,
  );

  // Directly activate with canonical questions
  const activeState: InterviewState = {
    ...initialState,
    phase: 'ACTIVE',
    confirmed_by_candidate: true,
    blueprint: assignedCompetencies,
    plan: plannedQuestions,
    current_question: plannedQuestions[0] ? { ...plannedQuestions[0], kind: 'MAIN' } : null,
  };

  // Persist to universal_interviews
  const { error: uiErr } = await admin.from('universal_interviews').insert({
    id: universalInterviewId,
    owner_token_hash: tokenHash(rawToken),
    state_ciphertext: sealInterviewState(activeState),
    status: 'ACTIVE',
  });
  if (uiErr) throw new Error(`Failed to store universal interview: ${uiErr.message}`);

  // Link to universal_interview_accounts
  await admin.from('universal_interview_accounts').insert({
    interview_id: universalInterviewId,
    user_id: input.studentUserId,
  });

  const canonicalSnapshot = canonicalQuestions.map((q) => ({
    questionIndex: q.questionIndex,
    versionId: q.versionId,
    questionText: q.questionText,
    rubric: q.rubric,
  }));

  // Create or update schools_assignment_attempts
  if (activeDraft) {
    await admin.from('schools_assignment_attempts').update({
      delivery_mode: 'adaptive_v2',
      universal_interview_id: universalInterviewId,
      engine_version: PROMPT_VERSION,
      canonical_questions_snapshot: canonicalSnapshot,
      answers: Array(canonicalQuestions.length).fill(''),
      updated_at: new Date().toISOString(),
    }).eq('id', activeDraft.id);
  } else {
    await admin.from('schools_assignment_attempts').insert({
      id: attemptId,
      assignment_id: input.assignmentId,
      student_user_id: input.studentUserId,
      attempt_number: attemptNumber,
      status: 'draft',
      delivery_mode: 'adaptive_v2',
      universal_interview_id: universalInterviewId,
      engine_version: PROMPT_VERSION,
      canonical_questions_snapshot: canonicalSnapshot,
      answers: Array(canonicalQuestions.length).fill(''),
    });
  }

  return {
    attemptId,
    universalInterviewId,
    assignmentId: input.assignmentId,
    studentUserId: input.studentUserId,
    deliveryMode: 'adaptive_v2',
    state: activeState,
    status: 'draft',
    attemptNumber,
    canonicalQuestions,
  };
}

/**
 * Submits an answer to the active turn in an adaptive assignment, running the Universal Engine.
 */
export async function submitAdaptiveAssignmentTurn(input: {
  attemptId: string;
  studentUserId: string;
  answerText: string;
}): Promise<{
  state: InterviewState;
  completed: boolean;
  action: TurnAction;
  attemptId: string;
}> {
  const admin = createAdminClient();
  if (!admin) throw new Error('Database admin client unavailable');

  // Fetch attempt and verify ownership
  const { data: attempt, error } = await admin
    .from('schools_assignment_attempts')
    .select('id, assignment_id, student_user_id, universal_interview_id, answers, adaptive_turns, evidence_ledger, status, canonical_questions_snapshot')
    .eq('id', input.attemptId)
    .eq('student_user_id', input.studentUserId)
    .single();

  if (error || !attempt) throw new Error('Attempt not found or unowned');
  if (attempt.status !== 'draft') throw new Error('Attempt has already been submitted');
  if (!attempt.universal_interview_id) throw new Error('Attempt is missing universal interview session');

  // Load universal state
  const { data: storedRow } = await admin
    .from('universal_interviews')
    .select('state_ciphertext')
    .eq('id', attempt.universal_interview_id)
    .single();

  if (!storedRow) throw new Error('Universal interview session not found');
  let state = openInterviewState(storedRow.state_ciphertext);

  const questionIndex = state.question_number - 1;
  const currentQuestionText = state.current_question?.candidate_text || '';

  // Process turn using Universal Engine
  const result = await processUniversalTurn(state, input.answerText, {
    allowDeterministicExtractionFallback: true,
  });

  state = result.state;

  // Record turn to adaptive_turns
  const turnRecord = {
    turnNumber: (attempt.adaptive_turns?.length || 0) + 1,
    questionNumber: questionIndex + 1,
    questionText: currentQuestionText,
    answerText: input.answerText,
    action: result.action,
    timestamp: new Date().toISOString(),
  };
  const updatedTurns = [...(attempt.adaptive_turns || []), turnRecord];

  // Update canonical answers array (aggregate answers for this canonical slot)
  const canonicalAnswers = Array.isArray(attempt.answers) ? [...attempt.answers] : [];
  while (canonicalAnswers.length <= questionIndex) canonicalAnswers.push('');
  canonicalAnswers[questionIndex] = canonicalAnswers[questionIndex]
    ? `${canonicalAnswers[questionIndex]}\n\n[Follow-up answer]: ${input.answerText}`
    : input.answerText;

  // Persist updated universal state
  await admin.from('universal_interviews').update({
    state_ciphertext: sealInterviewState(state),
    status: state.phase === 'COMPLETE' ? 'COMPLETE' : 'ACTIVE',
    updated_at: new Date().toISOString(),
  }).eq('id', attempt.universal_interview_id);

  // Sync audit trail to schools_assignment_attempts
  await admin.from('schools_assignment_attempts').update({
    answers: canonicalAnswers,
    adaptive_turns: updatedTurns,
    evidence_ledger: state.evidence_ledger,
    evidence_sources: state.profile.evidence_sources || [],
    updated_at: new Date().toISOString(),
  }).eq('id', attempt.id);

  return {
    state,
    completed: state.phase === 'COMPLETE',
    action: result.action,
    attemptId: attempt.id,
  };
}

/**
 * Finalizes and submits an adaptive assignment attempt.
 */
export async function finalizeAdaptiveAssignmentSubmission(input: {
  attemptId: string;
  studentUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error('Database admin client unavailable');

  const { data: attempt, error } = await admin
    .from('schools_assignment_attempts')
    .select('id, assignment_id, student_user_id, status, answers, universal_interview_id')
    .eq('id', input.attemptId)
    .eq('student_user_id', input.studentUserId)
    .single();

  if (error || !attempt) throw new Error('Attempt not found');
  if (attempt.status === 'submitted') return; // Already submitted

  // Mark attempt submitted
  const { error: submitErr } = await admin
    .from('schools_assignment_attempts')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attempt.id);

  if (submitErr) throw new Error(`Submission failed: ${submitErr.message}`);

  // Fetch assignment cohort for audit log
  const { data: asgn } = await admin
    .from('schools_assignments')
    .select('cohort_id')
    .eq('id', attempt.assignment_id)
    .single();

  if (asgn) {
    const { data: cohort } = await admin
      .from('schools_cohorts')
      .select('institution_id')
      .eq('id', asgn.cohort_id)
      .single();

    if (cohort) {
      await admin.from('schools_audit_log').insert({
        actor_user_id: input.studentUserId,
        action: 'attempt_submitted',
        target_table: 'schools_assignment_attempts',
        target_id: attempt.id,
        institution_id: cohort.institution_id,
      });
    }
  }
}
