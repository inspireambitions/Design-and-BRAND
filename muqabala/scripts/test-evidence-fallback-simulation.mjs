import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInterviewState,
  decideTurn,
  applyImmediateDecision,
} from '../lib/universal-interview/engine.ts';
import { precheckAnswer } from '../lib/universal-interview/sanitise.ts';
import { fallbackPlan } from '../lib/universal-interview/blueprint.ts';
import { deterministicFeedbackFallback } from '../lib/universal-interview/feedback.ts';

const mockBlueprint = [
  { id: 'c_financial_modelling', name: 'Financial Modelling', family: 'technical', source: 'EXPLICIT', source_text: 'DCF valuation', importance: 'HIGH' },
  { id: 'c_analytical_thinking', name: 'Analytical Problem Solving', family: 'cognitive', source: 'EXPLICIT', source_text: 'analytical thinking', importance: 'HIGH' },
  { id: 'c_stakeholder_communication', name: 'Stakeholder Communication', family: 'behavioural', source: 'EXPLICIT', source_text: 'presentation skills', importance: 'MEDIUM' },
  { id: 'c_adaptability', name: 'Adaptability & Prioritisation', family: 'cognitive', source: 'INFERRED', source_text: 'fast-paced', importance: 'MEDIUM' },
  { id: 'c_motivation', name: 'Commercial Drive', family: 'motivation', source: 'ASSUMED', source_text: 'motivation', importance: 'MEDIUM' },
];

const mockRolePack = {
  role: 'Universal Financial Analyst',
  version: '1.0',
  author: 'Career Lead',
  reviewed_by: null,
  reviewed_at: null,
  implicit_competencies: ['c_adaptability'],
  core_competencies: ['c_financial_modelling'],
  question_bank: [
    {
      question_id: 'bank_conflict',
      candidate_text: 'How do you handle team disagreements in a project?',
      interviewer_intent: 'CONFLICT_RESOLUTION',
      probe_targets: ['action'],
      question_type: 'BEHAVIOURAL',
      target_competencies: ['c_stakeholder_communication'],
      seniority: 'ENTRY',
      language: 'en',
      source: 'BANK',
      prompt_version: '1.0',
      validated: true,
      rephrase_text: 'How do you navigate differing opinions in a project?',
      framework: 'STAR',
      kind: 'MAIN',
    },
    {
      question_id: 'bank_priorities',
      candidate_text: 'What do you do if your project deliverables shift suddenly?',
      interviewer_intent: 'PRIORITISATION',
      probe_targets: ['action'],
      question_type: 'SITUATIONAL',
      target_competencies: ['c_adaptability'],
      seniority: 'ENTRY',
      language: 'en',
      source: 'BANK',
      prompt_version: '1.0',
      validated: true,
      rephrase_text: 'How do you reprioritise when deadlines move?',
      framework: 'SITUATIONAL_JUDGEMENT',
      kind: 'MAIN',
    }
  ],
  assessment_type: 'COMPETENCY',
  technical_reference: null,
};

function createMockState(profile) {
  const coverage = Object.fromEntries(
    mockBlueprint.map((item) => [item.id, { status: 'NO_EVIDENCE', evidence_ids: [] }])
  );
  const plan = fallbackPlan(mockBlueprint, profile, mockRolePack);
  return {
    ...createInterviewState({
      interviewId: 'sim_' + Math.random().toString(36).slice(2, 8),
      profile,
      jdQuality: { outcome: 'PASS', score: 90, cleaned_text: '', word_count: 200, responsibility_lines: 5, boilerplate_ratio: 0.1, detected_titles: [], stripped_patterns: [], truncated: false, reason: null },
      discovery: { competencies: mockBlueprint, role_summary: 'Role summary', seniority_detected: profile.experience_level, management_scope: 'none' },
      rolePack: mockRolePack,
    }),
    blueprint: mockBlueprint,
    coverage,
    plan,
    question_number: 5, // Slot 5 is behavioural
    current_question: plan[4],
  };
}

