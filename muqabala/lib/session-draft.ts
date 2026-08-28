import type { Lang } from './i18n';
import type { Question } from './roles';
import type { AnswerFeedback } from './scoring';

export const SESSION_DRAFT_VERSION = 2 as const;
export const SESSION_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ResumeStage = 'prep' | 'review' | 'feedback';
export type AnswerMethod = 'speak' | 'type' | 'video';
export type InterviewMode = 'guided' | 'mock' | 'screening';

export type DraftAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

export type DraftPreviousTry = {
  transcript: string;
  feedback: AnswerFeedback;
};

export type InterviewSessionDraft = {
  version: typeof SESSION_DRAFT_VERSION;
  roleId: string;
  customTitle?: string;
  interviewToken?: string;
  tailored: boolean;
  fellBack: boolean;
  language: Lang;
  stage: ResumeStage;
  questionIndex: number;
  mode: InterviewMode;
  answerMethod: AnswerMethod;
  transcript: string;
  transcriptConfirmed: boolean;
  feedback: AnswerFeedback | null;
  answers: DraftAnswer[];
  previousTry: DraftPreviousTry | null;
  attemptCount: number;
  serverAttemptId: string | null;
  reportGateRequired: boolean;
  reportUnlocked: boolean;
  questionSnapshot: Question[];
  updatedAt: string;
};

