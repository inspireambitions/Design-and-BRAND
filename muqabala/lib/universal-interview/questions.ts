import {
  assertValidatedQuestion,
  fixedRephrase,
  validateCandidateText,
  validateQuestionObject,
} from './candidate-question.ts';
import type {
  CandidateQuestion,
  CandidateProfile,
  CoverageStatus,
  ExperienceLevel,
  Framework,
  GeneratedQuestion,
  InterviewState,
  PlannedQuestion,
  QuestionType,
} from './types.ts';

const FORBIDDEN_CANDIDATE_COPY = /\b(?:contradiction|lie|dishonest|inconsistent|MVP|V2|beta|prototype|prompt version|model call)\b|—/i;

export const FRAMEWORK_CRITERIA: Record<Framework, string[]> = {
  STAR: ['situation', 'task', 'action', 'result'],
  MOTIVATION: ['specificity', 'role_understanding', 'credibility', 'career_logic'],
  SITUATIONAL_JUDGEMENT: ['judgement', 'prioritisation', 'risk_recognition', 'reasoning'],
  TECHNICAL_REASONING: ['conceptual_understanding', 'application', 'trade_offs', 'clarity'],
  LEADERSHIP_DEPTH: ['scope', 'ownership', 'decision', 'stakeholder_handling', 'outcome'],
  COMMERCIAL_REASONING: ['numbers', 'trade_offs', 'causality', 'outcome'],
  CAREER_NARRATIVE: ['coherence', 'relevance', 'clarity'],
  ROLE_KNOWLEDGE: ['accuracy_of_role_understanding', 'realism', 'priorities'],
};

export function frameworkForQuestionType(type: QuestionType): Framework {
  const table: Record<QuestionType, Framework> = {
    INTRODUCTION: 'CAREER_NARRATIVE',
    MOTIVATION: 'MOTIVATION',
    BEHAVIOURAL: 'STAR',
    SITUATIONAL: 'SITUATIONAL_JUDGEMENT',
    TECHNICAL: 'TECHNICAL_REASONING',
    LEADERSHIP: 'LEADERSHIP_DEPTH',
    COMMERCIAL: 'COMMERCIAL_REASONING',
    CAREER_HISTORY: 'CAREER_NARRATIVE',
    ROLE_KNOWLEDGE: 'ROLE_KNOWLEDGE',
  };
  return table[type];
}

export function makeValidatedQuestion(input: Omit<CandidateQuestion, 'validated' | 'rephrase_text'> & {
  rephrase_text?: string;
}): CandidateQuestion {
  const result = validateQuestionObject({
    ...input,
    rephrase_text: input.rephrase_text ?? fixedRephrase(input.question_type),
  });
  if (!result.ok) {
    throw new Error(`Question ${input.question_id} failed validation: ${result.reasons.join(',')}`);
  }
  return result.question;
}

export function makeBankQuestion(input: {
  question_id: string;
  candidate_text: string;
  interviewer_intent: string;
  probe_targets?: string[];
  question_type: QuestionType;
  target_competencies: string[];
  seniority: ExperienceLevel;
  kind?: GeneratedQuestion['kind'];
  rephrase_text?: string;
}): CandidateQuestion {
  return makeValidatedQuestion({
    ...input,
    probe_targets: input.probe_targets ?? [],
    language: 'en',
    source: 'BANK',
    prompt_version: null,
    framework: frameworkForQuestionType(input.question_type),
    kind: input.kind ?? 'MAIN',
  });
}

export function fromPlannedQuestion(question: PlannedQuestion): GeneratedQuestion {
  return assertValidatedQuestion({ ...question, kind: 'MAIN' });
}

export function candidateCopySafeValue(value: unknown): boolean {
  return !FORBIDDEN_CANDIDATE_COPY.test(JSON.stringify(value));
}

export function candidateQuestionSafetyReason(
  text: string,
  _kind: GeneratedQuestion['kind'],
  seniority: ExperienceLevel = 'PROFESSIONAL',
): string | null {
  if (!candidateCopySafeValue(text)) return 'FORBIDDEN_CANDIDATE_COPY';
  return validateCandidateText(text, { language: 'en', seniority }).reasons[0] ?? null;
}

export function candidateSafeQuestion(question: GeneratedQuestion): GeneratedQuestion {
  return assertValidatedQuestion(question);
}

