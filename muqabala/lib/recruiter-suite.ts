import type { Question, Role } from '@/lib/roles';

export const RECRUITER_ATTENTION_LIMIT = 3;
export const CLOSING_ATTENTION_HOURS = 48;
export const MANUAL_REMINDER_INTERVAL_HOURS = 24;
export const RECRUITER_SUMMARY_VERSION = 'extractive-v1';

const HOUR_MS = 60 * 60 * 1000;

export type RecruiterRoleState = 'draft' | 'active' | 'closing' | 'full' | 'closed';

export type RoleNextAction = {
  kind: 'continue' | 'copy' | 'review' | 'shortlist' | 'submissions' | 'results';
  label: string;
  href: string | null;
  countUnit?: 'submissions';
  supportingText: string;
};

export function resolveRoleNextAction(input: {
  roleId: string;
  state: RecruiterRoleState;
  submissionCount: number;
  unreviewedCount: number;
  shortlistCount: number;
  incompleteStage?: string;
}): RoleNextAction {
  if (input.state === 'draft') {
    return {
      kind: 'continue',
      label: 'Continue setup',
      href: '/for-employers#create',
      supportingText: input.incompleteStage ? `Continue from ${input.incompleteStage}.` : 'Finish the role before sharing it.',
    };
  }
  if (input.unreviewedCount > 0) {
    return {
      kind: 'review',
      label: `Review ${input.unreviewedCount} ${input.unreviewedCount === 1 ? 'submission' : 'submissions'}`,
      href: `/employer/roles/${input.roleId}?candidateStatus=unreviewed#submissions`,
      countUnit: 'submissions',
      supportingText: input.state === 'closed' ? 'The role is closed, but submitted evidence still needs review.' : 'Open the submissions waiting for a human review.',
    };
  }
  if (input.submissionCount === 0 && input.state !== 'closed') {
    return {
      kind: 'copy',
      label: 'Copy invitation',
      href: null,
      supportingText: 'Submissions will appear here after candidates complete and share them.',
    };
  }
  if (input.shortlistCount > 0) {
    return {
      kind: 'shortlist',
      label: 'View shortlist',
      href: `/employer/roles/${input.roleId}?candidateStatus=shortlisted#submissions`,
      supportingText: `${input.shortlistCount} ${input.shortlistCount === 1 ? 'candidate is' : 'candidates are'} shortlisted.`,
    };
  }
  if (input.state === 'closed') {
    return {
      kind: 'results',
      label: 'View results',
      href: `/employer/roles/${input.roleId}#submissions`,
      supportingText: 'Review the completed role results.',
    };
  }
  return {
    kind: 'submissions',
    label: 'View submissions',
    href: `/employer/roles/${input.roleId}#submissions`,
    supportingText: 'All submitted evidence has been reviewed. Shortlisting is optional.',
  };
}

export function resolveAvailableRoleNextAction(input: {
  roleId: string;
  state: RecruiterRoleState;
  submissionCount: number | null;
  unreviewedCount: number | null;
  shortlistCount: number | null;
}): RoleNextAction | null {
  if (input.submissionCount === null || input.unreviewedCount === null || input.shortlistCount === null) return null;
  return resolveRoleNextAction({
    roleId: input.roleId,
    state: input.state,
    submissionCount: input.submissionCount,
    unreviewedCount: input.unreviewedCount,
    shortlistCount: input.shortlistCount,
  });
}

export type AttentionItem = {
  id: string;
  kind: 'reviews' | 'questions' | 'interrupted' | 'closing';
  title: string;
  detail: string;
  action: string;
  href: string;
};

export function filterCandidateSubmissions<T extends { employer_reviewed_at?: string | null; employer_decision?: string | null }>(
  submissions: T[],
  filter: 'all' | 'unreviewed' | 'shortlisted',
): T[] {
  if (filter === 'unreviewed') return submissions.filter((submission) => !submission.employer_reviewed_at);
  if (filter === 'shortlisted') return submissions.filter((submission) => ['shortlist', 'shortlisted'].includes(submission.employer_decision || ''));
  return submissions;
}

