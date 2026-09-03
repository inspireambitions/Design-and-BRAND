import {
  advanceInterview,
  applyExtraction,
  applyImmediateDecision,
  decideTurn,
  recordDecision,
  setGeneratedFollowup,
  turnActionNeedsQuestion,
} from '@/lib/universal-interview/engine';
import {
  jsonError,
  publicInterviewState,
  universalInterviewEnabled,
  validateExtractionSemantics,
  validateGeneratedQuestion,
} from '@/lib/universal-interview/api';
import { callStructured, ModelCallBudget } from '@/lib/universal-interview/model';
import {
  EXTRACTION_INSTRUCTIONS,
  extractionInput,
  generatedQuestionFromModel,
  QUESTION_INSTRUCTIONS,
  questionInput,
} from '@/lib/universal-interview/prompts';
import { fallbackGeneratedQuestion, fallbackReplacementQuestion } from '@/lib/universal-interview/questions';
import { claimStoredInterview, loadStoredInterview, recordStageMetric, releaseInterviewClaim, saveClaimedInterview } from '@/lib/universal-interview/repository';
import { ExtractionSchema, GeneratedQuestionSchema, TurnRequestSchema } from '@/lib/universal-interview/schemas';
import { precheckAnswer } from '@/lib/universal-interview/sanitise';
import type { ExtractionResult, GeneratedQuestion, InterviewState, TurnAction } from '@/lib/universal-interview/types';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitScoring } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function extractAnswer(state: InterviewState, answer: string, shortAnswer: boolean, budget: ModelCallBudget) {
  const basePrompt = extractionInput(state, answer, shortAnswer);
  let semanticFailure = '';
  while (budget.remaining > 0) {
    const result = await callStructured({
      stage: 'T1',
      schemaName: 'turn_evidence',
      schema: ExtractionSchema,
      instructions: EXTRACTION_INSTRUCTIONS,
      prompt: semanticFailure ? `${basePrompt}\n\nYour previous output failed validation: ${semanticFailure}.` : basePrompt,
      budget,
      allowValidationRetry: false,
    });
    if (!result) {
      semanticFailure = 'schema validation failed';
      if (budget.remaining > 0) budget.markRetry();
      continue;
    }
    const criteriaEntries = result.evidence.criteria;
    const criteria = Object.fromEntries(criteriaEntries.map((item) => [item.criterion, item.status]));
    const normalised: ExtractionResult = { ...result, evidence: { ...result.evidence, criteria } };
    const hasDuplicateCriteria = new Set(criteriaEntries.map((item) => item.criterion)).size !== criteriaEntries.length;
    const failure = hasDuplicateCriteria ? 'duplicate framework criterion' : validateExtractionSemantics(state, normalised);
    if (!failure) return normalised;
    semanticFailure = failure;
    if (budget.remaining > 0) budget.markRetry();
  }
  return null;
}

async function generateQuestion(input: {
  state: InterviewState;
  action: TurnAction;
  probeTarget: string;
  replacementCompetencyId?: string | null;
  kind: GeneratedQuestion['kind'];
  budget: ModelCallBudget;
}): Promise<GeneratedQuestion | null> {
  let semanticFailure = '';
  while (input.budget.remaining > 0) {
    const result = await callStructured({
      stage: 'T2',
      schemaName: 'next_interview_question',
      schema: GeneratedQuestionSchema,
      instructions: QUESTION_INSTRUCTIONS,
      prompt: `${questionInput(input)}${semanticFailure ? `\n\nYour previous question failed: ${semanticFailure}.` : ''}`,
      budget: input.budget,
      allowValidationRetry: false,
    });
    if (!result) {
      semanticFailure = 'schema validation failed';
      if (input.budget.remaining > 0) input.budget.markRetry();
      continue;
    }
    const question = generatedQuestionFromModel(result, input.kind);
    const failure = validateGeneratedQuestion(input.state, question);
    if (!failure) return question;
    semanticFailure = failure;
    if (input.budget.remaining > 0) input.budget.markRetry();
  }
  return null;
}

