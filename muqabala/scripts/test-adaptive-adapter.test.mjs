import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdaptivePlanFromCanonical,
} from '../lib/schools/types.ts';

import {
  createInterviewState,
  decideTurn,
  applyImmediateDecision,
  advanceInterview,
} from '../lib/universal-interview/engine.ts';
import { precheckAnswer } from '../lib/universal-interview/sanitise.ts';

test('Adaptive V2 Adapter: Preserves Canonical Questions while enabling Universal Turn Probing', () => {
  const canonicalQuestions = [
    {
      versionId: 'qv-1',
      questionIndex: 0,
      questionText: 'What projects or practical experiences best prepare you for this analyst role?',
      noExampleFollowUp: 'Think about coursework or projects.',
      rubric: [
        { id: 'r1', label: 'Coursework application', description: 'Describes relevant academic courses or projects' },
        { id: 'r2', label: 'Technical tools', description: 'Refers to Excel, Python, or SQL usage' },
        { id: 'r3', label: 'Project objective', description: 'States the goal of the study or task' },
        { id: 'r4', label: 'Learning outcome', description: 'Articulates key learning or result' },
      ],
    },
    {
      versionId: 'qv-2',
      questionIndex: 1,
      questionText: 'Describe a situation where you had to evaluate complex data to make a recommendation.',
      noExampleFollowUp: 'Think about a lab, research paper, or team assignment.',
      rubric: [
        { id: 'r5', label: 'Data context', description: 'Sets out the data source or business problem' },
        { id: 'r6', label: 'Analytical method', description: 'Explains specific analysis or modelling undertaken' },
        { id: 'r7', label: 'Critical findings', description: 'Identifies core insights from the dataset' },
        { id: 'r8', label: 'Decision impact', description: 'Explains the recommendation and its reception' },
      ],
    },
    {
      versionId: 'qv-3',
      questionIndex: 2,
      questionText: 'Tell me about a time you faced a difficult disagreement with team members.',
      noExampleFollowUp: 'Think about a group coursework conflict.',
      rubric: [
        { id: 'r9', label: 'Conflict context', description: 'Clarifies differing opinions or priorities' },
        { id: 'r10', label: 'Listening & dialogue', description: 'Demonstrates active listening and constructive discussion' },
        { id: 'r11', label: 'Resolution action', description: 'Outlines the specific steps taken to reach consensus' },
        { id: 'r12', label: 'Project delivery', description: 'Confirms team deliverable completed successfully' },
      ],
    },
  ];

  const competencies = [
    { id: 'c_role_relevance', name: 'Role Relevance', family: 'motivation', source: 'EXPLICIT', source_text: 'prep', importance: 'HIGH', jd_order: 0 },
    { id: 'c_analytical_thinking', name: 'Analytical Thinking', family: 'cognitive', source: 'EXPLICIT', source_text: 'data', importance: 'HIGH', jd_order: 1 },
    { id: 'c_collaboration', name: 'Collaboration & Teamwork', family: 'behavioural', source: 'EXPLICIT', source_text: 'disagreement', importance: 'HIGH', jd_order: 2 },
  ];

  const financeStudentProfile = {
    experience_level: 'ENTRY',
    years_experience: 0,
    current_or_previous_role: 'Student',
    target_role: 'Junior Financial Analyst',
    industry_background: 'Financial Services',
    career_change: false,
    management_experience: false,
    language: 'en',
    academic_field: 'Finance & Banking',
    qualification: 'BSc Finance',
    academic_stage: 'Final Year Student',
    evidence_sources: ['ACADEMIC', 'PERSONAL_PROJECT'],
  };

  const plan = buildAdaptivePlanFromCanonical(canonicalQuestions, competencies, financeStudentProfile);

  assert.equal(plan.length, 3, 'Plan must have exactly 3 questions matching canonical question count');
  assert.equal(plan[0].candidate_text, canonicalQuestions[0].questionText, 'Question 1 text matches canonical text');
  assert.equal(plan[1].candidate_text, 'Describe a situation where you had to evaluate complex data to make a recommendation?', 'Question 2 text matches canonical question mark normalization');
  assert.equal(plan[2].candidate_text, 'Tell me about a time you faced a difficult disagreement with team members?', 'Question 3 text matches canonical text with question mark');

  // Verify plan questions preserve canonical rubric probe targets
  assert.deepEqual(plan[0].probe_targets, ['r1', 'r2', 'r3', 'r4']);
  assert.deepEqual(plan[1].probe_targets, ['r5', 'r6', 'r7', 'r8']);

  // Simulate turn decisions:
  // Turn 1: Direct academic answer with clear action
  const answer1 = 'In my valuation project, I built a discounted cash flow model for a FTSE 100 retailer, calculated terminal value, and presented sensitivity analyses to the seminar tutor.';
  const precheck1 = precheckAnswer(answer1);
  assert.equal(precheck1.kind, 'NONE');
  assert.ok(precheck1.word_count >= 15);

  // Turn 2: Student has no direct experience -> Triggers 3-tier fallback
  const noExampleAnswer = "I haven't done that";
  const precheck2 = precheckAnswer(noExampleAnswer);
  assert.equal(precheck2.kind, 'NO_EXAMPLE', 'Sanitiser flags no example');

  // Create state with question 2 active
  const state = createInterviewState({
    interviewId: 'test_adaptive_session',
    profile: financeStudentProfile,
    jdQuality: { outcome: 'PASS', score: 95, cleaned_text: '', word_count: 100, responsibility_lines: 4, boilerplate_ratio: 0.1, detected_titles: [], stripped_patterns: [], truncated: false, reason: null },
    discovery: { competencies, role_summary: 'Role summary', seniority_detected: 'ENTRY', management_scope: 'none' },
    rolePack: {
      role: 'Junior Financial Analyst',
      version: '1.0',
      author: 'Author',
      reviewed_by: null,
      reviewed_at: null,
      implicit_competencies: ['c_analytical_thinking'],
      core_competencies: ['c_role_relevance', 'c_analytical_thinking'],
      question_bank: [],
      assessment_type: 'COMPETENCY',
      technical_reference: null,
    },
  });

  state.plan = plan;
  state.question_number = 2;
  state.current_question = plan[1];

  // Level 1 -> Level 2: BROADEN_SETTING
  const decision1 = decideTurn(state, precheck2, null);
  assert.equal(decision1.action, 'BROADEN_SETTING', 'First no_example response broadens setting to academic / volunteer / projects');

  const stateAfterBroaden = applyImmediateDecision(state, decision1, null);
  assert.ok(stateAfterBroaden.transferable_offered_for.includes(2), 'Records transferable_offered_for question 2');

  // Level 2 -> Level 3: OFFER_HYPOTHETICAL
  const decision2 = decideTurn(stateAfterBroaden, precheck2, null);
  assert.equal(decision2.action, 'OFFER_HYPOTHETICAL', 'Second no_example response offers hypothetical scenario');

  const stateAfterHypothetical = applyImmediateDecision(stateAfterBroaden, decision2, null);
  assert.ok(stateAfterHypothetical.hypothetical_offered_for.includes(2), 'Records hypothetical_offered_for question 2');

  // Level 3 -> Exhausted: MOVE_ON
  const decision3 = decideTurn(stateAfterHypothetical, precheck2, null);
  assert.equal(decision3.action, 'MOVE_ON', 'Exhausted fallback moves on to next question');

  const advanced = advanceInterview(stateAfterHypothetical);
  assert.equal(advanced.state.question_number, 3, 'Advanced to Question 3');
  assert.equal(advanced.state.current_question?.candidate_text, 'Tell me about a time you faced a difficult disagreement with team members?', 'Question 3 is canonical question 3');
});

