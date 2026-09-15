import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { catalogueInterviewRole } from '../lib/interview-catalogue.ts';
import { signProofPack, verifyInterview, verifyStoredInterview } from '../lib/interview-token.ts';
import { trustedInterviewPlan } from '../lib/interview-plan.ts';
import { ScreeningPackRequestSchema } from '../lib/screening-pack-request.ts';
import { formatZonedLocalDateTime, zonedLocalDateTimeToIso } from '../lib/timezone.ts';
import { pageCount, pageRange, positivePage } from '../lib/pagination.ts';
import { employerManualReviewFeedback } from '../lib/scoring.ts';
import {
  answerCandidateRoleQuestion,
  buildAttentionItems,
  buildEvidenceLinkedSummary,
  curatedRecruiterQuestions,
  filterCandidateSubmissions,
  preparePublishedFaq,
  reminderEligibility,
  resolveAvailableRoleNextAction,
  resolveRoleNextAction,
} from '../lib/recruiter-suite.ts';

const roleId = '10000000-0000-4000-8000-000000000001';
const now = new Date('2026-09-15T08:00:00.000Z');
process.env.INTERVIEW_SECRET ||= 'recruiter-suite-test-secret-2026';

test('role next-action resolver covers the complete state table with submission units', () => {
  assert.equal(resolveRoleNextAction({ roleId, state: 'draft', submissionCount: 0, unreviewedCount: 0, shortlistCount: 0, incompleteStage: 'Questions' }).kind, 'continue');
  assert.equal(resolveRoleNextAction({ roleId, state: 'active', submissionCount: 0, unreviewedCount: 0, shortlistCount: 0 }).kind, 'copy');
  const review = resolveRoleNextAction({ roleId, state: 'active', submissionCount: 4, unreviewedCount: 3, shortlistCount: 0 });
  assert.equal(review.label, 'Review 3 submissions');
  assert.equal(review.countUnit, 'submissions');
  assert.match(review.href, /candidateStatus=unreviewed/);
  assert.equal(resolveRoleNextAction({ roleId, state: 'active', submissionCount: 4, unreviewedCount: 0, shortlistCount: 2 }).kind, 'shortlist');
  assert.equal(resolveRoleNextAction({ roleId, state: 'active', submissionCount: 4, unreviewedCount: 0, shortlistCount: 0 }).kind, 'submissions');
  assert.equal(resolveRoleNextAction({ roleId, state: 'closed', submissionCount: 4, unreviewedCount: 2, shortlistCount: 0 }).kind, 'review');
  assert.equal(resolveRoleNextAction({ roleId, state: 'closed', submissionCount: 4, unreviewedCount: 0, shortlistCount: 0 }).kind, 'results');
});

test('attention briefing is deterministic, limited to three, and uses a 48-hour close threshold', () => {
  const result = buildAttentionItems({
    pendingSubmissions: 4,
    unresolvedQuestions: 2,
    closingRoles: [
      { id: 'later', title: 'Later role', expiresAt: '2026-09-18T08:00:01.000Z', timezone: 'Asia/Dubai' },
      { id: 'soon', title: 'Front Office', expiresAt: '2026-09-16T08:00:00.000Z', timezone: 'Asia/Dubai' },
      { id: 'soonest', title: 'Housekeeping', expiresAt: '2026-09-15T09:00:00.000Z', timezone: 'Asia/Riyadh' },
    ],
    now,
  });
  assert.deepEqual(result.items.map((item) => item.kind), ['reviews', 'questions', 'closing']);
  assert.match(result.items[0].href, /candidateStatus=unreviewed/);
  assert.match(result.items[1].href, /employer\/questions/);
  assert.match(result.items[2].title, /Housekeeping/);
  assert.equal(result.total, 4);
  assert.equal(result.hasMore, true);
  assert.equal(result.allItems.length, 4);
  assert.match(result.allItems[3].title, /Front Office/);
});

test('role actions remain unavailable when any required activity count failed', () => {
  assert.equal(resolveAvailableRoleNextAction({ roleId, state: 'active', submissionCount: null, unreviewedCount: 0, shortlistCount: 0 }), null);
  assert.equal(resolveAvailableRoleNextAction({ roleId, state: 'active', submissionCount: 0, unreviewedCount: null, shortlistCount: 0 }), null);
  assert.equal(resolveAvailableRoleNextAction({ roleId, state: 'active', submissionCount: 0, unreviewedCount: 0, shortlistCount: null }), null);
  assert.equal(resolveAvailableRoleNextAction({ roleId, state: 'active', submissionCount: 0, unreviewedCount: 0, shortlistCount: 0 })?.kind, 'copy');
});