export function buildAttentionItems(input: {
  pendingSubmissions: number;
  unresolvedQuestions: number;
  interruptedUploads?: number;
  closingRoles: Array<{ id: string; title: string; expiresAt: string; timezone: string }>;
  now?: Date;
  closingHours?: number;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const closingHours = input.closingHours ?? CLOSING_ATTENTION_HOURS;
  const limit = input.limit ?? RECRUITER_ATTENTION_LIMIT;
  const all: AttentionItem[] = [];
  if (input.pendingSubmissions > 0) {
    all.push({
      id: 'pending-submissions',
      kind: 'reviews',
      title: `${input.pendingSubmissions} ${input.pendingSubmissions === 1 ? 'submission' : 'submissions'} awaiting review`,
      detail: 'Open the combined queue to review the oldest submissions first.',
      action: 'Review submissions',
      href: '/employer?candidateStatus=unreviewed#candidates',
    });
  }
  if (input.unresolvedQuestions > 0) {
    all.push({
      id: 'candidate-questions',
      kind: 'questions',
      title: `${input.unresolvedQuestions} unresolved candidate ${input.unresolvedQuestions === 1 ? 'question' : 'questions'}`,
      detail: 'Reply and resolution remain separate actions.',
      action: 'View questions',
      href: '/employer/questions',
    });
  }
  if ((input.interruptedUploads ?? 0) > 0) {
    const count = input.interruptedUploads ?? 0;
    all.push({
      id: 'interrupted-uploads',
      kind: 'interrupted',
      title: 'Upload interrupted',
      detail: `${count} ${count === 1 ? 'candidate lost' : 'candidates lost'} connection during an answer. No pre-consent identity is shown.`,
      action: 'Prepare retry invitation',
      href: '/for-employers#create',
    });
  }
  const threshold = now.getTime() + closingHours * HOUR_MS;
  const closing = input.closingRoles
    .filter((role) => {
      const closes = Date.parse(role.expiresAt);
      return Number.isFinite(closes) && closes > now.getTime() && closes <= threshold;
    })
    .sort((left, right) => Date.parse(left.expiresAt) - Date.parse(right.expiresAt));
  for (const role of closing) {
    all.push({
      id: `closing-${role.id}`,
      kind: 'closing',
      title: `${role.title} invitation closes soon`,
      detail: `Closing time is shown in ${role.timezone} on the role page.`,
      action: 'View role',
      href: `/employer/roles/${role.id}`,
    });
  }
  return { items: all.slice(0, Math.max(0, limit)), allItems: all, total: all.length, hasMore: all.length > limit };
}

export type ReminderInvite = {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  contactAllowed?: boolean | null;
  optedOutAt?: string | null;
  withdrawnAt?: string | null;
  deletedAt?: string | null;
  lastManualReminderAt?: string | null;
  firstReminderAt?: string | null;
  secondReminderAt?: string | null;
  completionReminderAt?: string | null;
  deliveryStatus?: string | null;
  deliveryUpdatedAt?: string | null;
  deliveryErrorCode?: string | null;
};

export type ReminderEligibility = ReminderInvite & {
  eligible: boolean;
  reason: string | null;
  lastReminderAt: string | null;
};

const NON_RETRYABLE_DELIVERY_FAILURES = new Set([
  'email.bounced',
  'email.complained',
  'email.suppressed',
  'hard_bounce',
  'complaint',
  'provider_suppressed',
]);

export function manualReminderFailureCanRetry(status?: string | null, errorCode?: string | null): boolean {
  return status === 'failed' && Boolean(errorCode) && !NON_RETRYABLE_DELIVERY_FAILURES.has(errorCode!);
}

export function reminderEligibility(
  invite: ReminderInvite,
  role: { expiresAt: string; remindersEnabled: boolean },
  now = new Date(),
  intervalHours = MANUAL_REMINDER_INTERVAL_HOURS,
): ReminderEligibility {
  const terminalFailure = manualReminderFailureCanRetry(invite.deliveryStatus, invite.deliveryErrorCode);
  const lastReminderAt = [
    terminalFailure ? null : invite.lastManualReminderAt,
    invite.firstReminderAt,
    invite.secondReminderAt,
    invite.completionReminderAt,
  ].filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  let reason: string | null = null;
  if (!role.remindersEnabled) reason = 'Reminders are switched off for this role.';
  else if (Date.parse(role.expiresAt) <= now.getTime()) reason = 'The invitation has closed.';
  else if (!['invited', 'started'].includes(invite.status)) reason = invite.status === 'submitted' ? 'Submission completed.' : 'This invite is no longer active.';
  else if (!invite.email) reason = 'No supported email channel.';
  else if (invite.contactAllowed === false || invite.optedOutAt) reason = 'The candidate cannot be contacted.';
  else if (invite.withdrawnAt || invite.deletedAt) reason = 'The candidate is no longer eligible.';
  else if (invite.deliveryStatus === 'pending' || invite.deliveryStatus === 'processing') reason = 'A reminder is already queued.';
  else if ((invite.deliveryStatus === 'accepted' || invite.deliveryStatus === 'delivered')
    && invite.deliveryUpdatedAt
    && now.getTime() - Date.parse(invite.deliveryUpdatedAt) < intervalHours * HOUR_MS) reason = `Already reminded within ${intervalHours} hours.`;
  else if (invite.deliveryStatus === 'failed' && !terminalFailure) reason = 'This delivery failure is not safe to retry automatically.';
  else if (invite.deliveryStatus === 'cancelled') reason = 'The previous reminder was cancelled.';
  else if (lastReminderAt && now.getTime() - Date.parse(lastReminderAt) < intervalHours * HOUR_MS) reason = `Already reminded within ${intervalHours} hours.`;
  return { ...invite, eligible: reason === null, reason, lastReminderAt };
}

export function preparePublishedFaq(question: string, answer: string, candidateEmail: string): { question: string; answer: string } | null {
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
  const publishedQuestion = clean(question);
  const publishedAnswer = clean(answer);
  if (publishedQuestion.length < 4 || publishedQuestion.length > 240 || publishedAnswer.length < 1 || publishedAnswer.length > 1000) return null;
  const combined = `${publishedQuestion} ${publishedAnswer}`.toLocaleLowerCase();
  const candidateAddress = candidateEmail.trim().toLocaleLowerCase();
  const containsEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(combined);
  const containsPhone = /(?:\+?\d[\s().-]*){7,}/.test(combined);
  if (containsEmail || containsPhone || (candidateAddress && combined.includes(candidateAddress))) return null;
  return { question: publishedQuestion, answer: publishedAnswer };
}

export type PublishedRoleFacts = {
  roleTitle: string;
  workplace: string;
  location: string | null;
  expiresAt: string;
  timezone: string;
  questionCount: number;
  salary: string | null;
  accommodation: string | null;
  interviewDetails: string | null;
  faqs?: Array<{ question: string; answer: string }>;
};

export type CandidateFactAnswer = {
  supported: boolean;
  answer: string;
  sourceId: string | null;
  sourceLabel: string | null;
};

export type CandidateFactIntent = 'deadline' | 'format' | 'location' | 'salary' | 'accommodation' | 'interview';

function missingFact(lang: 'en' | 'ar'): CandidateFactAnswer {
  return {
    supported: false,
    answer: lang === 'ar' ? 'لم يقدّم صاحب العمل هذه المعلومة.' : "The employer hasn't provided that detail.",
    sourceId: null,
    sourceLabel: null,
  };
}

function normaliseSearchText(value: string, lang: 'en' | 'ar') {
  return value.normalize('NFKC').toLocaleLowerCase(lang === 'ar' ? 'ar' : 'en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function freeTextIntent(value: string): CandidateFactIntent | null {
  const candidates: CandidateFactIntent[] = [];
  if (/\b(deadline|close|closing|last day|due date)\b|موعد الإغلاق|آخر موعد|يغلق الرابط|إغلاق الدعوة|متى (تغلق|تنتهي) الدعوة/.test(value)) candidates.push('deadline');
  if (/\b(video format|response format|video questions?|recording time|answer time|minutes? per answer|how many questions?)\b|صيغة (الإجابة|المقابلة)|أسئلة فيديو|عدد الأسئلة|كم عدد (الأسئلة|اسئلة)|مدة الإجابة|وقت التسجيل/.test(value)) candidates.push('format');
  if (/\bhow long (can|should) (my |each |the )?(video )?(answer|response)\b/.test(value)) candidates.push('format');
  if (/\b(workplace location|job location|work location|where is (the )?(job|workplace|office)|where will i work|based in)\b|موقع (العمل|الوظيفة)|أين (العمل|الوظيفة|مكان العمل)|مكان الوظيفة/.test(value)) candidates.push('location');
  if (/\b(salary|pay|compensation|wage|paid)\b|راتب|الأجر|الراتب|المرتب/.test(value)) candidates.push('salary');
  if (/\b(accommodation|housing|where (will|would) i (live|stay)|staff housing)\b|سكن|الإقامة|مكان السكن|أين سأقيم/.test(value)) candidates.push('accommodation');
  if (/\b(interview date|interview time|when is (the|my) interview|next interview|interview process|next step)\b|موعد المقابلة|وقت المقابلة|متى المقابلة|خطوة المقابلة|الخطوة التالية/.test(value)) candidates.push('interview');
  return candidates.length === 1 ? candidates[0] : null;
}

function faqMatches(question: string, candidateQuestion: string, lang: 'en' | 'ar') {
  const expected = normaliseSearchText(question, lang);
  if (!expected) return false;
  if (expected === candidateQuestion) return true;
  const stopWords = new Set(lang === 'ar'
    ? ['هل', 'ما', 'ماذا', 'هو', 'هي', 'في', 'من', 'على', 'عن', 'إلى', 'يوجد', 'هناك']
    : ['what', 'when', 'where', 'which', 'does', 'will', 'with', 'from', 'this', 'that', 'there']);
  const words = expected.split(' ').filter((word) => word.length > 2 && !stopWords.has(word));
  const candidateWords = new Set(candidateQuestion.split(' ').filter(Boolean));
  const overlap = words.filter((word) => candidateWords.has(word)).length;
  return words.length >= 2 && overlap >= Math.max(2, Math.ceil(words.length * 0.75));
}

export function answerCandidateRoleQuestion(
  question: string,
  facts: PublishedRoleFacts,
  lang: 'en' | 'ar',
  requestedIntent?: CandidateFactIntent,
): CandidateFactAnswer {
  const value = normaliseSearchText(question, lang);
  const intent = requestedIntent ?? freeTextIntent(value);
  const answer = (text: string, sourceLabel: string, sourceId: string): CandidateFactAnswer => ({ supported: true, answer: text, sourceId, sourceLabel });
  const faqAnswer = (index: number): CandidateFactAnswer | null => {
    const faq = index >= 0 ? facts.faqs?.[index] : null;
    return faq ? answer(faq.answer, lang === 'ar' ? 'معلومات الوظيفة المنشورة' : 'Published role information', `candidate-role-faq-${index}`) : null;
  };
  const exactFaqIndex = facts.faqs?.findIndex((item) => normaliseSearchText(item.question, lang) === value) ?? -1;
  const missingOrExactFaq = () => faqAnswer(exactFaqIndex) ?? missingFact(lang);
  if (intent === 'deadline') {
    const formatted = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
      dateStyle: 'long', timeStyle: 'short', timeZone: facts.timezone,
    }).format(new Date(facts.expiresAt));
    return answer(
      lang === 'ar' ? `يُغلق رابط الدعوة في ${formatted} (${facts.timezone}).` : `The invitation closes at ${formatted} (${facts.timezone}).`,
      lang === 'ar' ? 'موعد الإغلاق' : 'Closing date', 'candidate-role-fact-deadline',
    );
  }
  if (intent === 'format') {
    return answer(
      lang === 'ar'
        ? `تتضمن عينة العمل ${facts.questionCount} أسئلة فيديو، ويمكن أن تستغرق كل إجابة حتى دقيقتين.`
        : `The work sample has ${facts.questionCount} video questions, with up to two minutes for each answer.`,
      lang === 'ar' ? 'صيغة الإجابة' : 'Response format', 'candidate-role-fact-format',
    );
  }
  if (intent === 'location') {
    return facts.location
      ? answer(lang === 'ar' ? `الموقع المنشور هو ${facts.location}.` : `The published location is ${facts.location}.`, lang === 'ar' ? 'الموقع' : 'Location', 'candidate-role-fact-location')
      : missingOrExactFaq();
  }
  if (intent === 'salary') {
    return facts.salary
      ? answer(facts.salary, lang === 'ar' ? 'الراتب المنشور' : 'Published salary', 'candidate-role-fact-salary')
      : missingOrExactFaq();
  }
  if (intent === 'accommodation') {
    return facts.accommodation
      ? answer(facts.accommodation, lang === 'ar' ? 'تفاصيل السكن المنشورة' : 'Published accommodation details', 'candidate-role-fact-accommodation')
      : missingOrExactFaq();
  }
  if (intent === 'interview') {
    return facts.interviewDetails
      ? answer(facts.interviewDetails, lang === 'ar' ? 'تفاصيل المقابلة المنشورة' : 'Published interview details', 'candidate-role-fact-interview')
      : missingOrExactFaq();
  }
  const faqIndex = facts.faqs?.findIndex((item) => faqMatches(item.question, value, lang)) ?? -1;
  return faqAnswer(faqIndex) ?? missingFact(lang);
}