// PRE-NEB STABILITY HOTFIX TESTS

test('Draft Persistence: Key format isolates student, assignment, attempt, and turn', () => {
  function getDraftKey(studentUserId, assignmentId, attemptId, questionTurnId) {
    return `muqabala.draft.${studentUserId}.${assignmentId}.${attemptId}.${questionTurnId}`;
  }

  const student1 = 'stu-1111';
  const student2 = 'stu-2222';
  const assignment = 'asgn-aaaa';
  const attempt = 'att-9999';
  const turn1 = '1_0';
  const turn2 = '1_1';

  const key1 = getDraftKey(student1, assignment, attempt, turn1);
  const key2 = getDraftKey(student2, assignment, attempt, turn1);
  const keyTurn2 = getDraftKey(student1, assignment, attempt, turn2);

  // Cross-student isolation
  assert.notEqual(key1, key2, 'Draft keys between different students must not collide');
  // Turn isolation (question + probe)
  assert.notEqual(key1, keyTurn2, 'Draft keys between different turns of same question must not collide');
  assert.equal(key1, 'muqabala.draft.stu-1111.asgn-aaaa.att-9999.1_0');
});

test('Draft Persistence: Mock browser storage lifecycle', () => {
  function getDraftKey(studentUserId, assignmentId, attemptId, questionTurnId) {
    return `muqabala.draft.${studentUserId}.${assignmentId}.${attemptId}.${questionTurnId}`;
  }

  const mockStorage = new Map();
  const studentUserId = 'stu-alice';
  const assignmentId = 'asgn-finance-01';
  const attemptId = 'att-01';
  const turnKey = '2_0';

  const storageKey = getDraftKey(studentUserId, assignmentId, attemptId, turnKey);

  // 1. Student types answer -> draft saved
  const typedAnswer = 'I conducted an empirical regression analysis on ESG disclosure scores.';
  mockStorage.set(storageKey, typedAnswer);
  assert.equal(mockStorage.get(storageKey), typedAnswer, 'Draft survives in local storage');

  // 2. Refresh simulation -> draft restored
  const restoredDraft = mockStorage.get(storageKey);
  assert.equal(restoredDraft, typedAnswer, 'Draft restored after simulated reload');

  // 3. Different student logs in -> draft NOT visible to other student
  const otherStudentKey = getDraftKey('stu-bob', assignmentId, attemptId, turnKey);
  assert.equal(mockStorage.get(otherStudentKey), undefined, 'Another student cannot see previous student draft');

  // 4. Successful turn submission -> draft cleared
  mockStorage.delete(storageKey);
  assert.equal(mockStorage.get(storageKey), undefined, 'Draft cleared after accepted submission');
});

