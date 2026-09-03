import type { CandidateQuestion, ExperienceLevel, QuestionType } from './types.ts';

export const CANDIDATE_TEXT_REASON_CODES = [
  'THIRD_PERSON',
  'INTERVIEWER_VERB',
  'NON_LATIN',
  'QMARK_COUNT',
  'QMARK_POSITION',
  'DOUBLE_PUNCT',
  'TOO_LONG',
  'MULTI_QUESTION',
  'CONJUNCTION_OVERLOAD',
  'FILLER_START',
  'PLACEHOLDER',
  'EMPTY',
  'NOT_SECOND_PERSON',
] as const;

export type CandidateTextReason = (typeof CANDIDATE_TEXT_REASON_CODES)[number];

export type CandidateTextValidation = {
  ok: boolean;
  reasons: CandidateTextReason[];
};

const THIRD_PERSON = /\b(?:the candidate|candidate[’']s)\b|\bthey\s+(?:apply|applied|want|wanted|have|had|bring|brought|fit|know|understand|understood|worked|managed)\b|\btheir\s+(?:application|background|career|experience|fit|motivation|role|skills?|understanding)\b|\bthem\b.{0,30}\b(?:application|background|experience|job|role|skills?)\b/i;
const INTERVIEWER_VERB = /\b(?:ask for|ask the|ask about|probe|assess|check whether|look for|explore whether|evaluate)\b/i;
const FILLER_START = /^(?:great|thanks|thank you|now|so|okay|well)\b/i;
const PLACEHOLDER = /[{}\[\]<>]|\b(?:TODO|TBD|XXX)\b/i;
const SECOND_PERSON = /\b(?:you|your)\b/i;
const CLAUSE_START = /(?:^|[.!?;:]\s+|,\s+|\band\s+)(?:what|why|how|when|where|which|tell me|describe)\b/gi;
const COMMON_PUNCTUATION = /^[.,?!'’"“”:;()/%&+\-]$/u;

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function containsNonLatin(text: string): boolean {
  return [...text].some((character) => {
    if (/^[\p{Script=Latin}\p{M}\p{N}\s]$/u.test(character)) return false;
    return !COMMON_PUNCTUATION.test(character);
  });
}

export function validateCandidateText(
  text: string,
  options: { language: 'en'; seniority: ExperienceLevel },
): CandidateTextValidation {
  const value = typeof text === 'string' ? text.trim() : '';
  const reasons: CandidateTextReason[] = [];
  const add = (reason: CandidateTextReason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (!value) add('EMPTY');
  if (THIRD_PERSON.test(value)) add('THIRD_PERSON');
  if (INTERVIEWER_VERB.test(value)) add('INTERVIEWER_VERB');
  if (options.language === 'en' && containsNonLatin(value)) add('NON_LATIN');
  const interrogativeClauses = (value.match(CLAUSE_START) ?? []).length;
  if ((value.match(/\?/g) ?? []).length !== 1 || interrogativeClauses > 1) add('QMARK_COUNT');
  if (!value.endsWith('?')) add('QMARK_POSITION');
  if (/\.\?|\?\.|\?\?|,\?/.test(value)) add('DOUBLE_PUNCT');
  const wordLimit = options.seniority === 'ENTRY' ? 35 : 45;
  if (wordCount(value) > wordLimit || (options.seniority === 'ENTRY' && value.length > 160)) add('TOO_LONG');
  if (interrogativeClauses > 1) add('MULTI_QUESTION');
  const conjunctions = (value.match(/ and /gi) ?? []).length;
  if (conjunctions > 2 || (INTERVIEWER_VERB.test(value) && conjunctions > 1)) add('CONJUNCTION_OVERLOAD');
  if (FILLER_START.test(value)) add('FILLER_START');
  if (PLACEHOLDER.test(value)) add('PLACEHOLDER');
  if (!SECOND_PERSON.test(value)) add('NOT_SECOND_PERSON');

  return { ok: reasons.length === 0, reasons };
}

export type CandidateQuestionInput = Omit<CandidateQuestion, 'validated'>;

export function validateQuestionObject(
  question: CandidateQuestionInput,
): { ok: true; question: CandidateQuestion } | { ok: false; reasons: CandidateTextReason[] } {
  const validation = validateCandidateText(question.candidate_text, {
    language: question.language,
    seniority: question.seniority,
  });
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  const rephraseValidation = validateCandidateText(question.rephrase_text, {
    language: question.language,
    seniority: question.seniority,
  });
  if (!rephraseValidation.ok) return { ok: false, reasons: rephraseValidation.reasons };

  return {
    ok: true,
    question: {
      ...question,
      candidate_text: question.candidate_text.trim(),
      rephrase_text: question.rephrase_text.trim(),
      validated: true,
    },
  };
}

export type QuestionRejectedLog = {
  event: 'question_rejected';
  source: CandidateQuestion['source'];
  question_id: string;
  reasons: string[];
  prompt_version: string | null;
};

export function rejectedQuestionLog(
  question: CandidateQuestionInput,
  reasons: string[],
): QuestionRejectedLog {
  return {
    event: 'question_rejected',
    source: question.source,
    question_id: question.question_id,
    reasons,
    prompt_version: question.prompt_version,
  };
}

export function loadValidatedQuestionBank(
  rows: CandidateQuestionInput[],
  log: (entry: QuestionRejectedLog) => void = (entry) => console.warn('question_rejected', entry),
): CandidateQuestion[] {
  return rows.flatMap((row) => {
    const result = validateQuestionObject(row);
    if (result.ok) return [result.question];
    log(rejectedQuestionLog(row, result.reasons));
    return [];
  });
}

export function assertValidatedQuestion<T extends CandidateQuestion>(question: T): T {
  const candidateValidation = validateCandidateText(question.candidate_text, {
    language: question.language,
    seniority: question.seniority,
  });
  const rephraseValidation = validateCandidateText(question.rephrase_text, {
    language: question.language,
    seniority: question.seniority,
  });
  if (question.validated !== true || !candidateValidation.ok || !rephraseValidation.ok) {
    throw new Error(`Refusing to serve unvalidated question ${question.question_id}.`);
  }
  return question;
}

export function serialiseCandidateQuestion(
  question: CandidateQuestion,
  questionNumber: number,
  totalQuestions: number,
) {
  const safe = assertValidatedQuestion(question);
  return {
    question_id: safe.question_id,
    candidate_text: safe.candidate_text,
    question_number: questionNumber,
    total_questions: totalQuestions,
  };
}

export function fixedRephrase(questionType: QuestionType): string {
  if (questionType === 'MOTIVATION') return 'Why is this role the right next step for you?';
  if (questionType === 'SITUATIONAL') return 'What would you do first in this situation?';
  if (questionType === 'TECHNICAL' || questionType === 'ROLE_KNOWLEDGE') {
    return 'How would you apply your knowledge in this situation?';
  }
  if (questionType === 'INTRODUCTION' || questionType === 'CAREER_HISTORY') {
    return 'What experience from your background is most relevant here?';
  }
  return 'What is one relevant example from your experience?';
}