test('1. Live simulation: Synthetic Finance Student (Level 1 -> Level 2 -> Level 3 -> Move on)', () => {
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
    project_highlight: 'Discounted Cash Flow valuation of renewable energy portfolio',
  };

  let state = createMockState(financeStudentProfile);
  assert.equal(state.current_question.question_type, 'BEHAVIOURAL');

  // Turn 1: Level 1 direct behavioural probe -> Student says "I haven't done that in a job"
  const precheck1 = precheckAnswer("I haven't done that");
  assert.equal(precheck1.kind, 'NO_EXAMPLE');
  const turn1 = decideTurn(state, precheck1, null);
  assert.equal(turn1.action, 'BROADEN_SETTING', 'Must broaden setting to university/projects/volunteering');
  
  // Apply Level 2 Broaden Setting
  state = applyImmediateDecision(state, turn1, null);
  assert.ok(state.transferable_offered_for.includes(state.question_number));
  assert.match(state.current_question.candidate_text, /university|project|volunteering|practical/i);

  // Turn 2: Level 2 transferable probe -> Student still has no example ("I don't have that experience")
  const precheck2 = precheckAnswer("I don't have that experience");
  assert.equal(precheck2.kind, 'NO_EXAMPLE');
  const turn2 = decideTurn(state, precheck2, null);
  assert.equal(turn2.action, 'OFFER_HYPOTHETICAL', 'Must offer realistic hypothetical scenario');

  // Apply Level 3 Hypothetical Scenario
  state = applyImmediateDecision(state, turn2, null);
  assert.ok(state.hypothetical_offered_for.includes(state.question_number));
  assert.equal(state.current_question.kind, 'HYPOTHETICAL');
  assert.match(state.current_question.candidate_text, /If you faced this situation/i);

  // Turn 3: Student responds to Level 3 with strong situational reasoning
  const situationalAnswer = "If a disagreement arose on the team regarding the valuation model discount rate, I would first schedule an alignment meeting to compare underlying assumptions, benchmark against industry comps, and document our shared rationale.";
  assert.ok(situationalAnswer.length > 50);
  
  // Record hypothetical evidence in ledger
  const hypotheticalEvidence = {
    id: 'E01',
    question_number: 5,
    summary: 'Explained structured approach to reconciling discount rate assumptions using industry benchmarks.',
    segment_ids: ['S001'],
    example_key: 'hypothetical_discount_rate',
    competencies: { c_stakeholder_communication: 'MEDIUM' },
    criteria: { situation: 'PRESENT', task: 'PRESENT', action: 'PRESENT', result: 'PRESENT' },
    evidence_type: 'HYPOTHETICAL',
    unsupported_claims: [],
    dedupe_key: 'c_stakeholder_communication|SITUATIONAL|MEDIUM',
  };
  state.evidence_ledger.push(hypotheticalEvidence);
  state.coverage.c_stakeholder_communication = { status: 'PARTIAL', evidence_ids: ['E01'] };

  // Feedback verification: Ensure feedback distinguishes situational reasoning from direct employment evidence
  const fb = deterministicFeedbackFallback(state);
  const commFeedback = fb.competencies.find(c => c.id === 'c_stakeholder_communication');
  assert.ok(commFeedback, 'Feedback generated');
  assert.match(commFeedback.what_worked, /In the situational scenario, your structured reasoning showed/i, 'Feedback must explicitly acknowledge situational reasoning');
  assert.ok(!commFeedback.what_worked.includes('Your employment example'), 'Must not pretend candidate had employment experience');

  // Turn 4: Exhaustion check - if another NO_EXAMPLE comes on the same question, must MOVE_ON
  const precheck3 = precheckAnswer("I don't know");
  const turn3 = decideTurn(state, precheck3, null);
  assert.equal(turn3.action, 'MOVE_ON', 'Must move on once hypothetical is exhausted');
});