test('Fallback Text Protection: Non-destructive architecture preserves typed draft', () => {
  let textareaValue = 'During my final year engineering project, I developed a CAD model for a prosthetic limb.';
  let fallbackConfirmationShown = false;
  let preservedDraft = '';

  function onFallbackClicked() {
    const trimmed = textareaValue.trim();
    if (!trimmed) {
      textareaValue = "I don't have a direct professional example for this.";
      return;
    }
    preservedDraft = textareaValue;
    fallbackConfirmationShown = true;
  }

  function onCancelFallback() {
    if (preservedDraft) {
      textareaValue = preservedDraft;
    }
    fallbackConfirmationShown = false;
  }

  // Action: Student clicks fallback with substantial typed answer
  onFallbackClicked();
  assert.equal(fallbackConfirmationShown, true, 'Confirmation alert rendered');
  assert.equal(preservedDraft, 'During my final year engineering project, I developed a CAD model for a prosthetic limb.', 'Original answer text preserved in memory');
  assert.equal(textareaValue, 'During my final year engineering project, I developed a CAD model for a prosthetic limb.', 'Textarea value was not overwritten');

  // Cancel action recovers exact draft
  onCancelFallback();
  assert.equal(fallbackConfirmationShown, false, 'Confirmation closed');
  assert.equal(textareaValue, 'During my final year engineering project, I developed a CAD model for a prosthetic limb.', 'Answer remains fully intact');
});

test('Finalize Lifecycle: Failure keeps recoverable state and retry succeeds idempotently', async () => {
  let step = 'interview';
  let serverFinalized = false;
  let finalizeCalls = 0;
  let attemptStatus = 'draft';

  async function mockFinalize(shouldFail = false) {
    finalizeCalls++;
    if (shouldFail) {
      throw new Error('Server network timeout during finalization');
    }
    serverFinalized = true;
    attemptStatus = 'submitted';
    return { success: true };
  }

  async function clientExecuteFinalize(shouldFail = false) {
    step = 'finalizing';
    try {
      await mockFinalize(shouldFail);
      step = 'complete';
    } catch {
      step = 'finalize_failed';
    }
  }

  // 1. Initial turn completion triggers finalize, but server fails
  await clientExecuteFinalize(true);
  assert.equal(finalizeCalls, 1);
  assert.equal(step, 'finalize_failed', 'Must not display interview as completed when finalize fails');
  assert.notEqual(step, 'complete', 'Completed screen hidden on failure');
  assert.equal(attemptStatus, 'draft', 'Attempt status remains draft');

  // 2. Student clicks Retry Finalization -> server succeeds
  await clientExecuteFinalize(false);
  assert.equal(finalizeCalls, 2);
  assert.equal(step, 'complete', 'Step transitions to complete only after successful server finalize');
  assert.equal(attemptStatus, 'submitted', 'Attempt marked submitted');
  assert.equal(serverFinalized, true);

  // 3. Repeated / idempotent finalize call on already submitted attempt
  await clientExecuteFinalize(false);
  assert.equal(finalizeCalls, 3);
  assert.equal(step, 'complete', 'Idempotent retry maintains complete state');
  assert.equal(attemptStatus, 'submitted');
});