const coverageRank: Record<CoverageStatus, number> = {
  NO_EVIDENCE: 0,
  WEAK: 1,
  PARTIAL: 2,
  SUFFICIENT: 3,
  STRONG: 4,
};

export function questionQualityGate(
  question: GeneratedQuestion,
  state: Pick<InterviewState, 'coverage' | 'dedupe_keys' | 'seniority'>,
): { ok: true } | { ok: false; reason: string } {
  if (!candidateCopySafeValue(question.candidate_text)) {
    return { ok: false, reason: 'FORBIDDEN_CANDIDATE_COPY' };
  }
  const validation = validateCandidateText(question.candidate_text, {
    language: question.language,
    seniority: state.seniority,
  });
  if (!validation.ok) return { ok: false, reason: validation.reasons.join(',') };
  for (const competencyId of question.target_competencies) {
    const status = state.coverage[competencyId]?.status ?? 'NO_EVIDENCE';
    if (coverageRank[status] >= coverageRank.SUFFICIENT && question.kind !== 'CLARIFY') {
      return { ok: false, reason: 'target_already_sufficient' };
    }
    const key = `${competencyId}|${question.question_type}|${status}`;
    if (state.dedupe_keys.includes(key) && coverageRank[status] >= coverageRank.SUFFICIENT) {
      return { ok: false, reason: 'dedupe_key' };
    }
  }
  return { ok: true };
}

export function fallbackGeneratedQuestion(
  action: string,
  current: GeneratedQuestion,
  _probeTarget: string,
): GeneratedQuestion {
  const textByAction: Record<string, string> = {
    PROBE_TASK: 'What was your responsibility in that situation?',
    PROBE_ACTION: 'What did you personally do next?',
    PROBE_RESULT: 'What changed because of your actions?',
    PROBE_OWNERSHIP: 'Which part did you personally own?',
    PROBE_SPECIFICITY: 'What is one specific example from your experience?',
    PROBE_SCALE: 'What was the scale of your work?',
    PROBE_REASONING: 'What reasoning led you to that decision?',
    CLARIFY: 'Earlier you described the scope differently. Which scope applies to your example?',
    REDIRECT: 'What relevant example from your experience answers the original question?',
    OFFER_HYPOTHETICAL: 'If you faced this situation, what would you do first?',
  };
  const kind: GeneratedQuestion['kind'] = action === 'CLARIFY'
    ? 'CLARIFY'
    : action === 'REDIRECT'
      ? 'REDIRECT'
      : action === 'OFFER_HYPOTHETICAL'
        ? 'HYPOTHETICAL'
        : 'PROBE';
  return makeValidatedQuestion({
    ...current,
    question_id: `${current.question_id}_${kind.toLowerCase()}`,
    candidate_text: textByAction[action] ?? current.candidate_text,
    interviewer_intent: action,
    probe_targets: [],
    source: 'BANK',
    prompt_version: null,
    kind,
  });
}

export function fallbackReplacementQuestion(state: InterviewState, competencyId: string): GeneratedQuestion {
  const competency = state.discovery.find((item) => item.id === competencyId);
  if (!competency) throw new Error('Replacement competency not found.');
  const questionType: QuestionType = competency.family === 'technical'
    ? 'TECHNICAL'
    : competency.family === 'leadership'
      ? 'LEADERSHIP'
      : competency.family === 'commercial'
        ? 'COMMERCIAL'
        : competency.family === 'motivation'
          ? 'MOTIVATION'
          : 'BEHAVIOURAL';
  return makeBankQuestion({
    question_id: `fallback_${competency.id}`,
    candidate_text: `What example best shows your ${competency.name.toLowerCase()}?`,
    question_type: questionType,
    target_competencies: [competency.id],
    interviewer_intent: 'REPLACEMENT_FOR_COVERED_COMPETENCY',
    seniority: state.seniority,
  });
}

export function genericBehaviouralFallback(
  state: Pick<InterviewState, 'seniority'>,
  competencyId: string,
  kind: GeneratedQuestion['kind'] = 'MAIN',
): GeneratedQuestion {
  return makeBankQuestion({
    question_id: `generic_${competencyId}_${kind.toLowerCase()}`,
    candidate_text: 'What is one relevant example from your experience?',
    question_type: 'BEHAVIOURAL',
    target_competencies: [competencyId],
    interviewer_intent: 'GENERIC_BEHAVIOURAL_FALLBACK',
    seniority: state.seniority,
    kind,
  });
}

