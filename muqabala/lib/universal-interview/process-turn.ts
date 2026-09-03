import {
  advanceInterview, applyExtraction, applyImmediateDecision, decideTurn, recordDecision,
  setGeneratedFollowup, turnActionNeedsQuestion,
} from './engine.ts';
import { validateExtractionSemantics, validateGeneratedQuestion } from './api.ts';
import { callStructured, ModelCallBudget } from './model.ts';
import {
  EXTRACTION_INSTRUCTIONS, extractionInput, generatedQuestionFromModel,
  QUESTION_INSTRUCTIONS, questionInput,
} from './prompts.ts';
import { fallbackGeneratedQuestion, validatedBankFallback } from './questions.ts';
import { rejectedQuestionLog, validateQuestionObject } from './candidate-question.ts';
import { ExtractionSchema, GeneratedQuestionSchema } from './schemas.ts';
import { precheckAnswer } from './sanitise.ts';
import type { ExtractionResult, GeneratedQuestion, InterviewState, TurnAction } from './types.ts';

export class UniversalTurnError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function extractAnswer(state: InterviewState, answer: string, shortAnswer: boolean, budget: ModelCallBudget) {
  const basePrompt = extractionInput(state, answer, shortAnswer);
  let semanticFailure = '';
  while (budget.remaining > 0) {
    const result = await callStructured({
      stage: 'T1', schemaName: 'turn_evidence', schema: ExtractionSchema,
      instructions: EXTRACTION_INSTRUCTIONS,
      prompt: semanticFailure ? `${basePrompt}\n\nYour previous output failed validation: ${semanticFailure}.` : basePrompt,
      budget, allowValidationRetry: false,
    });
    if (!result) {
      semanticFailure = 'schema validation failed';
      if (budget.remaining > 0) budget.markRetry();
      continue;
    }
    const criteriaEntries = result.evidence.criteria;
    const criteria = Object.fromEntries(criteriaEntries.map((item) => [item.criterion, item.status]));
    const normalised: ExtractionResult = { ...result, evidence: { ...result.evidence, criteria } };
    const duplicate = new Set(criteriaEntries.map((item) => item.criterion)).size !== criteriaEntries.length;
    const failure = duplicate ? 'duplicate framework criterion' : validateExtractionSemantics(state, normalised);
    if (!failure) return normalised;
    semanticFailure = failure;
    if (budget.remaining > 0) budget.markRetry();
  }
  return null;
}

type RawModelQuestion = {
  candidate_text: string;
  question_type: GeneratedQuestion['question_type'];
  target_competencies: string[];
  interviewer_intent: string;
};

export async function generateQuestionWithRetry(input: {
  state: InterviewState; action: TurnAction; probeTarget: string;
  replacementCompetencyId?: string | null; kind: GeneratedQuestion['kind']; budget: ModelCallBudget;
  request?: (validationReasons: string[]) => Promise<RawModelQuestion | null>;
  log?: (entry: ReturnType<typeof rejectedQuestionLog>) => void;
}): Promise<GeneratedQuestion | null> {
  let reasons: string[] = [];
  const request = input.request ?? (async (validationReasons: string[]) => callStructured({
    stage: 'T2', schemaName: 'next_interview_question', schema: GeneratedQuestionSchema,
    instructions: QUESTION_INSTRUCTIONS,
    prompt: `${questionInput(input)}${validationReasons.length ? `\n\nYour previous question failed validation: ${validationReasons.join(', ')}.` : ''}`,
    budget: input.budget, allowValidationRetry: false,
  }));
  const log = input.log ?? ((entry) => console.warn('question_rejected', entry));

  for (let attempt = 0; attempt < 2 && (input.request || input.budget.remaining > 0); attempt += 1) {
    const result = await request(reasons);
    if (!result) {
      reasons = ['schema validation failed'];
      if (input.budget.remaining > 0) input.budget.markRetry();
      continue;
    }
    const question = generatedQuestionFromModel(result, {
      kind: input.kind,
      seniority: input.state.seniority,
      promptVersion: input.state.prompt_version,
      questionId: `model_${input.state.question_number}_${input.kind.toLowerCase()}`,
      probeTargets: input.probeTarget ? [input.probeTarget] : [],
    });
    const validation = validateQuestionObject(question);
    if (validation.ok) {
      const failure = validateGeneratedQuestion(input.state, validation.question);
      if (!failure) return validation.question;
      reasons = failure.split(',').map((reason) => reason.trim()).filter(Boolean);
    } else {
      reasons = validation.reasons;
    }
    log(rejectedQuestionLog(question, reasons));
    if (input.budget.remaining > 0) input.budget.markRetry();
  }
  return null;
}