test('candidate queues apply the same visible filters as attention and role actions', () => {
  const rows = [
    { id: 'one', employer_reviewed_at: null, employer_decision: null },
    { id: 'two', employer_reviewed_at: '2026-09-15T07:00:00Z', employer_decision: 'shortlisted' },
    { id: 'three', employer_reviewed_at: '2026-09-15T07:30:00Z', employer_decision: 'pass' },
  ];
  assert.deepEqual(filterCandidateSubmissions(rows, 'unreviewed').map((row) => row.id), ['one']);
  assert.deepEqual(filterCandidateSubmissions(rows, 'shortlisted').map((row) => row.id), ['two']);
  assert.equal(filterCandidateSubmissions(rows, 'all').length, 3);
});

test('reminder eligibility rechecks submission, consent, expiry, contact channel and 24-hour duplicate window', () => {
  const base = { id: 'invite', name: 'Candidate', email: 'candidate@example.test', status: 'invited', contactAllowed: true };
  const role = { expiresAt: '2026-09-20T08:00:00.000Z', remindersEnabled: true };
  assert.equal(reminderEligibility(base, role, now).eligible, true);
  assert.match(reminderEligibility({ ...base, status: 'submitted' }, role, now).reason, /completed/);
  assert.match(reminderEligibility({ ...base, optedOutAt: '2026-09-14T00:00:00Z' }, role, now).reason, /cannot be contacted/);
  assert.match(reminderEligibility({ ...base, email: null }, role, now).reason, /No supported/);
  assert.match(reminderEligibility({ ...base, lastManualReminderAt: '2026-09-15T07:00:00Z' }, role, now).reason, /24 hours/);
  assert.match(reminderEligibility(base, { ...role, expiresAt: '2026-09-15T07:59:00Z' }, now).reason, /closed/);
  assert.match(reminderEligibility({ ...base, deliveryStatus: 'processing' }, role, now).reason, /already queued/);
  assert.equal(reminderEligibility({ ...base, deliveryStatus: 'failed', deliveryErrorCode: 'email.failed', lastManualReminderAt: '2026-09-15T07:00:00Z' }, role, now).eligible, true);
  assert.match(reminderEligibility({ ...base, deliveryStatus: 'failed', deliveryErrorCode: 'email.complained', lastManualReminderAt: '2026-09-15T07:00:00Z' }, role, now).reason, /not safe/);
  assert.match(reminderEligibility({ ...base, deliveryStatus: 'delivered', deliveryUpdatedAt: '2026-09-15T07:00:00Z' }, role, now).reason, /24 hours/);
});

const facts = {
  roleTitle: 'Receptionist', workplace: 'Nour Clinic', location: 'Dubai, UAE',
  expiresAt: '2026-09-16T14:00:00.000Z', timezone: 'Asia/Dubai', questionCount: 8,
  salary: null, accommodation: null, interviewDetails: null,
};

