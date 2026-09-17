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