export async function processUniversalTurn(state: InterviewState, answer: string) {
  const started = Date.now();
  if (state.phase !== 'ACTIVE' || !state.current_question) {
    throw new UniversalTurnError(409, 'not_active', 'This interview is not awaiting an answer.');
  }
  const precheck = precheckAnswer(answer);
  if (precheck.kind === 'NONE' && precheck.word_count < 5) {
    throw new UniversalTurnError(400, 'answer_too_short', 'Add a little more detail before sending your answer.');
  }
  const budget = new ModelCallBudget(3);
  let fallbackUsed = false;
  let extraction: ExtractionResult | null = null;
  if (precheck.kind === 'NONE') {
    const generatedExtraction = await extractAnswer(state, precheck.cleaned_answer, precheck.short_answer, budget);
    fallbackUsed = !generatedExtraction;
    if (!generatedExtraction) {
      throw new UniversalTurnError(503, 'answer_processing_unavailable', 'We could not read that answer. Please send it again.');
    }
    extraction = generatedExtraction;
    state = applyExtraction(state, extraction, precheck.cleaned_answer);
  }
  const probeCountBeforeDecision = state.probe_count_current;
  const decision = decideTurn(state, precheck, extraction);
  if (decision.action === 'MOVE_ON') {
    const advanced = advanceInterview(state);
    state = advanced.state;
    if (advanced.needsReplacement && advanced.replacementCompetencyId && state.current_question) {
      const generated = await generateQuestionWithRetry({
        state, action: 'MOVE_ON', probeTarget: '', replacementCompetencyId: advanced.replacementCompetencyId,
        kind: 'MAIN', budget,
      });
      state = setGeneratedFollowup(
        state,
        generated ?? validatedBankFallback(state, advanced.replacementCompetencyId, 'MAIN'),
      );
      fallbackUsed ||= !generated;
    }
  } else {
    state = applyImmediateDecision(state, decision, extraction);
    if (turnActionNeedsQuestion(decision.action) && state.current_question) {
      const kind: GeneratedQuestion['kind'] = decision.action === 'CLARIFY' ? 'CLARIFY' : decision.action === 'REDIRECT' ? 'REDIRECT' : 'PROBE';
      const generated = await generateQuestionWithRetry({ state, action: decision.action, probeTarget: decision.probe_target, kind, budget });
      const competencyId = state.current_question.target_competencies[0];
      state = setGeneratedFollowup(
        state,
        generated ?? (competencyId
          ? validatedBankFallback(state, competencyId, kind)
          : fallbackGeneratedQuestion(decision.action, state.current_question, decision.probe_target)),
      );
      fallbackUsed ||= !generated;
    }
  }
  state = recordDecision(state, {
    precheck, extraction, decision, modelCalls: budget.used, schemaRetry: budget.schemaRetried,
    latencyMs: Date.now() - started, dedupeHit: false,
    probeCount: decision.counts_as_probe ? probeCountBeforeDecision + 1 : probeCountBeforeDecision,
    fallbackUsed,
  });
  return {
    state,
    action: state.phase === 'COMPLETE' ? 'COMPLETE' as const : decision.action,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed,
    latencyMs: Date.now() - started,
  };
}