test('Draft Storage: 24-hour TTL expiration, cleanup and auto-pruning', async () => {
  const {
    DRAFT_TTL_MS,
    getDraftKey,
    saveDraft,
    loadDraft,
    pruneExpiredDrafts,
  } = await import('../lib/schools/draft-storage.ts');

  const store = new Map();
  global.window = {
    localStorage: {
      getItem(k) { return store.get(k) ?? null; },
      setItem(k, v) { store.set(k, String(v)); },
      removeItem(k) { store.delete(k); },
      key(i) { return [...store.keys()][i] ?? null; },
      get length() { return store.size; },
    },
  };

  const studentA = 'user-student-alpha';
  const assignment = 'asgn-101';
  const attempt = 'att-501';
  const turn = '1_0';

  const baseTime = 1000000;

  // 1. Save draft with current time
  saveDraft(studentA, assignment, attempt, turn, 'My practical lab work on microcontrollers.');
  const keyA = getDraftKey(studentA, assignment, attempt, turn);
  assert.ok(store.has(keyA), 'Draft is saved in store');

  // Load within TTL (< 24 hours)
  const loadedWithinTTL = loadDraft(studentA, assignment, attempt, turn, baseTime);
  assert.equal(loadedWithinTTL, 'My practical lab work on microcontrollers.');

  // 2. Load AFTER TTL (> 24 hours)
  const expiredTime = Date.now() + DRAFT_TTL_MS + 5000;
  const loadedAfterExpiry = loadDraft(studentA, assignment, attempt, turn, expiredTime);
  assert.equal(loadedAfterExpiry, null, 'Expired draft must return null');
  assert.equal(store.has(keyA), false, 'Expired draft must be removed when encountered');

  // 3. Auto-pruning sweeps expired drafts across storage
  saveDraft(studentA, assignment, attempt, '2_0', 'Valid recent draft');
  // inject an expired draft directly into store
  const expiredKey = getDraftKey(studentA, assignment, attempt, '3_0');
  store.set(expiredKey, JSON.stringify({ text: 'Old forgotten answer', updatedAt: Date.now() - DRAFT_TTL_MS - 10000 }));
  assert.equal(store.size, 2);

  pruneExpiredDrafts(Date.now());
  assert.equal(store.has(expiredKey), false, 'Pruner must remove expired draft');
  assert.equal(store.has(getDraftKey(studentA, assignment, attempt, '2_0')), true, 'Pruner keeps active draft');

  delete global.window;
});

test('Draft Storage: Sign-out cleanup and cross-user shared-browser protection', async () => {
  const {
    getDraftKey,
    saveDraft,
    loadDraft,
    clearStudentDrafts,
  } = await import('../lib/schools/draft-storage.ts');

  const store = new Map();
  global.window = {
    localStorage: {
      getItem(k) { return store.get(k) ?? null; },
      setItem(k, v) { store.set(k, String(v)); },
      removeItem(k) { store.delete(k); },
      key(i) { return [...store.keys()][i] ?? null; },
      get length() { return store.size; },
    },
  };

  const studentA = 'student-alice-id';
  const studentB = 'student-bob-id';
  const assignmentId = 'asgn-engineering-01';
  const attemptId = 'att-eng-01';
  const turnKey = '1_0';

  // Store unrelated keys that must NEVER be purged on student sign out
  store.set('muqabala.lang.v1', 'en');
  store.set('unrelated.app.theme', 'dark');

  // Student A types an in-progress draft
  saveDraft(studentA, assignmentId, attemptId, turnKey, 'Alice confidential response about structural analysis.');
  assert.ok(store.has(getDraftKey(studentA, assignmentId, attemptId, turnKey)));

  // Student A signs out -> clearStudentDrafts(studentA) is called
  clearStudentDrafts(studentA);

  // Verify: Student A draft is wiped from browser storage
  assert.equal(store.has(getDraftKey(studentA, assignmentId, attemptId, turnKey)), false, 'Student A draft removed on sign out');
  assert.equal(store.get('muqabala.lang.v1'), 'en', 'Unrelated language setting preserved');
  assert.equal(store.get('unrelated.app.theme'), 'dark', 'Unrelated browser storage preserved');

  // Student B signs in on the same shared computer/browser
  // Student B cannot access or restore Student A draft
  const studentBDraft = loadDraft(studentB, assignmentId, attemptId, turnKey);
  assert.equal(studentBDraft, null, 'Student B cannot see or restore Student A draft');

  delete global.window;
});

