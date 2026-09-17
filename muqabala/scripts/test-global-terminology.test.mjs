import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GLOBAL_COUNTRY_PACKS,
  GENERIC_DEFAULT_PACK,
  CHITKARA_PROSPECTUS_FIXTURE,
  resolveEducationTerm,
  buildBroadenSettingPrompt,
  detectStudentTerminologyCorrection,
} from '../lib/universal-interview/terminology.ts';
import {
  createInterviewState,
  decideTurn,
  applyImmediateDecision,
  recordAnswer,
} from '../lib/universal-interview/engine.ts';
import { precheckAnswer } from '../lib/universal-interview/sanitise.ts';
import { fallbackPlan } from '../lib/universal-interview/blueprint.ts';
import { validateCandidateText } from '../lib/universal-interview/candidate-question.ts';

const mockBlueprint = [
  { id: 'c_financial_modelling', name: 'Financial Modelling', family: 'technical', source: 'EXPLICIT', source_text: 'DCF valuation', importance: 'HIGH' },
  { id: 'c_analytical_thinking', name: 'Analytical Problem Solving', family: 'cognitive', source: 'EXPLICIT', source_text: 'analytical thinking', importance: 'HIGH' },
  { id: 'c_stakeholder_communication', name: 'Stakeholder Communication', family: 'behavioural', source: 'EXPLICIT', source_text: 'presentation skills', importance: 'MEDIUM' },
  { id: 'c_adaptability', name: 'Adaptability & Prioritisation', family: 'cognitive', source: 'INFERRED', source_text: 'fast-paced', importance: 'MEDIUM' },
  { id: 'c_motivation', name: 'Commercial Drive', family: 'motivation', source: 'ASSUMED', source_text: 'motivation', importance: 'MEDIUM' },
];