export type SaveInterviewSessionDraft = Omit<InterviewSessionDraft, 'version' | 'updatedAt' | 'stage'> & {
  stage: 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  & Partial<Pick<Storage, 'length' | 'key'>>;

function titleKey(customTitle?: string): string {
  const normalised = customTitle?.trim().toLocaleLowerCase('en').slice(0, 96) || 'catalogue';
  return encodeURIComponent(normalised);
}

export function interviewDraftKey(roleId: string, customTitle?: string): string {
  return `muqabala.interview.v2.${encodeURIComponent(roleId)}.${titleKey(customTitle)}`;
}

function legacyDraftKey(roleId: string): string {
  return `muqabala.draft.v1.${roleId}`;
}

const LATEST_CUSTOM_DRAFT_KEY = 'muqabala.interview.v2.latest.custom';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isQuestion(value: unknown): value is Question {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.text === 'string'
    && typeof value.textAr === 'string'
    && typeof value.hint === 'string'
    && typeof value.hintAr === 'string'
    && typeof value.prepSeconds === 'number'
    && Number.isFinite(value.prepSeconds)
    && typeof value.answerSeconds === 'number'
    && Number.isFinite(value.answerSeconds)
    && isStringArray(value.competencies);
}

function isFeedback(value: unknown): value is AnswerFeedback {
  if (!isRecord(value)) return false;
  if (value.status !== 'scored' && value.status !== 'unscored') return false;
  if (value.source !== 'ai' && value.source !== 'structure' && value.source !== 'none') return false;
  if (typeof value.questionId !== 'string' || typeof value.score !== 'number' || !Number.isFinite(value.score)) return false;
  if (typeof value.headline !== 'string' || typeof value.coachTip !== 'string') return false;
  if (!isStringArray(value.strengths) || !isStringArray(value.improvements) || !Array.isArray(value.competencies)) return false;
  return value.competencies.every((competency) => isRecord(competency)
    && typeof competency.id === 'string'
    && typeof competency.label === 'string'
    && typeof competency.score === 'number'
    && Number.isFinite(competency.score)
    && (competency.evidence === null || typeof competency.evidence === 'string'));
}

function isDraftAnswer(value: unknown): value is DraftAnswer {
  return isRecord(value)
    && typeof value.questionId === 'string'
    && typeof value.questionText === 'string'
    && typeof value.transcript === 'string'
    && isFeedback(value.feedback);
}

function parseV2(value: unknown, roleId: string, customTitle: string | undefined, now: number): InterviewSessionDraft | null {
  if (!isRecord(value) || value.version !== SESSION_DRAFT_VERSION || value.roleId !== roleId) return null;
  if ((value.customTitle ?? undefined) !== (customTitle ?? undefined)) return null;
  if (value.interviewToken !== undefined && typeof value.interviewToken !== 'string') return null;
  if (typeof value.tailored !== 'boolean' || typeof value.fellBack !== 'boolean') return null;
  if (value.language !== 'en' && value.language !== 'ar') return null;
  if (value.stage !== 'prep' && value.stage !== 'review' && value.stage !== 'feedback') return null;
  if (value.mode !== 'guided' && value.mode !== 'mock' && value.mode !== 'screening') return null;
  if (value.answerMethod !== 'speak' && value.answerMethod !== 'type' && value.answerMethod !== 'video') return null;
  if (!Number.isInteger(value.questionIndex) || (value.questionIndex as number) < 0) return null;
  if (typeof value.transcript !== 'string' || typeof value.transcriptConfirmed !== 'boolean') return null;
  if (value.feedback !== null && !isFeedback(value.feedback)) return null;
  if (!Array.isArray(value.answers) || !value.answers.every(isDraftAnswer)) return null;
  if (value.previousTry !== null && !(isRecord(value.previousTry)
    && typeof value.previousTry.transcript === 'string'
    && isFeedback(value.previousTry.feedback))) return null;
  if (!Number.isInteger(value.attemptCount) || (value.attemptCount as number) < 1) return null;
  if (value.serverAttemptId !== null && typeof value.serverAttemptId !== 'string') return null;
  if (typeof value.reportGateRequired !== 'boolean') return null;
  if (typeof value.reportUnlocked !== 'boolean') return null;
  if (!Array.isArray(value.questionSnapshot) || value.questionSnapshot.length === 0 || !value.questionSnapshot.every(isQuestion)) return null;
  if ((value.questionIndex as number) >= value.questionSnapshot.length) return null;
  if (typeof value.updatedAt !== 'string') return null;
  const updatedAt = Date.parse(value.updatedAt);
  if (!Number.isFinite(updatedAt) || now - updatedAt > SESSION_DRAFT_MAX_AGE_MS || updatedAt - now > 5 * 60 * 1000) return null;
  if (value.stage === 'feedback' && value.feedback === null) return null;
  return value as InterviewSessionDraft;
}

function safeResumeStage(stage: SaveInterviewSessionDraft['stage'], transcript: string, feedback: AnswerFeedback | null): ResumeStage {
  if (stage === 'feedback' && feedback) return 'feedback';
  if (stage === 'review') return 'review';
  if (stage === 'record' && transcript.trim()) return 'review';
  return 'prep';
}

function sanitiseQuestion(question: Question): Question {
  return {
    id: question.id,
    text: question.text,
    textAr: question.textAr,
    competencies: [...question.competencies],
    prepSeconds: question.prepSeconds,
    answerSeconds: question.answerSeconds,
    hint: question.hint,
    hintAr: question.hintAr,
  };
}

function sanitiseFeedback(feedback: AnswerFeedback): AnswerFeedback {
  return {
    questionId: feedback.questionId,
    score: feedback.score,
    status: feedback.status,
    headline: feedback.headline,
    competencies: feedback.competencies.map((competency) => ({
      id: competency.id,
      label: competency.label,
      score: competency.score,
      evidence: competency.evidence,
    })),
    strengths: [...feedback.strengths],
    improvements: [...feedback.improvements],
    coachTip: feedback.coachTip,
    source: feedback.source,
    ...(feedback.scoringVersion ? { scoringVersion: feedback.scoringVersion } : {}),
    ...(feedback.rubricVersion ? { rubricVersion: feedback.rubricVersion } : {}),
  };
}

function sanitiseDraft(input: SaveInterviewSessionDraft, now: number): InterviewSessionDraft {
  return {
    version: SESSION_DRAFT_VERSION,
    roleId: input.roleId,
    ...(input.customTitle ? { customTitle: input.customTitle } : {}),
    ...(input.interviewToken ? { interviewToken: input.interviewToken } : {}),
    tailored: input.tailored,
    fellBack: input.fellBack,
    language: input.language,
    stage: safeResumeStage(input.stage, input.transcript, input.feedback),
    questionIndex: input.questionIndex,
    mode: input.mode,
    answerMethod: input.answerMethod,
    transcript: input.transcript,
    transcriptConfirmed: input.transcriptConfirmed,
    feedback: input.feedback ? sanitiseFeedback(input.feedback) : null,
    answers: input.answers.map((answer) => ({
      questionId: answer.questionId,
      questionText: answer.questionText,
      transcript: answer.transcript,
      feedback: sanitiseFeedback(answer.feedback),
    })),
    previousTry: input.previousTry ? {
      transcript: input.previousTry.transcript,
      feedback: sanitiseFeedback(input.previousTry.feedback),
    } : null,
    attemptCount: input.attemptCount,
    serverAttemptId: input.serverAttemptId,
    reportGateRequired: input.reportGateRequired,
    reportUnlocked: input.reportUnlocked,
    questionSnapshot: input.questionSnapshot.map(sanitiseQuestion),
    updatedAt: new Date(now).toISOString(),
  };
}

export function saveInterviewDraft(storage: StorageLike, input: SaveInterviewSessionDraft, now = Date.now()): boolean {
  try {
    const draft = sanitiseDraft(input, now);
    const key = interviewDraftKey(input.roleId, input.customTitle);
    storage.setItem(key, JSON.stringify(draft));
    if (input.roleId === 'custom' && input.customTitle) {
      storage.setItem(LATEST_CUSTOM_DRAFT_KEY, JSON.stringify({ customTitle: input.customTitle }));
    }
    return true;
  } catch {
    return false;
  }
}

export function discardInterviewDraft(storage: StorageLike, roleId: string, customTitle?: string): void {
  try {
    storage.removeItem(interviewDraftKey(roleId, customTitle));
    storage.removeItem(legacyDraftKey(roleId));
    if (roleId === 'custom') storage.removeItem(LATEST_CUSTOM_DRAFT_KEY);
  } catch {
    // Storage can be blocked. The in-memory interview still remains usable.
  }
}

/** Remove every expired or unreadable local draft, not only the role being opened. */
export function purgeExpiredInterviewDrafts(storage: StorageLike, now = Date.now()): void {
  try {
    if (typeof storage.length !== 'number' || typeof storage.key !== 'function') return;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key || key === LATEST_CUSTOM_DRAFT_KEY) continue;
      if (!key.startsWith('muqabala.interview.v2.') && !key.startsWith('muqabala.draft.v1.')) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      let updatedAt = Number.NaN;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (isRecord(parsed) && typeof parsed.updatedAt === 'string') updatedAt = Date.parse(parsed.updatedAt);
      } catch {
        // The invalid value is removed below.
      }
      if (!Number.isFinite(updatedAt)
        || now - updatedAt > SESSION_DRAFT_MAX_AGE_MS
        || updatedAt - now > 5 * 60 * 1000) {
        storage.removeItem(key);
      }
    }
    const latestRaw = storage.getItem(LATEST_CUSTOM_DRAFT_KEY);
    if (latestRaw) {
      const latest = JSON.parse(latestRaw) as unknown;
      if (!isRecord(latest) || typeof latest.customTitle !== 'string'
        || !storage.getItem(interviewDraftKey('custom', latest.customTitle))) {
        storage.removeItem(LATEST_CUSTOM_DRAFT_KEY);
      }
    }
  } catch {
    // Storage can be blocked. The interview remains usable in memory.
  }
}

