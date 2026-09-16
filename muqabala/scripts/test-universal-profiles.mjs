import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInterviewState,
  criteriaMeetSeniority,
} from '../lib/universal-interview/engine.ts';
import { fallbackPlan } from '../lib/universal-interview/blueprint.ts';
import { planInput } from '../lib/universal-interview/prompts.ts';


const mockBlueprint = [
  { id: 'c_problem_solving', name: 'Structured Problem Solving', family: 'behavioural', source: 'EXPLICIT', source_text: 'solve problems', importance: 'HIGH' },
  { id: 'c_technical_execution', name: 'Technical Execution', family: 'technical', source: 'EXPLICIT', source_text: 'technical proficiency', importance: 'HIGH' },
  { id: 'c_collaboration', name: 'Collaboration & Teamwork', family: 'behavioural', source: 'EXPLICIT', source_text: 'team player', importance: 'MEDIUM' },
  { id: 'c_analytical_thinking', name: 'Analytical Thinking', family: 'cognitive', source: 'EXPLICIT', source_text: 'analytical mindset', importance: 'MEDIUM' },
  { id: 'c_motivation', name: 'Role Commitment', family: 'motivation', source: 'ASSUMED', source_text: 'motivation', importance: 'MEDIUM' },
];

const mockRolePack = {
  role: 'Universal Role',
  version: '1.0',
  author: 'Career Specialist',
  reviewed_by: null,
  reviewed_at: null,
  implicit_competencies: ['c_collaboration'],
  core_competencies: ['c_problem_solving'],
  question_bank: [
    {
      question_id: 'bank_conflict',
      candidate_text: 'How do you handle team disagreements?',
      interviewer_intent: 'CONFLICT_RESOLUTION',
      probe_targets: ['action'],
      question_type: 'BEHAVIOURAL',
      target_competencies: ['c_collaboration'],
      seniority: 'ENTRY',
      language: 'en',
      source: 'BANK',
      prompt_version: '1.0',
      validated: true,
      rephrase_text: 'How do you navigate differing opinions?',
      framework: 'STAR',
      kind: 'MAIN',
    },
    {
      question_id: 'bank_priorities',
      candidate_text: 'What do you do if your project deliverables shift?',
      interviewer_intent: 'PRIORITISATION',
      probe_targets: ['action'],
      question_type: 'SITUATIONAL',
      target_competencies: ['c_analytical_thinking'],
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

test('Synthetic Profile A: Final-year CS student (Entry level, academic & project evidence)', () => {
  const profileA = {
    experience_level: 'ENTRY',
    years_experience: 0,
    current_or_previous_role: 'Final Year CS Student',
    target_role: 'Associate Software Engineer',
    industry_background: 'Technology',
    career_change: false,
    management_experience: false,
    language: 'en',
    academic_field: 'Computer Science',
    qualification: 'BSc (Hons)',
    academic_stage: 'Final Year',
    evidence_sources: ['ACADEMIC', 'PERSONAL_PROJECT', 'INTERNSHIP'],
    project_highlight: 'Distributed key-value store in Rust',
  };

  const plan = fallbackPlan(mockBlueprint, profileA, mockRolePack);
  assert.equal(plan.length, 8);

  // Checks that early-career / student questions do NOT assume full-time corporate authority
  assert.match(plan[0].candidate_text, /projects, academic work or practical experiences/);
  assert.match(plan[1].candidate_text, /project, academic or practical challenge/);
  assert.match(plan[2].candidate_text, /project or practical example/);
  assert.match(plan[3].candidate_text, /studies, project work or employment/);

  // Verify prompt incorporates student context
  const state = createInterviewState({
    interviewId: '11111111-1111-4111-8111-111111111111',
    rolePack: mockRolePack,
    profile: profileA,
    jdQuality: { outcome: 'PASS', score: 10, cleaned_text: 'Develop software', word_count: 50, responsibility_lines: 3, boilerplate_ratio: 0, detected_titles: ['Software Engineer'], stripped_patterns: [], truncated: false, reason: null },
    discovery: { competencies: mockBlueprint, role_summary: 'Software Engineer', seniority_detected: 'ENTRY', management_scope: 'None' },
  });
  state.blueprint = mockBlueprint;

  const promptInput = planInput(state);
  assert.ok(promptInput.includes('Academic field: Computer Science'));
  assert.ok(promptInput.includes('Distributed key-value store in Rust'));
  assert.ok(promptInput.includes('ACADEMIC, PERSONAL_PROJECT, INTERNSHIP'));

  // Test criteriaMeetSeniority relaxes corporate result/ownership threshold for ENTRY
  const mockStudentExtraction = {
    evidence: {
      action: 'PRESENT',
      task: 'PRESENT',
      situation: 'PRESENT',
      result: 'MISSING',
      personal_ownership: 'UNSPECIFIED',
      criteria: {
        action: 'PRESENT',
        task: 'PRESENT',
        situation: 'PRESENT',
        result: 'MISSING',
      },
    },
  };

  const meets = criteriaMeetSeniority(state, mockStudentExtraction);
  assert.equal(meets, true, 'Entry level criteria should be satisfied by action and context without requiring executive result');
});

test('Synthetic Profile B: Polytechnic Hospitality Diploma Student (Internship & experiential evidence)', () => {
  const profileB = {
    experience_level: 'ENTRY',
    years_experience: 0,
    current_or_previous_role: 'Hospitality Diploma Intern',
    target_role: 'Guest Relations Associate',
    industry_background: 'Hospitality & Tourism',
    career_change: false,
    management_experience: false,
    language: 'en',
    academic_field: 'Hotel Management',
    qualification: 'Diploma',
    academic_stage: 'Year 2 of 3',
    evidence_sources: ['INTERNSHIP', 'ACADEMIC', 'VOLUNTEER'],
    project_highlight: '400-guest hotel banquet service rotation',
  };

  const plan = fallbackPlan(mockBlueprint, profileB, mockRolePack);
  assert.equal(plan.length, 8);
  assert.match(plan[0].candidate_text, /projects, academic work or practical experiences/);

  const state = createInterviewState({
    interviewId: '22222222-2222-4222-8222-222222222222',
    rolePack: mockRolePack,
    profile: profileB,
    jdQuality: { outcome: 'PASS', score: 10, cleaned_text: 'Hotel service', word_count: 50, responsibility_lines: 3, boilerplate_ratio: 0, detected_titles: ['Guest Relations Associate'], stripped_patterns: [], truncated: false, reason: null },
    discovery: { competencies: mockBlueprint, role_summary: 'Guest Relations', seniority_detected: 'ENTRY', management_scope: 'None' },
  });
  state.blueprint = mockBlueprint;

  const promptInput = planInput(state);
  assert.ok(promptInput.includes('Hotel Management'));
  assert.ok(promptInput.includes('400-guest hotel banquet service rotation'));
});

test('Synthetic Profile C: Business Administration Graduate (Entry level, generalist)', () => {
  const profileC = {
    experience_level: 'ENTRY',
    years_experience: 1,
    current_or_previous_role: 'Recent Graduate',
    target_role: 'Junior Business Analyst',
    industry_background: 'Professional Services',
    career_change: false,
    management_experience: false,
    language: 'en',
    academic_field: 'Business Administration',
    qualification: 'Bachelor of Business Administration',
    academic_stage: 'Graduate',
    evidence_sources: ['ACADEMIC', 'INTERNSHIP', 'EMPLOYMENT'],
  };

  const plan = fallbackPlan(mockBlueprint, profileC, mockRolePack);
  assert.equal(plan.length, 8);
  assert.match(plan[2].candidate_text, /analytical problem/);
});

test('Synthetic Profile D: Mid-career Teacher pivoting to Corporate Training (Career change, professional)', () => {
  const profileD = {
    experience_level: 'PROFESSIONAL',
    years_experience: 8,
    current_or_previous_role: 'Secondary School Teacher',
    target_role: 'Corporate Learning Specialist',
    industry_background: 'Education',
    career_change: true,
    management_experience: false,
    language: 'en',
  };

  const plan = fallbackPlan(mockBlueprint, profileD, mockRolePack);
  assert.equal(plan.length, 8);
  assert.match(plan[0].candidate_text, /right next step in your career change/);
  // Uses professional wording
  assert.match(plan[1].candidate_text, /What work example best shows/);
});

test('Synthetic Profile E: Senior Engineering Manager (Executive leadership & scale)', () => {
  const profileE = {
    experience_level: 'EXECUTIVE',
    years_experience: 15,
    current_or_previous_role: 'Director of Engineering',
    target_role: 'VP of Engineering',
    industry_background: 'FinTech',
    career_change: false,
    management_experience: true,
    language: 'en',
  };

  const plan = fallbackPlan(mockBlueprint, profileE, mockRolePack);
  assert.equal(plan.length, 8);
  assert.match(plan[0].candidate_text, /What experience from your background is most relevant/);
  assert.match(plan[1].candidate_text, /What work example best shows how you handled a difficult task/);

  const state = createInterviewState({
    interviewId: '55555555-5555-4555-8555-555555555555',
    rolePack: mockRolePack,
    profile: profileE,
    jdQuality: { outcome: 'PASS', score: 10, cleaned_text: 'Engineering Leadership', word_count: 50, responsibility_lines: 3, boilerplate_ratio: 0, detected_titles: ['VP of Engineering'], stripped_patterns: [], truncated: false, reason: null },
    discovery: { competencies: mockBlueprint, role_summary: 'VP of Engineering', seniority_detected: 'EXECUTIVE', management_scope: 'Executive' },
  });
  state.blueprint = mockBlueprint;

  // Strict executive criteria test: requires strong criteria and clear personal ownership
  const mockExecExtraction = {
    evidence: {
      action: 'PRESENT',
      task: 'PRESENT',
      situation: 'PRESENT',
      result: 'PRESENT',
      personal_ownership: 'CLEAR',
      criteria: {
        action: 'PRESENT',
        task: 'PRESENT',
        situation: 'PRESENT',
        result: 'PRESENT',
      },
    },
  };

  const meetsWithoutStrong = criteriaMeetSeniority(state, mockExecExtraction);
  assert.equal(meetsWithoutStrong, false, 'Executive level requires strong ratings, not just present');
});
