import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('dashboard candidate review is an accessible, state-preserving side panel', async () => {
  const [dashboard, panel, css] = await Promise.all([
    read('app/employer/page.tsx'),
    read('components/EmployerCandidatePanel.tsx'),
    read('components/EmployerCandidatePanel.module.css'),
  ]);
  assert.match(dashboard, /EmployerReviewPanelProvider/);
  assert.match(dashboard, /EmployerReviewTrigger/);
  assert.doesNotMatch(dashboard, /action=\{reviewInterview\}/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /event\.key === 'Escape'/);
  assert.match(panel, /event\.key !== 'Tab'/);
  assert.match(panel, /openerRef\.current\?\.focus\(\)/);
  assert.match(panel, /window\.confirm\(t\('employerReviewUnsaved'\)\)/);
  assert.match(panel, /addEventListener\('beforeunload'/);
  assert.match(panel, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(panel, /loadState === 'loading'/);
  assert.match(panel, /loadState === 'error'/);
  assert.match(panel, /data\.answers\.length === 0/);
  assert.match(css, /width: min\(100%, 42rem\)/);
  assert.match(css, /@media \(max-width: 42rem\)[\s\S]*\.panel \{ width: 100%/);
});

test('candidate review API rechecks ownership and returns no recording path', async () => {
  const [route, payload] = await Promise.all([
    read('app/api/employer/interviews/[id]/route.ts'),
    read('lib/employer-review.ts'),
  ]);
  assert.match(route, /currentUser\(\)/);
  assert.match(route, /\.not\('submitted_at', 'is', null\)/);
  assert.match(route, /\.eq\('employer_id', user\.id\)/);
  assert.match(route, /hasVideo: Boolean\(answer\.video_path\)/);
  assert.doesNotMatch(payload, /video_path/);
  assert.match(route, /privateNoStoreHeaders\(\)/);
});

test('shortlist UI confirms only after the server and guards repeat decisions', async () => {
  const [panel, rowActions] = await Promise.all([
    read('components/EmployerCandidatePanel.tsx'),
    read('components/DashboardDecisionActions.tsx'),
  ]);
  const serverCall = panel.indexOf('await recordDecision');
  const localCommit = panel.indexOf('setDecision(normalised)');
  assert.ok(serverCall >= 0 && localCommit > serverCall);
  assert.match(panel, /if \(decision === normalised\) return/);
  assert.match(panel, /next === 'shortlist' \? t\('employerAddedShortlist'\)/);
  assert.match(panel, /router\.refresh\(\)/);
  assert.match(rowActions, /if \(busy \|\| selected === normalised\) return/);
  assert.match(rowActions, /t\('employerAddedShortlist'\)/);
});

test('role setup follows Role, Questions, Preview and Share without losing form state', async () => {
  const form = await read('components/EmployerProofCreate.tsx');
  assert.match(form, /const \[step, setStep\] = useState<0 \| 1 \| 2 \| 3>\(0\)/);
  assert.match(form, /proofWizardRole[\s\S]*proofWizardQuestions[\s\S]*proofWizardPreview[\s\S]*proofWizardShare/);
  assert.match(form, /companyReady \? titleRef\.current : companyRef\.current/);
  assert.match(form, /advertRef\.current\?\.focus\(\)/);
  assert.match(form, /headingRef\.current\?\.focus\(\)/);
  assert.match(form, /setStep\(3\)/);
  assert.doesNotMatch(form, /router\.push\(`\/employer\/roles/);
});

test('copy feedback is truthful and provides a manual fallback', async () => {
  const copy = await read('components/CopyButton.tsx');
  assert.match(copy, /await navigator\.clipboard\.writeText\(value\)/);
  assert.match(copy, /setState\('copied'\)/);
  assert.match(copy, /setState\('failed'\)/);
  assert.match(copy, /<Check aria-hidden="true"/);
  assert.match(copy, /aria-live="polite"/);
  assert.match(copy, /fallbackRef\.current\?\.select\(\)/);
  assert.match(copy, /setTimeout\(\(\) => setState\('idle'\), 2500\)/);
});

test('practice transitions expose real states and a no-loss long-wait escape', async () => {
  const [flow, feedback, css] = await Promise.all([
    read('components/InterviewFlow.tsx'),
    read('components/FeedbackCard.tsx'),
    read('app/globals.css'),
  ]);
  assert.match(flow, /progressTitle[\s\S]*question[\s\S]*yourAnswer[\s\S]*reviewTypedAnswer[\s\S]*feedbackArriving/);
  assert.match(flow, /if \(scoringInFlightRef\.current \|\| !transcript\.trim\(\)\) return/);
  assert.match(flow, /setFeedbackWaitLong\(true\)/);
  assert.match(flow, /scoringAbortRef\.current\?\.abort\(\)/);
  assert.match(flow, /feedbackProcessingBody/);
  assert.match(feedback, /feedback-ready/);
  assert.match(css, /\.feedback-streaming \.feedback-block[\s\S]*min-height/);
  assert.match(css, /--motion-fast: 120ms/);
  assert.match(css, /--motion-standard: 180ms/);
  assert.match(css, /--motion-panel: 220ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('FAQ keeps the direct answer visible and guides keep article sections crawlable', async () => {
  const [faq, marketing, guide] = await Promise.all([
    read('app/faq/page.tsx'),
    read('components/MarketingSite.tsx'),
    read('components/GuideBody.tsx'),
  ]);
  assert.match(faq, /disclosures/);
  assert.match(marketing, /<p>\{disclosures \? answer\.lead : section\.body\}<\/p>/);
  assert.match(marketing, /<details>[\s\S]*faqMoreDetails/);
  assert.match(guide, /<details className="guide-outline">/);
  assert.match(guide, /<PortableText value=\{blocks\}/);
  assert.match(guide, /<h2 id=\{headingId\(block\)\}>/);
});