export function validatedBankFallback(
  state: InterviewState,
  competencyId: string,
  kind: GeneratedQuestion['kind'] = 'MAIN',
): GeneratedQuestion {
  const bankQuestion = state.role_pack.question_bank.find((question) => (
    question.target_competencies.includes(competencyId)
    && question.question_id !== state.current_question?.question_id
  ));
  if (!bankQuestion) return genericBehaviouralFallback(state, competencyId, kind);
  return makeValidatedQuestion({
    ...bankQuestion,
    question_id: `${bankQuestion.question_id}_${kind.toLowerCase()}`,
    seniority: state.seniority,
    kind,
  });
}

export function highestValueUncovered(state: InterviewState, includeNonBlueprint = false): string | null {
  const source = includeNonBlueprint ? state.discovery : state.blueprint;
  return source.find((competency) => {
    const status = state.coverage[competency.id]?.status ?? 'NO_EVIDENCE';
    return coverageRank[status] < coverageRank.SUFFICIENT;
  })?.id ?? null;
}

export function isSufficient(status: CoverageStatus | undefined): boolean {
  return coverageRank[status ?? 'NO_EVIDENCE'] >= coverageRank.SUFFICIENT;
}

export function seniorityFromProfile(profile: CandidateProfile): ExperienceLevel {
  return profile.experience_level;
}

type LegacyQuestion = Partial<CandidateQuestion> & {
  text?: string;
  intent?: string;
  primary_intent?: string;
  rephrase?: string;
  slot?: number;
};

const LEGACY_SAFE_TEXT: Record<GeneratedQuestion['kind'], string> = {
  MAIN: 'What is one relevant example from your experience?',
  PROBE: 'What detail from your example would you add?',
  CLARIFY: 'Which part of the situation did you personally handle?',
  REDIRECT: 'What relevant example from your experience answers the question?',
  HYPOTHETICAL: 'What would you do first in this situation?',
  REPHRASE: 'What is one relevant example from your experience?',
};

function upgradeLegacyQuestion(
  raw: LegacyQuestion,
  seniority: ExperienceLevel,
  index: number,
): CandidateQuestion {
  const questionType = raw.question_type ?? 'BEHAVIOURAL';
  const kind = raw.kind ?? 'MAIN';
  const candidateText = raw.candidate_text ?? raw.text ?? '';
  const input = {
    question_id: raw.question_id ?? `legacy_${index + 1}`,
    candidate_text: candidateText,
    interviewer_intent: raw.interviewer_intent ?? raw.primary_intent ?? raw.intent ?? 'LEGACY_QUESTION',
    probe_targets: raw.probe_targets ?? [],
    question_type: questionType,
    target_competencies: raw.target_competencies ?? [],
    seniority,
    language: 'en' as const,
    source: raw.source ?? (raw.prompt_version ? 'MODEL' as const : 'BANK' as const),
    prompt_version: raw.prompt_version ?? null,
    framework: raw.framework ?? frameworkForQuestionType(questionType),
    kind,
    rephrase_text: fixedRephrase(questionType),
  };
  const validation = validateQuestionObject(input);
  if (validation.ok && candidateCopySafeValue(candidateText)) return validation.question;
  console.warn('question_rejected', {
    event: 'question_rejected',
    source: input.source,
    question_id: input.question_id,
    reasons: validation.ok ? ['FORBIDDEN_CANDIDATE_COPY'] : validation.reasons,
    prompt_version: input.prompt_version,
  });
  return makeValidatedQuestion({ ...input, candidate_text: LEGACY_SAFE_TEXT[kind], source: 'BANK', prompt_version: null });
}

/** Upgrade encrypted interviews created before the canonical question schema. */
export function upgradeStoredQuestionState(state: InterviewState): InterviewState {
  const next = structuredClone(state);
  next.plan = (next.plan as unknown as LegacyQuestion[]).map((raw, index) => ({
    ...upgradeLegacyQuestion(raw, next.seniority, index),
    slot: raw.slot ?? index + 1,
  }));
  next.role_pack.question_bank = (next.role_pack.question_bank as unknown as LegacyQuestion[]).flatMap((raw, index) => {
    try {
      return [upgradeLegacyQuestion(raw, next.seniority, index)];
    } catch {
      return [];
    }
  });
  if (next.current_question) {
    next.current_question = upgradeLegacyQuestion(
      next.current_question as unknown as LegacyQuestion,
      next.seniority,
      next.question_number - 1,
    );
  }
  return next;
}