test('candidate fact answers use explicit intents, conservative matching, and visible source anchors', () => {
  const closing = answerCandidateRoleQuestion('When does this close?', facts, 'en', 'deadline');
  assert.equal(closing.supported, true);
  assert.match(closing.answer, /Asia\/Dubai/);
  assert.equal(closing.sourceId, 'candidate-role-fact-deadline');
  assert.match(answerCandidateRoleQuestion('What salary is offered?', facts, 'en').answer, /hasn't provided/);
  assert.match(answerCandidateRoleQuestion('هل يوجد سكن؟', facts, 'ar').answer, /لم يقدّم/);
  assert.doesNotMatch(answerCandidateRoleQuestion('Is a visa promised?', facts, 'en').answer, /AED|visa support|provided visa/i);
  assert.match(answerCandidateRoleQuestion('When will I be paid?', facts, 'en').answer, /hasn't provided/);
  assert.match(answerCandidateRoleQuestion('When is my interview?', facts, 'en').answer, /hasn't provided/);
  assert.match(answerCandidateRoleQuestion('How long is the employment contract?', facts, 'en').answer, /hasn't provided/);
  assert.match(answerCandidateRoleQuestion('Where will my accommodation be?', facts, 'en').answer, /hasn't provided/);
  assert.equal(answerCandidateRoleQuestion('What is the salary and accommodation?', { ...facts, salary: 'AED 8,000', accommodation: 'Provided' }, 'en').supported, false);
  assert.equal(answerCandidateRoleQuestion('متى يتم دفع الراتب؟', { ...facts, salary: '٨٠٠٠ درهم شهرياً' }, 'ar').sourceId, 'candidate-role-fact-salary');
  assert.equal(answerCandidateRoleQuestion('أين سيكون السكن؟', { ...facts, accommodation: 'سكن مشترك للموظفين' }, 'ar').sourceId, 'candidate-role-fact-accommodation');
  assert.equal(answerCandidateRoleQuestion('متى تغلق الدعوة؟', facts, 'ar').sourceId, 'candidate-role-fact-deadline');
  assert.equal(answerCandidateRoleQuestion('كم عدد الأسئلة؟', facts, 'ar').sourceId, 'candidate-role-fact-format');
  const arabicFaq = answerCandidateRoleQuestion('هل توجد مواصلات للموظفين؟', { ...facts, faqs: [{ question: 'هل توجد مواصلات للموظفين؟', answer: 'تتوفر حافلة يومية.' }] }, 'ar');
  assert.equal(arabicFaq.answer, 'تتوفر حافلة يومية.');
  assert.equal(arabicFaq.sourceId, 'candidate-role-faq-0');
  const englishAccommodationFaq = answerCandidateRoleQuestion('Is accommodation provided?', { ...facts, faqs: [{ question: 'Is accommodation provided?', answer: 'Shared staff housing is available.' }] }, 'en');
  assert.equal(englishAccommodationFaq.answer, 'Shared staff housing is available.');
  assert.equal(englishAccommodationFaq.sourceId, 'candidate-role-faq-0');
  const arabicAccommodationFaq = answerCandidateRoleQuestion('هل يوجد سكن؟', { ...facts, faqs: [{ question: 'هل يوجد سكن؟', answer: 'يتوفر سكن مشترك للموظفين.' }] }, 'ar');
  assert.equal(arabicAccommodationFaq.answer, 'يتوفر سكن مشترك للموظفين.');
  assert.equal(arabicAccommodationFaq.sourceId, 'candidate-role-faq-0');
  assert.equal(answerCandidateRoleQuestion('Is accommodation provided?', { ...facts, accommodation: 'Live structured fact', faqs: [{ question: 'Is accommodation provided?', answer: 'Older FAQ value' }] }, 'en').answer, 'Live structured fact');
});

test('bounded recruiter queues expose every later page instead of capping work', async () => {
  assert.equal(positivePage('0'), 1);
  assert.deepEqual(pageRange(2, 50), { from: 50, to: 99 });
  assert.deepEqual(pageRange(6, 100), { from: 500, to: 599 });
  assert.equal(pageCount(501, 100), 6);
  const rolePage = await readFile(new URL('../app/employer/roles/[roleId]/page.tsx', import.meta.url), 'utf8');
  const questionPage = await readFile(new URL('../app/employer/questions/page.tsx', import.meta.url), 'utf8');
  const reminderRoute = await readFile(new URL('../app/api/employer/roles/[roleId]/reminders/route.ts', import.meta.url), 'utf8');
  assert.match(rolePage, /\.range\(candidateRange\.from, candidateRange\.to\)/);
  assert.match(rolePage, /\.range\(questionRange\.from, questionRange\.to\)/);
  assert.match(questionPage, /\.range\(range\.from, range\.to\)/);
  assert.doesNotMatch(questionPage, /limit\(500\)/);
  assert.match(reminderRoute, /pagination: \{ page, pageSize: RECIPIENT_PAGE_SIZE/);
});

test('extractive summaries remain candidate claims and every point references its answer', () => {
  const points = buildEvidenceLinkedSummary([
    { questionIndex: 0, transcript: 'I supervised three colleagues during the hotel opening. We completed the handover on time.' },
    { questionIndex: 1, transcript: 'I resolved a guest complaint by checking the booking and arranging a new room.' },
  ]);
  assert.equal(points.length, 2);
  assert.match(points[0].text, /^The candidate described:/);
  assert.equal(points[0].sourceLabel, 'Answer 1');
  assert.equal(points[1].questionIndex, 1);
});

test('guided role questions preserve rubrics only for unchanged reviewed templates', () => {
  const role = catalogueInterviewRole('Receptionist');
  const drafts = role.questions.slice(0, 3).map(({ id, text, textAr }) => ({ id, text, textAr }));
  const questions = curatedRecruiterQuestions(role, drafts.reverse());
  assert.equal(questions.length, 3);
  assert.equal(questions[0].id, drafts[0].id);
  assert(questions.every((question) => question.competencies.length > 0));
  assert(questions.every((question) => question.validated === true));
  const edited = curatedRecruiterQuestions(role, [{ ...drafts[0], text: 'Tell us how you would lead a fire-alarm evacuation safely.' }, drafts[1], drafts[2]]);
  assert.deepEqual(edited[0].competencies, []);
  assert.equal(edited[0].validated, undefined);
  const custom = curatedRecruiterQuestions(role, [{ id: 'custom-fire', text: 'Tell us how you would lead a fire-alarm evacuation safely.', textAr: 'حدثنا كيف ستقود عملية إخلاء آمنة عند إنذار الحريق.' }, drafts[1], drafts[2]]);
  assert.deepEqual(custom[0].competencies, []);
  assert.equal(custom[0].id, 'custom-fire');
  assert.deepEqual(employerManualReviewFeedback(custom[0].id), {
    questionId: 'custom-fire', score: 0, status: 'unscored',
    unscoredReason: 'question_requires_human_review',
    headline: 'Employer-written question: human review required.',
    competencies: [], strengths: [], improvements: [], coachTip: '', source: 'none',
    scoringVersion: 'manual-review-v1',
  });
  const englishOnly = curatedRecruiterQuestions(role, drafts.map(({ id, text }) => ({ id, text })), { language: 'en' });
  assert(englishOnly.every((question) => question.validated === true && question.textAr === question.text));
  assert.throws(() => curatedRecruiterQuestions(role, [{ ...drafts[0], text: 'What is your age and marital status?' }, drafts[1], drafts[2]]), /personal information/);
  assert.throws(() => curatedRecruiterQuestions(role, drafts.slice(0, 2)), /between 3 and 8/);
});

test('creation-to-start contract accepts every fixed recruiter question count from three through eight', () => {
  const role = catalogueInterviewRole('Receptionist');
  for (let count = 3; count <= 8; count += 1) {
    const drafts = role.questions.slice(0, count).map(({ id, text, textAr }) => ({ id, text, textAr }));
    const request = ScreeningPackRequestSchema.safeParse({
      companyName: 'Nour Clinic', jobTitle: 'Receptionist', location: 'Dubai',
      questions: drafts, questionnaireLanguage: 'both', expiryDays: 30,
    });
    assert.equal(request.success, true, `request count ${count}`);
    const questions = curatedRecruiterQuestions(role, drafts, { language: 'both' });
    const token = signProofPack({
      title: role.title, industry: role.industry, level: role.level,
      competencies: role.competencies, questions, workplace: 'Nour Clinic',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    assert.ok(token);
    const plan = trustedInterviewPlan({
      roleId: 'custom', roleTitle: role.title, mode: 'screening',
      questions: questions.map(({ id }) => ({ id })), interviewToken: token,
    });
    assert.equal(plan?.questions.length, count, `start count ${count}`);
    assert.deepEqual(plan?.questions.map(({ id }) => id), questions.map(({ id }) => id));
  }
});

test('historical recruiter reads verify signatures without reopening expired public tokens', () => {
  const role = catalogueInterviewRole('Receptionist');
  const originalNow = Date.now;
  const signedAt = originalNow();
  const token = signProofPack({
    title: role.title, industry: role.industry, level: role.level,
    competencies: role.competencies, questions: role.questions.slice(0, 3), workplace: 'Nour Clinic',
  });
  const longToken = signProofPack({
    title: role.title, industry: role.industry, level: role.level,
    competencies: role.competencies, questions: role.questions.slice(0, 3), workplace: 'Nour Clinic',
    expiresAt: signedAt + 30 * 24 * 60 * 60 * 1000,
  });
  assert.ok(token);
  assert.ok(longToken);
  Date.now = () => signedAt + 15 * 24 * 60 * 60 * 1000;
  try {
    assert.equal(verifyInterview(token), null);
    assert.equal(verifyStoredInterview(token)?.kind, 'proof');
  } finally {
    Date.now = originalNow;
  }
  Date.now = () => signedAt + 21 * 24 * 60 * 60 * 1000;
  try {
    assert.equal(verifyInterview(longToken)?.kind, 'proof');
  } finally {
    Date.now = originalNow;
  }
});

test('role timezone conversion preserves the exact chosen wall-clock closing time', () => {
  const iso = zonedLocalDateTimeToIso('2026-09-30T17:45', 'Asia/Dubai');
  assert.equal(iso, '2026-09-30T13:45:00.000Z');
  assert.equal(formatZonedLocalDateTime(iso, 'Asia/Dubai'), '2026-09-30T17:45');
});

test('public FAQ reuse requires separate public copy and rejects direct contact details', () => {
  assert.deepEqual(
    preparePublishedFaq('Is accommodation provided?', 'Shared staff accommodation is provided during the contract.', 'candidate@example.test'),
    { question: 'Is accommodation provided?', answer: 'Shared staff accommodation is provided during the contract.' },
  );
  assert.equal(preparePublishedFaq('Can you call me on +971 50 123 4567?', 'Yes.', 'candidate@example.test'), null);
  assert.equal(preparePublishedFaq('Contact candidate@example.test', 'We will email them.', 'candidate@example.test'), null);
});

test('server and database sources keep employer submissions, questions and actions scoped', async () => {
  const dashboard = await readFile(new URL('../app/employer/page.tsx', import.meta.url), 'utf8');
  const rolePage = await readFile(new URL('../app/employer/roles/[roleId]/page.tsx', import.meta.url), 'utf8');
  const candidateQuestions = await readFile(new URL('../app/api/screening/roles/[code]/questions/route.ts', import.meta.url), 'utf8');
  const summaryRoute = await readFile(new URL('../app/api/employer/interviews/[id]/summary/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20260915120000_recruiter_assistance.sql', import.meta.url), 'utf8');
  const actions = await readFile(new URL('../app/employer/actions.ts', import.meta.url), 'utf8');
  const questionPage = await readFile(new URL('../app/employer/questions/page.tsx', import.meta.url), 'utf8');
  const scoringRoute = await readFile(new URL('../app/api/score/route.ts', import.meta.url), 'utf8');
  assert.match(dashboard, /\.eq\('employer_id', user\.id\)/);
  assert.match(dashboard, /candidate_role_questions/);
  assert.match(rolePage, /\.eq\('employer_id', employer\.id\)/);
  assert.match(rolePage, /head: true/);
  assert.match(rolePage, /Submission activity is unavailable, so no next action has been selected/);
  assert.match(rolePage, /submissionUnavailable[\s\S]*RetryState/);
  assert.match(questionPage, /questionResult\.error/);
  assert.match(questionPage, /packResult\.error/);
  assert.match(candidateQuestions, /\.eq\('candidate_id', candidate\.id\)/);
  assert.match(summaryRoute, /\.not\('submitted_at', 'is', null\)/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /screening_packs_employer_publish_key/);
  assert.match(migration, /candidate_role_questions_open_once/);
  assert.match(migration, /queue_manual_employer_reminders/);
  assert.match(migration, /status in \('invited', 'started'\)/);
  assert.match(actions, /publicQuestion/);
  assert.match(actions, /publicAnswer/);
  assert.doesNotMatch(actions, /faqs = \[\.\.\.existing, \{ question: owned\.question\.question_text/);
  assert.match(scoringRoute, /employerManualReviewFeedback\(question\.id\)/);
});

test('candidate sources render every answerable approved fact and stable FAQ anchor', async () => {
  const source = await readFile(new URL('../components/CandidateRoleQuestions.tsx', import.meta.url), 'utf8');
  for (const id of ['deadline', 'format', 'location', 'salary', 'accommodation', 'interview']) {
    assert.match(source, new RegExp(`candidate-role-fact-${id}`));
  }
  assert.match(source, /candidate-role-faq-\$\{index\}/);
  assert.doesNotMatch(source, /internalFacts|privateFacts/);
});

test('review panel keeps original answers available and source links resolve to answer anchors', async () => {
  const panel = await readFile(new URL('../components/EmployerCandidatePanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /employerAnswerSummaryFailed/);
  assert.match(panel, /data\.answers\.map/);
  assert.match(panel, /candidate-answer-\$\{point\.questionIndex\}/);
  assert.match(panel, /candidate-answer-\$\{answer\.questionIndex\}/);
  assert.match(panel, /employerReviewUnsaved/);
  assert.match(panel, /event\.key === 'Escape'/);
});

test('role help is optional, deterministic and has no inert open-ended text box', async () => {
  const source = await readFile(new URL('../components/RoleHelpPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /Choose a common question/);
  assert.doesNotMatch(source, /<textarea|<input/);
  assert.match(source, /candidateStatus=unreviewed/);
  assert.match(source, /#reminders/);
});