export async function POST(request: Request) {
  const started = Date.now();
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  const parsed = TurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Enter a valid interview answer.', 400, 'invalid_answer');
  let state = await loadStoredInterview(parsed.data.interview_id);
  if (!state) return jsonError('Interview not found.', 404, 'not_found');
  const rateLimit = await limitScoring(request, state.interview_id);
  if (rateLimit.limited) return jsonError('Too many answers were sent. Wait a few minutes.', 429, 'rate_limited');
  if (state.phase !== 'ACTIVE' || !state.current_question) return jsonError('This interview is not awaiting an answer.', 409, 'not_active');
  const precheck = precheckAnswer(parsed.data.answer);
  if (precheck.kind === 'NONE' && precheck.word_count < 5) {
    return jsonError('Add a little more detail before sending your answer.', 400, 'answer_too_short');
  }
  const claim = await claimStoredInterview(state);
  if (!claim) return jsonError('This answer is already being processed.', 409, 'interview_busy');

  const budget = new ModelCallBudget(2);
  let fallbackUsed = false;
  let extraction: ExtractionResult | null = null;
  if (precheck.kind === 'NONE') {
    const generatedExtraction = await extractAnswer(state, precheck.cleaned_answer, precheck.short_answer, budget);
    fallbackUsed = !generatedExtraction;
    if (!generatedExtraction) {
      await releaseInterviewClaim(state.interview_id, claim);
      await recordStageMetric({
        interviewId: state.interview_id,
        stage: 'TURN',
        promptVersion: state.prompt_version,
        modelCalls: budget.used,
        schemaRetry: budget.schemaRetried,
        fallbackUsed: true,
        latencyMs: Date.now() - started,
      });
      return jsonError('We could not read that answer. Please send it again.', 503, 'answer_processing_unavailable');
    }
    extraction = generatedExtraction;
    state = applyExtraction(state, extraction, precheck.cleaned_answer);
  }
  const probeCountBeforeDecision = state.probe_count_current;
  const decision = decideTurn(state, precheck, extraction);
  let dedupeHit = false;

  if (decision.action === 'MOVE_ON') {
    const advanced = advanceInterview(state);
    state = advanced.state;
    if (advanced.needsReplacement && advanced.replacementCompetencyId && state.current_question) {
      const generated = await generateQuestion({
        state,
        action: 'MOVE_ON',
        probeTarget: '',
        replacementCompetencyId: advanced.replacementCompetencyId,
        kind: 'MAIN',
        budget,
      });
      const replacement = generated ?? fallbackReplacementQuestion(state, advanced.replacementCompetencyId);
      fallbackUsed ||= !generated;
      state = setGeneratedFollowup(state, replacement);
    } else if (advanced.needsReplacement && !advanced.replacementCompetencyId) {
      state.phase = 'COMPLETE';
      state.status = 'COMPLETE';
      state.current_question = null;
    }
  } else {
    state = applyImmediateDecision(state, decision, extraction);
    if (turnActionNeedsQuestion(decision.action) && state.current_question) {
      const kind: GeneratedQuestion['kind'] = decision.action === 'CLARIFY'
        ? 'CLARIFY'
        : decision.action === 'REDIRECT'
          ? 'REDIRECT'
          : 'PROBE';
      const generated = await generateQuestion({
        state,
        action: decision.action,
        probeTarget: decision.probe_target,
        kind,
        budget,
      });
      const question = generated ?? fallbackGeneratedQuestion(
        decision.action,
        state.current_question,
        decision.probe_target,
      );
      fallbackUsed ||= !generated;
      state = setGeneratedFollowup(state, question);
    }
  }

  state = recordDecision(state, {
    precheck,
    extraction,
    decision,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    latencyMs: Date.now() - started,
    dedupeHit,
    probeCount: decision.counts_as_probe ? probeCountBeforeDecision + 1 : probeCountBeforeDecision,
    fallbackUsed,
  });
  await saveClaimedInterview(state, claim);
  await recordStageMetric({
    interviewId: state.interview_id,
    stage: 'TURN',
    promptVersion: state.prompt_version,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed,
    latencyMs: Date.now() - started,
  });
  return Response.json({
    ...publicInterviewState(state),
    action: state.phase === 'COMPLETE' ? 'COMPLETE' : decision.action,
  }, { headers: privateNoStoreHeaders() });
}