export type EvidenceSummaryPoint = { text: string; questionIndex: number; sourceLabel: string };

function firstUsefulSentence(value: string, limit = 220): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = clean.match(/^.{20,}?[.!?](?:\s|$)/)?.[0]?.trim() ?? clean;
  return sentence.length > limit ? `${sentence.slice(0, limit - 1).trimEnd()}…` : sentence;
}

export function buildEvidenceLinkedSummary(
  answers: Array<{ questionIndex: number; transcript: string }>,
  lang: 'en' | 'ar' = 'en',
): EvidenceSummaryPoint[] {
  return answers
    .map((answer) => ({ ...answer, excerpt: firstUsefulSentence(answer.transcript) }))
    .filter((answer) => answer.excerpt.length >= 20)
    .slice(0, 3)
    .map((answer) => ({
      text: lang === 'ar' ? `ذكر المرشح: «${answer.excerpt}»` : `The candidate described: “${answer.excerpt}”`,
      questionIndex: answer.questionIndex,
      sourceLabel: lang === 'ar' ? `الإجابة ${answer.questionIndex + 1}` : `Answer ${answer.questionIndex + 1}`,
    }));
}

const DISALLOWED_QUESTION = /\b(age|date of birth|married|marital|religion|nationality|pregnan|disability|race|ethnicity|appearance|accent)\b|العمر|تاريخ الميلاد|الحالة الاجتماعية|الدين|الجنسية|الحمل|الإعاقة|العرق|المظهر|اللهجة/i;