export function loadInterviewDraft(
  storage: StorageLike,
  options: { roleId: string; customTitle?: string; fallbackLanguage: Lang; fallbackQuestions: Question[]; now?: number },
): InterviewSessionDraft | null {
  const now = options.now ?? Date.now();
  const key = interviewDraftKey(options.roleId, options.customTitle);
  try {
    purgeExpiredInterviewDrafts(storage, now);
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = parseV2(JSON.parse(raw), options.roleId, options.customTitle, now);
      if (parsed) return parsed;
      storage.removeItem(key);
    }

    const legacyKey = legacyDraftKey(options.roleId);
    const legacyRaw = storage.getItem(legacyKey);
    if (!legacyRaw) return null;
    const legacy = JSON.parse(legacyRaw) as unknown;
    if (!isRecord(legacy) || typeof legacy.updatedAt !== 'string') {
      storage.removeItem(legacyKey);
      return null;
    }
    const age = now - Date.parse(legacy.updatedAt);
    if (!Number.isFinite(age) || age > SESSION_DRAFT_MAX_AGE_MS || age < -5 * 60 * 1000) {
      storage.removeItem(legacyKey);
      return null;
    }
    const questions = Array.isArray(legacy.questionSnapshot) && legacy.questionSnapshot.length > 0
      && legacy.questionSnapshot.every(isQuestion)
      ? legacy.questionSnapshot
      : options.fallbackQuestions;
    const questionIndex = Number.isInteger(legacy.index)
      ? Math.max(0, Math.min(questions.length - 1, legacy.index as number))
      : 0;
    const transcript = typeof legacy.transcript === 'string' ? legacy.transcript : '';
    const answers = Array.isArray(legacy.answers) && legacy.answers.every(isDraftAnswer) ? legacy.answers : [];
    const migrated = sanitiseDraft({
      roleId: options.roleId,
      customTitle: options.customTitle,
      tailored: false,
      fellBack: false,
      language: options.fallbackLanguage,
      stage: transcript.trim() ? 'review' : 'prep',
      questionIndex,
      mode: legacy.mode === 'mock' ? 'mock' : 'guided',
      answerMethod: 'type',
      transcript,
      transcriptConfirmed: false,
      feedback: null,
      answers,
      previousTry: null,
      attemptCount: 1,
      serverAttemptId: typeof legacy.id === 'string' ? legacy.id : null,
      reportGateRequired: Boolean(legacy.id),
      reportUnlocked: legacy.unlocked === true,
      questionSnapshot: questions,
    }, now);
    storage.setItem(key, JSON.stringify(migrated));
    storage.removeItem(legacyKey);
    return migrated;
  } catch {
    try {
      storage.removeItem(key);
      storage.removeItem(legacyDraftKey(options.roleId));
    } catch {
      // Ignore blocked storage.
    }
    return null;
  }
}

export function loadLatestCustomInterviewDraft(storage: StorageLike, now = Date.now()): InterviewSessionDraft | null {
  try {
    const pointerRaw = storage.getItem(LATEST_CUSTOM_DRAFT_KEY);
    if (!pointerRaw) return null;
    const pointer = JSON.parse(pointerRaw) as unknown;
    if (!isRecord(pointer) || typeof pointer.customTitle !== 'string') {
      storage.removeItem(LATEST_CUSTOM_DRAFT_KEY);
      return null;
    }
    const key = interviewDraftKey('custom', pointer.customTitle);
    const raw = storage.getItem(key);
    if (!raw) {
      storage.removeItem(LATEST_CUSTOM_DRAFT_KEY);
      return null;
    }
    const parsed = parseV2(JSON.parse(raw), 'custom', pointer.customTitle, now);
    if (parsed) return parsed;
    storage.removeItem(key);
    storage.removeItem(LATEST_CUSTOM_DRAFT_KEY);
    return null;
  } catch {
    try { storage.removeItem(LATEST_CUSTOM_DRAFT_KEY); } catch { /* blocked storage */ }
    return null;
  }
}