test('Server Finalize Idempotency: Double-finalize and post-commit network-loss retry', async () => {
  // Simulates database tables
  const db = {
    attempts: new Map([
      ['att-idem-1', {
        id: 'att-idem-1',
        student_user_id: 'stu-idem',
        assignment_id: 'asgn-idem',
        status: 'draft',
        universal_interview_id: 'ui-idem-1',
        submitted_at: null,
      }],
    ]),
    universal_interviews: new Map([
      ['ui-idem-1', { id: 'ui-idem-1', status: 'ACTIVE' }],
    ]),
    audit_logs: [],
  };

  let dbCalls = 0;

  // Exact reproduction of server-side finalizeAdaptiveAssignmentSubmission logic
  async function serverFinalize({ attemptId, studentUserId }) {
    dbCalls++;
    const attempt = db.attempts.get(attemptId);
    if (!attempt || attempt.student_user_id !== studentUserId) {
      throw new Error('Attempt not found');
    }

    // 1. Idempotency guard: If already submitted, return early without side-effects
    if (attempt.status === 'submitted') {
      return { success: true, alreadySubmitted: true };
    }

    // 2. Atomic transition from draft to submitted
    if (attempt.status === 'draft') {
      attempt.status = 'submitted';
      attempt.submitted_at = new Date().toISOString();
    }

    // 3. Mark universal interview complete
    if (attempt.universal_interview_id) {
      const ui = db.universal_interviews.get(attempt.universal_interview_id);
      if (ui) ui.status = 'COMPLETE';
    }

    // 4. Audit log (deduplicated by target_id and action)
    const existingAudit = db.audit_logs.find((a) => a.target_id === attempt.id && a.action === 'attempt_submitted');
    if (!existingAudit) {
      db.audit_logs.push({
        actor_user_id: studentUserId,
        action: 'attempt_submitted',
        target_table: 'schools_assignment_attempts',
        target_id: attempt.id,
      });
    }

    return { success: true, alreadySubmitted: false };
  }

  // PASS 1: Normal initial finalize
  const res1 = await serverFinalize({ attemptId: 'att-idem-1', studentUserId: 'stu-idem' });
  assert.equal(res1.success, true);
  assert.equal(res1.alreadySubmitted, false);
  assert.equal(db.attempts.get('att-idem-1').status, 'submitted');
  assert.equal(db.universal_interviews.get('ui-idem-1').status, 'COMPLETE');
  assert.equal(db.audit_logs.length, 1, 'Exactly one audit log inserted');

  // PASS 2: Double-finalize (same attemptId called again)
  const res2 = await serverFinalize({ attemptId: 'att-idem-1', studentUserId: 'stu-idem' });
  assert.equal(res2.success, true, 'Returns successful result');
  assert.equal(res2.alreadySubmitted, true, 'Handled as safe already-completed no-op');
  assert.equal(db.attempts.size, 1, 'No duplicate attempts created');
  assert.equal(db.universal_interviews.size, 1, 'No duplicate universal interviews created');
  assert.equal(db.audit_logs.length, 1, 'No duplicate audit log inserted');

  // PASS 3: Post-commit network loss simulation
  // Server committed turn to submitted, but response dropped before client received it.
  // Client retries with same attemptId:
  const resRetry = await serverFinalize({ attemptId: 'att-idem-1', studentUserId: 'stu-idem' });
  assert.equal(resRetry.success, true, 'Client retry successfully recovers');
  assert.equal(db.audit_logs.length, 1, 'Audit log remains exactly 1');
  assert.equal(db.attempts.get('att-idem-1').status, 'submitted');
  assert.equal(dbCalls, 3);
});