test('2. Candidate Spectrum & Stage Realism Validation', () => {
  const profiles = [
    {
      name: 'Computer Science Student',
      profile: {
        experience_level: 'ENTRY',
        years_experience: 0,
        current_or_previous_role: 'Student',
        target_role: 'Associate Software Engineer',
        industry_background: 'Software',
        career_change: false,
        management_experience: false,
        language: 'en',
        academic_field: 'Computer Science',
        qualification: 'BSc Computer Science',
        academic_stage: 'Penultimate Year',
        evidence_sources: ['ACADEMIC', 'PERSONAL_PROJECT'],
        project_highlight: 'Distributed key-value store in Go',
      },
      evidenceType: 'ACADEMIC',
      summary: 'Architected distributed raft cluster for course capstone.',
      expectedPrefix: 'Your academic project demonstrated',
    },
    {
      name: 'Mechanical Engineering Student',
      profile: {
        experience_level: 'ENTRY',
        years_experience: 1,
        current_or_previous_role: 'Engineering Intern',
        target_role: 'Junior Mechanical Engineer',
        industry_background: 'Automotive',
        career_change: false,
        management_experience: false,
        language: 'en',
        academic_field: 'Mechanical Engineering',
        qualification: 'BEng Mechanical',
        academic_stage: 'Recent Graduate',
        evidence_sources: ['INTERNSHIP', 'PERSONAL_PROJECT'],
        project_highlight: 'Formula Student suspension geometry',
      },
      evidenceType: 'INTERNSHIP',
      summary: 'Optimised wishbone tolerances at automotive supplier during summer placement.',
      expectedPrefix: 'Your internship experience demonstrated',
    },
    {
      name: 'Healthcare/Nursing Graduate',
      profile: {
        experience_level: 'ENTRY',
        years_experience: 1,
        current_or_previous_role: 'Student Nurse',
        target_role: 'Registered Staff Nurse',
        industry_background: 'Healthcare',
        career_change: false,
        management_experience: false,
        language: 'en',
        academic_field: 'Nursing',
        qualification: 'BSc Nursing',
        academic_stage: 'Graduate',
        evidence_sources: ['INTERNSHIP', 'ACADEMIC'],
        project_highlight: 'ICU clinical rotation and patient handover protocol',
      },
      evidenceType: 'INTERNSHIP',
      summary: 'Handled triage escalation during peak emergency ward rotation.',
      expectedPrefix: 'Your internship experience demonstrated',
    },
    {
      name: 'Business Graduate',
      profile: {
        experience_level: 'ENTRY',
        years_experience: 0,
        current_or_previous_role: 'Student',
        target_role: 'Commercial Operations Associate',
        industry_background: 'E-commerce',
        career_change: false,
        management_experience: false,
        language: 'en',
        academic_field: 'Business Administration',
        qualification: 'BBA',
        academic_stage: 'Final Year',
        evidence_sources: ['VOLUNTEER', 'ACADEMIC'],
        project_highlight: 'Led student enterprise consultancy for local retail client',
      },
      evidenceType: 'VOLUNTEER',
      summary: 'Organised inventory reduction drive for non-profit community shop.',
      expectedPrefix: 'Your practical project demonstrated',
    },
    {
      name: 'Career Changer: Secondary Teacher -> Corporate L&D',
      profile: {
        experience_level: 'PROFESSIONAL',
        years_experience: 8,
        current_or_previous_role: 'Secondary School Science Teacher',
        target_role: 'Learning & Development Specialist',
        industry_background: 'Corporate HR / Talent Development',
        career_change: true,
        management_experience: false,
        language: 'en',
        project_highlight: 'Transitioning instructional design and adult pedagogy skills',
      },
      evidenceType: 'EMPLOYMENT',
      summary: 'Designed multi-module curriculum and trained 15 department teachers on interactive assessments.',
      expectedPrefix: 'Your example showed',
    },
  ];

  for (const item of profiles) {
    let state = createMockState(item.profile);
    const plan = state.plan;
    
    // Verify plan questions are balanced (not forcing only behavioural)
    const types = plan.map(q => q.question_type);
    assert.ok(types.includes('INTRODUCTION'), `${item.name}: plan must include INTRODUCTION`);
    assert.ok(types.includes('BEHAVIOURAL'), `${item.name}: plan must include BEHAVIOURAL`);
    assert.ok(types.includes('SITUATIONAL'), `${item.name}: plan must include SITUATIONAL`);

    // Verify evidence type reporting in feedback
    const evidenceEntry = {
      id: 'E_TEST_' + Math.random().toString(36).slice(2, 6),
      question_number: 2,
      summary: item.summary,
      segment_ids: ['S001'],
      example_key: 'ex_test',
      competencies: { c_analytical_thinking: 'STRONG' },
      criteria: { situation: 'STRONG', task: 'STRONG', action: 'STRONG', result: 'STRONG' },
      evidence_type: item.evidenceType,
      unsupported_claims: [],
      dedupe_key: 'c_analytical_thinking|' + item.evidenceType,
    };
    state.evidence_ledger.push(evidenceEntry);
    state.coverage.c_analytical_thinking = { status: 'STRONG', evidence_ids: [evidenceEntry.id] };

    const fb = deterministicFeedbackFallback(state);
    const analyticalFb = fb.competencies.find(c => c.id === 'c_analytical_thinking');
    assert.ok(analyticalFb, `${item.name}: Feedback found`);
    assert.match(analyticalFb.what_worked, new RegExp(item.expectedPrefix, 'i'), `${item.name}: Feedback must match prefix ${item.expectedPrefix}`);
  }
});
