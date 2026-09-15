'use client';

import { AttentionBriefing } from './AttentionBriefing';
import { CandidateRoleQuestions } from './CandidateRoleQuestions';
import { EmployerCreateForm } from './EmployerProofCreate';
import {
  EmployerReviewPanelProvider,
  EmployerReviewTrigger,
  type EmployerSummaryPoint,
} from './EmployerCandidatePanel';
import { ReminderPreview, type ReminderPreviewData } from './ReminderPreview';
import { RoleDeadlineEditor } from './RoleDeadlineEditor';
import { RoleHelpPanel } from './RoleHelpPanel';
import { RecruiterQuestions, type RecruiterQuestionRow } from './RecruiterQuestions';
import { useLang } from './LanguageProvider';
import type { EmployerCandidateReviewPayload } from '@/lib/employer-review';
import type { AttentionItem } from '@/lib/recruiter-suite';
import styles from './RecruiterSuiteFixture.module.css';

const roleId = '11111111-1111-4111-8111-111111111111';
const closesAt = '2026-09-17T16:00:00.000Z';

const attentionItems: AttentionItem[] = [
  { id: 'reviews', kind: 'reviews', title: '2 submissions awaiting review', detail: 'Open the combined queue to review the oldest submissions first.', action: 'Review submissions', href: '#candidate-review' },
  { id: 'questions', kind: 'questions', title: '1 unresolved candidate question', detail: 'Reply and resolution remain separate actions.', action: 'View questions', href: '#candidate-questions' },
  { id: 'closing', kind: 'closing', title: 'Front Office Supervisor invitation closes soon', detail: 'Closing time is shown in Asia/Dubai on the role page.', action: 'View role', href: '#role-help' },
  { id: 'closing-second', kind: 'closing', title: 'Restaurant Manager invitation closes soon', detail: 'Closing time is shown in Asia/Dubai on the role page.', action: 'View role', href: '#role-help' },
];

const reminderData: ReminderPreviewData = {
  recipients: [
    { id: 'invite-1', name: 'Amina N.', email: 'amina@example.test', eligible: true, reason: null },
    { id: 'invite-2', name: 'Omar R.', email: 'omar@example.test', eligible: true, reason: null },
    { id: 'invite-3', name: 'Submitted candidate', email: 'submitted@example.test', eligible: false, reason: 'Submission completed.' },
    { id: 'invite-4', name: 'Recently reminded', email: 'recent@example.test', eligible: false, reason: 'Already reminded within 24 hours.' },
  ],
  eligibleCount: 2,
  configured: false,
  publicLinkFallback: false,
  publicUrl: 'https://example.test/s/MQ-DEMO1',
  defaultMessage: 'Hello, this is a reminder to complete the Front Office Supervisor work sample before it closes.\n\n{{invitation_link}}',
  delivery: { queued: 1, accepted: 1, delivered: 1, failed: 0, cancelled: 0 },
};

const reviewData: EmployerCandidateReviewPayload = {
  interviewId: 'fixture-interview',
  roleId,
  displayName: 'Amina N.',
  roleTitle: 'Front Office Supervisor',
  workplace: 'Harbour Hotel',
  submittedAt: '2026-09-15T08:30:00.000Z',
  reviewedAt: null,
  currentDecision: null,
  coverage: {
    items: [
      { id: 'service', label: 'Guest service', labelAr: 'خدمة الضيوف', covered: true, status: 'evidence' },
      { id: 'ownership', label: 'Ownership', labelAr: 'تحمل المسؤولية', covered: true, status: 'evidence' },
      { id: 'communication', label: 'Communication', labelAr: 'التواصل', covered: false, status: 'missing' },
    ],
    covered: 2,
    total: 3,
    full: false,
    analysisComplete: true,
  },
  answers: [
    { questionIndex: 0, questionText: 'Tell us about a difficult guest situation you resolved.', transcript: 'A guest arrived before their room was ready. I arranged a quiet lounge, kept them updated every fifteen minutes, and coordinated an earlier room release with housekeeping.', scoringStatus: 'scored', hasVideo: false, durationSeconds: 74 },
    { questionIndex: 1, questionText: 'Describe a time you improved a front-desk process.', transcript: 'I introduced a handover checklist after noticing repeated missed requests. The team adopted it for every shift and outstanding requests became visible to the next supervisor.', scoringStatus: 'scored', hasVideo: false, durationSeconds: 68 },
  ],
};

