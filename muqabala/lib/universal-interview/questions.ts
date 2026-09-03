import type {
  CoverageStatus,
  Framework,
  GeneratedQuestion,
  InterviewState,
  PlannedQuestion,
  QuestionType,
} from './types.ts';

const FORBIDDEN_CANDIDATE_COPY = /\b(?:contradiction|lie|dishonest|inconsistent|MVP|V2|beta|prototype|prompt version|model call)\b|—/i;
const NON_ENGLISH_SCRIPT = /[\u0370-\u052f\u0590-\u109f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;
const INTERVIEWER_GUIDE_PREFIX = /^(?:(?:what|which)\s+(?:specific\s+)?example\s+shows\s+)?(?:ask(?:\s+(?:the\s+)?candidate|\s+for)\b|(?:why|what|how|whether|where|when)\s+the candidate\b|the candidate\b|interviewer(?:\s+should)?\b|probe(?:\s+for|\s+the)?\b|follow[- ]?up\b)/i;
const INTERNAL_ATTACHMENT_REFERENCE = /\b(?:from|in)\s+(?:the\s+)?(?:job|hotel|employer|uploaded)?\s*attachment\b/i;

const SAFE_QUESTION_FALLBACKS: Record<GeneratedQuestion['kind'], string> = {
  MAIN: 'What experience best shows your fit for this role?',
  PROBE: 'What is one specific example from your experience?',
  CLARIFY: 'What part did you personally handle in that situation?',
  REDIRECT: 'What relevant example answers the original question?',
  HYPOTHETICAL: 'If you faced this situation, what would you do first?',
  REPHRASE: 'What relevant example would you like to use?',
};

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

export function fromPlannedQuestion(question: PlannedQuestion): GeneratedQuestion {
  return {
    text: question.text,
    question_type: question.question_type,
    target_competencies: question.target_competencies,
    intent: question.primary_intent,
    framework: question.framework,
    kind: 'MAIN',
  };
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function candidateCopySafeValue(value: unknown): boolean {
  return !FORBIDDEN_CANDIDATE_COPY.test(JSON.stringify(value));
}

export function candidateQuestionSafetyReason(
  text: string,
  kind: GeneratedQuestion['kind'],
): string | null {
  const trimmed = text.trim();
  const questionMarks = (trimmed.match(/\?/g) ?? []).length;
  const limit = kind === 'MAIN' || kind === 'REPHRASE' ? 45 : 30;
  if (trimmed.length < 5 || wordCount(trimmed) < 2) return 'question_too_short';
  if (questionMarks > 1) return 'more_than_one_question_mark';
  if (wordCount(trimmed) > limit) return 'word_limit';
  if (!candidateCopySafeValue(trimmed)) return 'forbidden_candidate_facing_wording';
  if (NON_ENGLISH_SCRIPT.test(trimmed)) return 'non_english_script';
  if (/^(?:great|thanks)\b/i.test(trimmed)) return 'starts_with_praise';
  if (/\band\b[^?]*\?/i.test(trimmed)) return 'possible_double_barrelled_question';
  if (INTERVIEWER_GUIDE_PREFIX.test(trimmed)) return 'interviewer_instruction';
  if (INTERNAL_ATTACHMENT_REFERENCE.test(trimmed)) return 'internal_attachment_reference';
  return null;
}

export function candidateSafeQuestion(question: GeneratedQuestion): GeneratedQuestion {
  if (!candidateQuestionSafetyReason(question.text, question.kind)) {
    return { ...question, text: question.text.trim() };
  }
  return { ...question, text: SAFE_QUESTION_FALLBACKS[question.kind] };
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
  state: Pick<InterviewState, 'coverage' | 'dedupe_keys'>,
): { ok: true } | { ok: false; reason: string } {
  const safetyFailure = candidateQuestionSafetyReason(question.text, question.kind);
  if (safetyFailure) return { ok: false, reason: safetyFailure };
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
    PROBE_SCALE: 'What was the scale of that work?',
    PROBE_REASONING: 'What reasoning led you to that decision?',
    CLARIFY: 'Earlier you described the scope differently. Which scope applies?',
    REDIRECT: 'What relevant example answers the original question?',
    OFFER_HYPOTHETICAL: 'If you faced this situation, what would you do first?',
  };
  return {
    ...current,
    text: textByAction[action] ?? current.text,
    kind: action === 'CLARIFY'
      ? 'CLARIFY'
      : action === 'REDIRECT'
        ? 'REDIRECT'
        : action === 'OFFER_HYPOTHETICAL'
          ? 'HYPOTHETICAL'
          : 'PROBE',
  };
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
  return {
    text: `Tell me about one example that shows your ${competency.name.toLowerCase()}.`,
    question_type: questionType,
    target_competencies: [competency.id],
    intent: 'REPLACEMENT_FOR_COVERED_COMPETENCY',
    framework: frameworkForQuestionType(questionType),
    kind: 'MAIN',
  };
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
