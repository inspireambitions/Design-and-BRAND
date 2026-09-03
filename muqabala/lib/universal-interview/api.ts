import { coverageBand } from './feedback.ts';
import type {
  ExtractionResult,
  FinalFeedback,
  GeneratedQuestion,
  InterviewState,
  PlannedQuestion,
  RetryComparison,
} from './types.ts';
import { FRAMEWORK_CRITERIA, frameworkForQuestionType, questionQualityGate } from './questions.ts';

const FORBIDDEN_CANDIDATE_COPY = /\b(?:contradiction|lie|dishonest|inconsistent)\b|—/i;

export function universalInterviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UNIVERSAL_BRAIN_V2 === 'on';
}

export function candidateCopySafe(value: unknown): boolean {
  return !FORBIDDEN_CANDIDATE_COPY.test(JSON.stringify(value));
}

export function publicInterviewState(state: InterviewState) {
  return {
    interview_id: state.interview_id,
    phase: state.phase,
    question_number: state.question_number,
    question_total: state.plan.length,
    current_question: state.current_question ? { text: state.current_question.text } : null,
    retry_used: state.retry_used,
    role_pack: {
      assessment_type: state.role_pack.assessment_type,
    },
  };
}

export function publicDiscoveryState(
  state: InterviewState,
  roleSummary: string,
  notice: string,
) {
  return {
    interview_id: state.interview_id,
    role_summary: roleSummary,
    competencies: state.discovery.map(({ id, name, family, source, source_text }) => ({
      id,
      name,
      family,
      source,
      source_text,
    })),
    suggested_competency_ids: state.blueprint.length
      ? state.blueprint.map((competency) => competency.id)
      : state.discovery.slice(0, 5).map((competency) => competency.id),
    notice,
  };
}

function publicCompetencyFeedback(item: FinalFeedback['competencies'][number]) {
  return {
    id: item.id,
    what_worked: item.what_worked,
    what_is_missing: item.what_is_missing,
    improve_this: item.improve_this,
    band: item.band,
  };
}

export function publicFinalFeedback(feedback: FinalFeedback, retryQuestionText?: string) {
  return {
    competencies: feedback.competencies.map(publicCompetencyFeedback),
    single_highest_value_improvement: feedback.single_highest_value_improvement,
    retry_recommended_question: feedback.retry_recommended_question,
    caveats: feedback.caveats,
    ...(retryQuestionText ? { retry_question_text: retryQuestionText } : {}),
  };
}

export function publicRetryComparison(comparison: RetryComparison) {
  const bands = (values: RetryComparison['before']) => Object.fromEntries(
    Object.entries(values).map(([id, status]) => [id, coverageBand(status)]),
  );
  return {
    question_number: comparison.question_number,
    before: bands(comparison.before),
    after: bands(comparison.after),
    feedback: comparison.feedback.map(publicCompetencyFeedback),
  };
}

export function validateExtractionSemantics(state: InterviewState, extraction: ExtractionResult): string | null {
  const allowedCompetencies = new Set(state.current_question?.target_competencies ?? []);
  if (extraction.evidence.competencies.some((competency) => !allowedCompetencies.has(competency.id))) {
    return 'competency was not targeted by the current question';
  }
  const expectedCriteria = FRAMEWORK_CRITERIA[state.current_question?.framework ?? 'STAR'];
  if (expectedCriteria.some((criterion) => !(criterion in extraction.evidence.criteria))) {
    return 'missing framework criterion';
  }
  const evidenceIds = new Set(state.evidence_ledger.map((entry) => entry.id));
  if (extraction.evidence.same_example_as && !evidenceIds.has(extraction.evidence.same_example_as)) {
    return 'same_example_as does not exist';
  }
  if (extraction.possible_inconsistency && !evidenceIds.has(extraction.possible_inconsistency.earlier_evidence_id)) {
    return 'possible_inconsistency references unknown evidence';
  }
  return null;
}

export function normaliseGeneratedPlan(state: InterviewState, plan: Array<Omit<PlannedQuestion, 'rephrase'>>): PlannedQuestion[] | null {
  const allowed = new Set(state.blueprint.map((competency) => competency.id));
  const slots = [...plan].sort((left, right) => left.slot - right.slot);
  if (slots.length !== 8 || slots.some((item, index) => item.slot !== index + 1)) return null;
  if (slots.some((item) => item.target_competencies.some((id) => !allowed.has(id)))) return null;
  if (!candidateCopySafe(slots)) return null;

  const motivation = state.blueprint.find((competency) => competency.family === 'motivation') ?? state.blueprint[0];
  const behavioural = state.blueprint.find((competency) => competency.family === 'behavioural') ?? state.blueprint[2];
  const situational = state.blueprint.find((competency) => competency.family === 'cognitive') ?? state.blueprint[3];
  const typeFor = (index: number) => {
    const family = state.blueprint[index].family;
    return family === 'technical'
      ? 'TECHNICAL' as const
      : family === 'leadership'
        ? 'LEADERSHIP' as const
        : family === 'commercial'
          ? 'COMMERCIAL' as const
          : family === 'motivation'
            ? 'MOTIVATION' as const
            : 'BEHAVIOURAL' as const;
  };
  const fixed = [
    { type: 'INTRODUCTION' as const, targets: [motivation.id], intent: state.profile.career_change ? 'CAREER_COHERENCE' : 'ROLE_RELEVANCE' },
    { type: typeFor(0), targets: [state.blueprint[0].id], intent: state.blueprint[0].id },
    { type: typeFor(1), targets: [state.blueprint[1].id], intent: state.blueprint[1].id },
    { type: typeFor(2), targets: [state.blueprint[2].id], intent: state.blueprint[2].id },
    { type: 'BEHAVIOURAL' as const, targets: [behavioural.id], intent: 'CHALLENGE_OR_CONFLICT' },
    { type: 'SITUATIONAL' as const, targets: [situational.id], intent: 'SITUATIONAL_JUDGEMENT' },
    { type: typeFor(3), targets: [state.blueprint[3].id], intent: state.blueprint[3].id },
    { type: typeFor(4), targets: [state.blueprint[4].id], intent: 'HIGHEST_VALUE_UNCOVERED' },
  ];
  const normalised = slots.map((item, index) => ({
    ...item,
    question_type: fixed[index].type,
    target_competencies: fixed[index].targets,
    primary_intent: fixed[index].intent,
    framework: frameworkForQuestionType(fixed[index].type),
    rephrase: `Please answer this in another way: ${item.text}`,
  }));
  const temporary = { ...state, coverage: state.coverage, dedupe_keys: [] };
  if (normalised.some((item) => !questionQualityGate({
    text: item.text,
    question_type: item.question_type,
    target_competencies: item.target_competencies,
    intent: item.primary_intent,
    framework: item.framework,
    kind: 'MAIN',
  }, temporary).ok)) return null;
  return normalised;
}

export function validateGeneratedQuestion(state: InterviewState, question: GeneratedQuestion): string | null {
  if (!candidateCopySafe(question)) return 'forbidden candidate-facing wording';
  const allowed = new Set(state.discovery.map((competency) => competency.id));
  if (question.target_competencies.some((id) => !allowed.has(id))) return 'unknown competency id';
  const quality = questionQualityGate(question, state);
  return quality.ok ? null : quality.reason;
}

export function jsonError(message: string, status: number, code: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