const summaryPoints: EmployerSummaryPoint[] = [
  { text: 'The candidate described keeping an early-arriving guest informed while coordinating an earlier room release.', questionIndex: 0, sourceLabel: 'Answer 1' },
  { text: 'The candidate described introducing a shift-handover checklist so outstanding requests remained visible.', questionIndex: 1, sourceLabel: 'Answer 2' },
];

const recruiterQuestions: RecruiterQuestionRow[] = [{
  id: '22222222-2222-4222-8222-222222222222',
  role_id: roleId,
  roleTitle: 'Front Office Supervisor',
  candidate_email: 'candidate@example.test',
  question_text: 'Is staff accommodation available for this role?',
  answer_already_shown: "The employer hasn't provided that detail.",
  reply_text: 'Shared accommodation is available during the contract.',
  replied_at: '2026-09-15T09:00:00.000Z',
  resolved_at: null,
  created_at: '2026-09-15T08:45:00.000Z',
}];

export function RecruiterSuiteFixture({ state = 'populated' }: { state?: 'populated' | 'empty' | 'error' }) {
  const { lang, setLang } = useLang();
  return (
    <main className={[styles.page, 'employer-light-theme'].join(' ')} id="main-content">
      <header className={styles.header}>
        <div><p>Development-only review fixture</p><h1>Muqabala recruiter assistance</h1></div>
        <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'English' : 'العربية'}</button>
      </header>

      <section className={styles.block} id="attention-state">
        <h2>Dashboard briefing</h2>
        <AttentionBriefing
          items={state === 'populated' ? attentionItems.slice(0, 3) : []}
          allItems={state === 'populated' ? attentionItems : []}
          total={state === 'populated' ? attentionItems.length : 0}
          failed={state === 'error'}
        />
        {state === 'empty' && <p className={styles.fixtureNote}>Fixture assertion: an empty attention briefing renders no invented zero-state card.</p>}
      </section>

      <section className={styles.block} id="role-help">
        <h2>Role actions</h2>
        <div className={styles.grid}>
          <div><h3>Candidate reminders</h3><ReminderPreview roleId={roleId} initialData={reminderData} /></div>
          <div><h3>Constrained role help</h3><RoleHelpPanel roleId={roleId} roleTitle="Front Office Supervisor" unreviewed={2} unresolvedQuestions={1} expiresAt={closesAt} timezone="Asia/Dubai" /></div>
          <div><h3>Role closing time</h3><RoleDeadlineEditor roleId={roleId} expiresAt={closesAt} timezone="Asia/Dubai" /></div>
        </div>
      </section>

      <section className={styles.block} id="candidate-questions">
        <h2>Candidate role questions</h2>
        <CandidateRoleQuestions publicCode="MQ-FIXTURE" roleTitle="Front Office Supervisor" location="Dubai Marina" expiresAt={closesAt} timezone="Asia/Dubai" questionCount={3} publishedFacts={{ salary: 'AED 8,000 monthly', accommodation: 'Shared staff accommodation is provided.', interviewDetails: 'Shortlisted candidates meet the hiring manager online.', faqs: [{ question: 'هل توجد مواصلات للموظفين؟', answer: 'تتوفر حافلة للموظفين من موقع السكن.' }] }} fixtureMode />
        <h3>Recruiter handoff queue</h3>
        <RecruiterQuestions questions={recruiterQuestions} />
      </section>

      <section className={styles.block} id="candidate-review">
        <h2>Evidence-linked review</h2>
        <EmployerReviewPanelProvider fixtureData={reviewData} fixtureSummaryPoints={summaryPoints}>
          <EmployerReviewTrigger interviewId={reviewData.interviewId} candidateLabel={reviewData.displayName}>Review fictional candidate</EmployerReviewTrigger>
        </EmployerReviewPanelProvider>
      </section>

      <section className={styles.block} id="creation-wizard">
        <h2>Role creation wizard</h2>
        <EmployerCreateForm volume={false} fixtureMode />
      </section>
    </main>
  );
}
