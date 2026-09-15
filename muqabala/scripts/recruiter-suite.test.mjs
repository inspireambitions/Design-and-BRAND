import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { catalogueInterviewRole } from '../lib/interview-catalogue.ts';
import {
  answerCandidateRoleQuestion,
  buildAttentionItems,
  buildEvidenceLinkedSummary,
  curatedRecruiterQuestions,
  filterCandidateSubmissions,
  preparePublishedFaq,
  reminderEligibility,
  resolveRoleNextAction,
} from '../lib/recruiter-suite.ts';

const roleId = '10000000-0000-4000-8000-000000000001';
const now = new Date('2026-09-15T08:00:00.000Z');

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
});

const facts = {
  roleTitle: 'Receptionist', workplace: 'Nour Clinic', location: 'Dubai, UAE',
  expiresAt: '2026-09-16T14:00:00.000Z', timezone: 'Asia/Dubai', questionCount: 8,
  salary: null, accommodation: null, interviewDetails: null,
};

test('candidate fact answers use live records and unknown facts are never invented', () => {
  const closing = answerCandidateRoleQuestion('When does this close?', facts, 'en');
  assert.equal(closing.supported, true);
  assert.match(closing.answer, /Asia\/Dubai/);
  assert.equal(closing.sourceId, 'role-facts');
  assert.match(answerCandidateRoleQuestion('What salary is offered?', facts, 'en').answer, /hasn't provided/);
  assert.match(answerCandidateRoleQuestion('هل يوجد سكن؟', facts, 'ar').answer, /لم يقدّم/);
  assert.doesNotMatch(answerCandidateRoleQuestion('Is a visa promised?', facts, 'en').answer, /AED|visa support|provided visa/i);
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

test('guided role questions preserve reviewed rubrics and reject unrelated personal questions', () => {
  const role = catalogueInterviewRole('Receptionist');
  const drafts = role.questions.slice(0, 3).map(({ id, text, textAr }) => ({ id, text, textAr }));
  const questions = curatedRecruiterQuestions(role, drafts.reverse());
  assert.equal(questions.length, 3);
  assert.equal(questions[0].id, drafts[0].id);
  assert(questions.every((question) => question.competencies.length > 0));
  assert.throws(() => curatedRecruiterQuestions(role, [{ ...drafts[0], text: 'What is your age and marital status?' }, drafts[1], drafts[2]]), /personal information/);
  assert.throws(() => curatedRecruiterQuestions(role, drafts.slice(0, 2)), /between 3 and 8/);
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
  assert.match(dashboard, /\.eq\('employer_id', user\.id\)/);
  assert.match(dashboard, /candidate_role_questions/);
  assert.match(rolePage, /\.eq\('employer_id', employer\.id\)/);
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
  assert.match(source, /Open-ended chat is not enabled/);
  assert.doesNotMatch(source, /<textarea|<input/);
  assert.match(source, /candidateStatus=unreviewed/);
  assert.match(source, /#reminders/);
});