const mockRolePack = {
  role: 'Software Trainee',
  version: '1.0',
  author: 'Lead',
  reviewed_by: null,
  reviewed_at: null,
  implicit_competencies: ['c_comm'],
  core_competencies: ['c_tech'],
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

function makeState(profile) {
  const coverage = Object.fromEntries(
    mockBlueprint.map((item) => [item.id, { status: 'NO_EVIDENCE', evidence_ids: [] }]),
  );
  const plan = fallbackPlan(mockBlueprint, profile, mockRolePack);
  return {
    ...createInterviewState({
      interviewId: 'test_' + Math.random().toString(36).slice(2, 8),
      profile,
      jdQuality: { outcome: 'PASS', score: 95, cleaned_text: '', word_count: 100, responsibility_lines: 4, boilerplate_ratio: 0.1, detected_titles: [], stripped_patterns: [], truncated: false, reason: null },
      discovery: { competencies: mockBlueprint, role_summary: 'Role summary', seniority_detected: profile.experience_level, management_scope: 'none' },
      rolePack: mockRolePack,
    }),
    blueprint: mockBlueprint,
    coverage,
    plan,
    question_number: 5,
    current_question: plan[4],
  };
}

test('1. Canonical Concept Model & Pack Parity', () => {
  const requiredCountries = ['CA', 'US', 'IN', 'CN', 'UG', 'KE', 'GH'];
  const concepts = [
    'ACADEMIC_PROJECT',
    'CAPSTONE',
    'PRACTICAL_WORK_EXPOSURE',
    'CLINICAL_PLACEMENT',
    'RESEARCH',
    'VOLUNTEERING',
    'STUDENT_LEADERSHIP',
    'COMPETITION',
    'PORTFOLIO',
    'PERSONAL_PROJECT',
    'PART_TIME_WORK',
    'ENTREPRENEURSHIP',
  ];

  for (const code of requiredCountries) {
    const pack = GLOBAL_COUNTRY_PACKS[code];
    assert.ok(pack, `Missing country pack for ${code}`);
    for (const concept of concepts) {
      assert.ok(pack.concept_terms[concept], `Missing concept ${concept} in ${code} pack`);
    }
  }

  // Check distinct local vocabulary for PRACTICAL_WORK_EXPOSURE
  assert.equal(GLOBAL_COUNTRY_PACKS.CA.concept_terms.PRACTICAL_WORK_EXPOSURE, 'co-op or internship');
  assert.equal(GLOBAL_COUNTRY_PACKS.IN.concept_terms.PRACTICAL_WORK_EXPOSURE, 'internship or industrial training');
  assert.equal(GLOBAL_COUNTRY_PACKS.UG.concept_terms.PRACTICAL_WORK_EXPOSURE, 'internship or industrial attachment');
  assert.equal(GLOBAL_COUNTRY_PACKS.KE.concept_terms.PRACTICAL_WORK_EXPOSURE, 'internship or industrial attachment');
  assert.equal(GLOBAL_COUNTRY_PACKS.GH.concept_terms.PRACTICAL_WORK_EXPOSURE, 'internship or industrial attachment');
});

test('2. Global Realism: Canada, USA, India, China, Uganda, Kenya, Ghana', () => {
  const testProfiles = [
    {
      country: 'Canada',
      code: 'CA',
      targetRole: 'Junior Business Analyst',
      expectedTerm: 'co-op',
      expectedPhrasingRegex: /coursework, a capstone, co-op or volunteering/i,
    },
    {
      country: 'USA',
      code: 'US',
      targetRole: 'Software Development Engineer',
      expectedTerm: 'internship',
      expectedPhrasingRegex: /coursework, a senior capstone, an internship or volunteering/i,
    },
    {
      country: 'India',
      code: 'IN',
      targetRole: 'Graduate Engineer Trainee',
      expectedTerm: 'industrial training',
      expectedPhrasingRegex: /coursework, your final-year project, industrial training or volunteering/i,
    },
    {
      country: 'China',
      code: 'CN',
      targetRole: 'Operations Analyst',
      expectedTerm: 'graduation project',
      expectedPhrasingRegex: /coursework, a graduation project, an internship or practical projects/i,
    },
    {
      country: 'Uganda',
      code: 'UG',
      targetRole: 'Assistant Accountant',
      expectedTerm: 'industrial attachment',
      expectedPhrasingRegex: /coursework, a project, industrial attachment or volunteering/i,
    },
    {
      country: 'Kenya',
      code: 'KE',
      targetRole: 'Junior Network Engineer',
      expectedTerm: 'industrial attachment',
      expectedPhrasingRegex: /coursework, a project, industrial attachment or volunteering/i,
    },
    {
      country: 'Ghana',
      code: 'GH',
      targetRole: 'Associate Data Specialist',
      expectedTerm: 'industrial attachment',
      expectedPhrasingRegex: /coursework, a final-year project, industrial attachment or volunteering/i,
    },
  ];

  for (const item of testProfiles) {
    const profile = {
      experience_level: 'ENTRY',
      years_experience: 0,
      current_or_previous_role: 'Student',
      target_role: item.targetRole,
      industry_background: 'Higher Education',
      career_change: false,
      management_experience: false,
      language: 'en',
      country_code: item.code,
    };

    let state = makeState(profile);

    // Turn 1: No experience
    const precheck = precheckAnswer("I haven't done that");
    assert.equal(precheck.kind, 'NO_EXAMPLE');
    const turn = decideTurn(state, precheck, null);
    assert.equal(turn.action, 'BROADEN_SETTING');

    // Apply immediate decision
    state = applyImmediateDecision(state, turn, null);

    const questionText = state.current_question.candidate_text;
    assert.match(questionText, item.expectedPhrasingRegex, `${item.country} prompt should match expected regional pattern`);
    assert.match(questionText, new RegExp(item.expectedTerm, 'i'), `${item.country} prompt should include ${item.expectedTerm}`);

    // Verify candidate text conforms to strict validation rules (length, word count, 1 question mark, no interviewer verb)
    const validation = validateCandidateText(questionText, { language: 'en', seniority: 'ENTRY' });
    assert.ok(validation.ok, `${item.country} question failed validation: ${validation.reasons.join(', ')}`);
  }
});

test('3. Student Terminology Override Priority: Student correction overrides country pack', () => {
  // A student in India who explicitly states: "We call it industrial attachment"
  const studentProfile = {
    experience_level: 'ENTRY',
    years_experience: 0,
    current_or_previous_role: 'Student',
    target_role: 'Associate Developer',
    industry_background: 'Technology',
    career_change: false,
    management_experience: false,
    language: 'en',
    country_code: 'IN', // Default would be "industrial training"
  };

  let state = makeState(studentProfile);

  // Student answer includes explicit correction
  const studentCorrectionAnswer = "We call it industrial attachment in our university. I worked on a database migration for a local logistics firm.";
  const mockExtraction = {
    answered_the_question: true,
    evidence: {
      summary: 'Database migration during industrial attachment',
      segment_ids: ['S1'],
      example_key: 'ex_db',
      competencies: [{ id: 'c_financial_modelling', strength: 'STRONG', evidence_type: 'ACADEMIC' }],
      criteria: { action: 'STRONG', result: 'STRONG' },
      personal_ownership: 'CLEAR',
      numbers_stated: [],
      unsupported_claims: [],
      same_example_as: null,
    },
    recommended_action: 'PROBE_ACTION',
    probe_target: '',
    possible_inconsistency: null,
  };

  state = recordAnswer(state, mockExtraction, studentCorrectionAnswer);

  // Verify preferred terminology adapted to industrial attachment
  assert.equal(
    state.profile.preferred_education_terms?.PRACTICAL_WORK_EXPOSURE,
    'industrial attachment',
    'State must adopt student terminology correction',
  );

  // Next time BROADEN_SETTING triggers, it must use the student-corrected term "industrial attachment"
  state.transferable_offered_for = [];
  const precheck = precheckAnswer("I don't have that experience");
  const turn = decideTurn(state, precheck, null);
  assert.equal(turn.action, 'BROADEN_SETTING');

  state = applyImmediateDecision(state, turn, null);
  assert.match(
    state.current_question.candidate_text,
    /industrial attachment/i,
    'Prompt must use student-corrected term instead of default country term',
  );
});

test('4. Synthetic Chitkara University Prospectus Fixture Compatibility', () => {
  const programmes = CHITKARA_PROSPECTUS_FIXTURE.programmes;
  assert.ok(programmes.computer_science);
  assert.ok(programmes.mechanical_engineering);
  assert.ok(programmes.finance_business);
  assert.ok(programmes.nursing_healthcare);
  assert.ok(programmes.hospitality);
  assert.ok(programmes.design);

  // Test programme context resolution for Nursing -> clinical rotation or hospital posting
  const nursingTerm = resolveEducationTerm('PRACTICAL_WORK_EXPOSURE', { country_code: 'IN' }, programmes.nursing_healthcare);
  assert.equal(nursingTerm, 'clinical rotation or hospital posting');

  // Test programme context resolution for Engineering -> industrial training
  const engTerm = resolveEducationTerm('PRACTICAL_WORK_EXPOSURE', { country_code: 'IN' }, programmes.computer_science);
  assert.match(engTerm, /industrial training/i);

  // Test that student stated preference still beats programme context
  const overrideProfile = {
    experience_level: 'ENTRY',
    years_experience: 0,
    current_or_previous_role: 'Student',
    target_role: 'Nurse',
    industry_background: 'Healthcare',
    career_change: false,
    management_experience: false,
    language: 'en',
    country_code: 'IN',
    preferred_education_terms: {
      PRACTICAL_WORK_EXPOSURE: 'hospital ward posting',
    },
  };
  const termWithStudentOverride = resolveEducationTerm('PRACTICAL_WORK_EXPOSURE', overrideProfile, programmes.nursing_healthcare);
  assert.equal(termWithStudentOverride, 'hospital ward posting', 'Student preference must override programme prospectus context');
});

test('5. Non-Assumption Invariant: No cultural bias or assumed participation', () => {
  // Confirm that assigning country pack does not invent evidence sources in state
  const canadianStudent = {
    experience_level: 'ENTRY',
    years_experience: 0,
    current_or_previous_role: 'Student',
    target_role: 'Analyst',
    industry_background: 'Finance',
    career_change: false,
    management_experience: false,
    language: 'en',
    country_code: 'CA',
    evidence_sources: ['ACADEMIC'], // Has NOT done co-op or employment
  };

  const state = makeState(canadianStudent);
  // Scoring and coverage must begin at NO_EVIDENCE
  assert.equal(state.coverage.c_financial_modelling.status, 'NO_EVIDENCE');
  assert.equal(state.evidence_ledger.length, 0);

  // Canadian terminology does NOT mean co-op is recorded as evidence
  const hasCoopInLedger = state.evidence_ledger.some((e) => e.summary.toLowerCase().includes('co-op'));
  assert.equal(hasCoopInLedger, false, 'No evidence assumed merely because candidate is in Canada');
});