export type RecruiterQuestionDraft = { id: string; text: string; textAr?: string };

export function curatedRecruiterQuestions(
  role: Role,
  drafts: RecruiterQuestionDraft[],
  options: { language?: 'en' | 'both' } = {},
): Question[] {
  if (drafts.length < 3 || drafts.length > 8) throw new Error('Choose between 3 and 8 questions.');
  const available = [...role.questions, ...(role.bank ?? [])];
  const byId = new Map(available.map((question) => [question.id, question]));
  const ids = new Set<string>();
  return drafts.map((draft, index) => {
    const text = draft.text.replace(/\s+/g, ' ').trim();
    const textAr = (draft.textAr ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 15 || text.length > 500) throw new Error(`Question ${index + 1} needs 15 to 500 English characters.`);
    if (options.language !== 'en' && (textAr.length < 10 || textAr.length > 500)) throw new Error(`Question ${index + 1} needs an Arabic version.`);
    if (DISALLOWED_QUESTION.test(`${text} ${textAr}`)) throw new Error(`Question ${index + 1} asks for unrelated personal information.`);
    const source = byId.get(draft.id);
    const exactReviewed = Boolean(source
      && source.text.replace(/\s+/g, ' ').trim() === text
      && (options.language === 'en' || source.textAr.replace(/\s+/g, ' ').trim() === textAr));
    const requestedId = draft.id.replace(/[^a-z0-9_-]/gi, '').slice(0, 48);
    const baseId = requestedId || `question-${index + 1}`;
    const id = ids.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    ids.add(id);
    if (source && exactReviewed) {
      return { ...source, id, text, textAr: options.language === 'en' ? text : textAr, validated: true };
    }
    return {
      id,
      text,
      textAr: options.language === 'en' ? text : textAr,
      competencies: [],
      prepSeconds: source?.prepSeconds ?? 30,
      answerSeconds: source?.answerSeconds ?? 120,
      hint: '',
      hintAr: '',
    };
  });
}
