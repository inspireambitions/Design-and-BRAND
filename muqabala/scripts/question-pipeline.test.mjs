import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidatedQuestion,
  CANDIDATE_TEXT_REASON_CODES,
  fixedRephrase,
  loadValidatedQuestionBank,
  validateCandidateText,
} from '../lib/universal-interview/candidate-question.ts';
import { fallbackDiscovery, fallbackPlan, mergeAndRankCompetencies } from '../lib/universal-interview/blueprint.ts';
import { createInterviewState } from '../lib/universal-interview/engine.ts';
import { publicInterviewState } from '../lib/universal-interview/api.ts';
import { ModelCallBudget } from '../lib/universal-interview/model-budget.ts';
import { generateQuestionWithRetry, processUniversalTurn } from '../lib/universal-interview/process-turn.ts';
import {
  frameworkForQuestionType,
  makeBankQuestion,
  upgradeStoredQuestionState,
  validatedBankFallback,
} from '../lib/universal-interview/questions.ts';
import { CANDIDATE_TEXT_CONTRACT, PLAN_INSTRUCTIONS, QUESTION_INSTRUCTIONS } from '../lib/universal-interview/prompts.ts';

const PASS = 'What did you do?';
const F1 = 'What specific example shows Why the candidate specifically wants the Housekeeping Attendant role and what relevant experience or understanding they have of room-cleaning standards and guest care.?';
const F2 = 'What specific example shows Ask for one specific room-cleaning example from the hotel attachment, including the standards followed, how guest belongings and needs were handled, and why that experience motivated pursuit of this役割?';

function validate(text, seniority = 'ENTRY') {
  return validateCandidateText(text, { language: 'en', seniority });
}

const failuresByReason = {
  THIRD_PERSON: 'Why does the candidate want this role?',
  INTERVIEWER_VERB: 'Ask for your best work example?',
  NON_LATIN: 'What did you do 役割?',
  QMARK_COUNT: 'What did you do',
  QMARK_POSITION: 'What did you do? Please',
  DOUBLE_PUNCT: 'What did you do.?',
  TOO_LONG: `What did you do ${Array.from({ length: 33 }, (_, index) => `word${index}`).join(' ')}?`,
  MULTI_QUESTION: 'Tell me about your work. What did you do?',
  CONJUNCTION_OVERLOAD: 'What did you plan and deliver and measure and improve?',
  FILLER_START: 'Great, what did you do?',
  PLACEHOLDER: 'What did you do with {item}?',
  EMPTY: '   ',
  NOT_SECOND_PERSON: 'What happened next?',
};

for (const reason of CANDIDATE_TEXT_REASON_CODES) {
  test(`validator rejects ${reason} and accepts a minimal valid question`, () => {
    const failed = validate(failuresByReason[reason]);
    assert.equal(failed.ok, false);
    assert.ok(failed.reasons.includes(reason), `${reason} missing from ${failed.reasons.join(',')}`);
    assert.deepEqual(validate(PASS), { ok: true, reasons: [] });
  });
}

test('reported fixtures fail with the required reason codes', () => {
  const f1 = validate(F1);
  const f2 = validate(F2);
  assert.equal(f1.ok, false);
  assert.equal(f2.ok, false);
  for (const reason of ['THIRD_PERSON', 'DOUBLE_PUNCT', 'TOO_LONG']) assert.ok(f1.reasons.includes(reason));
  for (const reason of ['INTERVIEWER_VERB', 'NON_LATIN', 'TOO_LONG', 'CONJUNCTION_OVERLOAD']) assert.ok(f2.reasons.includes(reason));
});

test('published passing and multi-question fixtures behave exactly as required', () => {
  assert.deepEqual(validate('Why do you want to work as a Housekeeping Attendant here?'), { ok: true, reasons: [] });
  const multi = validate('Tell me about one room you cleaned during your hotel attachment. What standards did you follow?');
  assert.equal(multi.ok, false);
  assert.ok(multi.reasons.includes('QMARK_COUNT'));
  assert.ok(multi.reasons.includes('MULTI_QUESTION'));
  assert.deepEqual(validate('What standards did you follow when cleaning a room during your hotel attachment?'), { ok: true, reasons: [] });
});

test('question generation instructions end with the exact candidate contract', () => {
  assert.ok(PLAN_INSTRUCTIONS.endsWith(CANDIDATE_TEXT_CONTRACT));
  assert.ok(QUESTION_INSTRUCTIONS.endsWith(CANDIDATE_TEXT_CONTRACT));
});

function makeState(seniority = 'ENTRY') {
  const profile = {
    experience_level: seniority,
    years_experience: 2,
    current_or_previous_role: 'Room Attendant',
    target_role: 'Housekeeping Attendant',
    industry_background: 'Hospitality',
    career_change: false,
    management_experience: false,
    language: 'en',
  };
  const pack = {
    role: 'Housekeeping Attendant',
    version: 'test',
    author: 'Test',
    reviewed_by: 'Test',
    reviewed_at: '2026-09-03',
    implicit_competencies: ['c_complaint_handling', 'c_prioritisation'],
    core_competencies: ['c_guest_service'],
    question_bank: [makeBankQuestion({
      question_id: 'bank_complaint_recovery',
      candidate_text: 'How did you recover a difficult guest experience?',
      interviewer_intent: 'COMPLAINT_RECOVERY',
      question_type: 'BEHAVIOURAL',
      target_competencies: ['c_complaint_handling'],
      seniority,
    })],
    assessment_type: 'COMPETENCY',
    technical_reference: null,
  };
  const discovery = fallbackDiscovery(profile, pack);
  discovery.competencies = mergeAndRankCompetencies(discovery.competencies, pack, false);
  const state = createInterviewState({
    interviewId: '22222222-2222-4222-8222-222222222222',
    profile,
    jdQuality: {
      outcome: 'FAIL', score: 0, cleaned_text: '', word_count: 0, responsibility_lines: 0,
      boilerplate_ratio: 0, detected_titles: [], stripped_patterns: [], truncated: false, reason: 'missing',
    },
    discovery,
    rolePack: pack,
  });
  state.blueprint = discovery.competencies.slice(0, 5);
  state.plan = fallbackPlan(state.blueprint, profile, pack);
  state.current_question = state.plan[0];
  state.phase = 'ACTIVE';
  return state;
}

test('serving layer throws for validated false', () => {
  const question = { ...makeState().current_question, validated: false };
  assert.throws(() => assertValidatedQuestion(question), /Refusing to serve unvalidated question/);
});

test('candidate API serialisation strips all internal question fields', () => {
  const state = makeState();
  const response = publicInterviewState(state);
  assert.deepEqual(Object.keys(response.current_question).sort(), [
    'candidate_text', 'question_id', 'question_number', 'total_questions',
  ]);
  assert.equal('interviewer_intent' in response.current_question, false);
  assert.equal('probe_targets' in response.current_question, false);
});

test('screening turn stays within budget and continues safely when automated analysis is unavailable', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const state = makeState();
    const answer = 'I cleaned the room carefully and checked every item before the guest arrived.';
    const result = await processUniversalTurn(state, answer, {
      allowDeterministicExtractionFallback: true,
    });

    assert.equal(result.modelCalls <= 2, true);
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.state.question_number, 2);
    assert.equal(result.state.transcripts.E01, answer);
    assert.equal(result.state.decision_log.at(-1)?.fallback_used, true);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('two rejected model answers trigger one retry, then a validated bank fallback and rejection logs', async () => {
  const state = makeState();
  let calls = 0;
  const logs = [];
  const result = await generateQuestionWithRetry({
    state,
    action: 'MOVE_ON',
    probeTarget: '',
    replacementCompetencyId: 'c_complaint_handling',
    kind: 'MAIN',
    budget: new ModelCallBudget(2),
    request: async () => {
      calls += 1;
      return {
        candidate_text: F2,
        question_type: 'BEHAVIOURAL',
        target_competencies: ['c_complaint_handling'],
        interviewer_intent: 'COMPLAINT_RECOVERY',
      };
    },
    log: (entry) => logs.push(entry),
  });
  assert.equal(result, null);
  assert.equal(calls, 2);
  assert.equal(logs.length, 2);
  assert.ok(logs.every((entry) => entry.event === 'question_rejected' && entry.reasons.includes('NON_LATIN')));
  const fallback = validatedBankFallback(state, 'c_complaint_handling');
  assert.equal(fallback.source, 'BANK');
  assert.equal(fallback.validated, true);
  assert.deepEqual(validate(fallback.candidate_text), { ok: true, reasons: [] });
});

test('valid model candidate_text is served unchanged and marked validated', async () => {
  const state = makeState();
  const candidateText = 'What standards did you follow when cleaning a room during your hotel attachment?';
  const result = await generateQuestionWithRetry({
    state,
    action: 'MOVE_ON',
    probeTarget: '',
    kind: 'MAIN',
    budget: new ModelCallBudget(2),
    request: async () => ({
      candidate_text: candidateText,
      question_type: 'BEHAVIOURAL',
      target_competencies: [state.blueprint[0].id],
      interviewer_intent: 'ROOM_STANDARDS',
    }),
  });
  assert.equal(result.candidate_text, candidateText);
  assert.equal(result.validated, true);
  assert.equal(result.prompt_version, state.prompt_version);
});

test('bank ingestion excludes a broken seed and logs its reason codes', () => {
  const logs = [];
  const base = {
    interviewer_intent: 'TEST', probe_targets: [], question_type: 'BEHAVIOURAL',
    target_competencies: ['c_guest_service'], seniority: 'ENTRY', language: 'en', source: 'BANK',
    prompt_version: null, rephrase_text: fixedRephrase('BEHAVIOURAL'), framework: frameworkForQuestionType('BEHAVIOURAL'), kind: 'MAIN',
  };
  const loaded = loadValidatedQuestionBank([
    { ...base, question_id: 'valid_seed', candidate_text: PASS },
    { ...base, question_id: 'broken_seed', candidate_text: F2 },
  ], (entry) => logs.push(entry));
  assert.deepEqual(loaded.map((question) => question.question_id), ['valid_seed']);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].question_id, 'broken_seed');
  assert.ok(logs[0].reasons.includes('INTERVIEWER_VERB'));
});

test('stored legacy questions are upgraded and unsafe text is replaced before serving', () => {
  const state = makeState();
  state.plan = state.plan.map((question) => ({
    slot: question.slot,
    text: question.candidate_text,
    rephrase: `Old wrapper ${question.candidate_text}`,
    primary_intent: question.interviewer_intent,
    question_type: question.question_type,
    target_competencies: question.target_competencies,
    framework: question.framework,
  }));
  state.current_question = {
    text: F2,
    intent: 'BROKEN_GUIDANCE',
    question_type: 'BEHAVIOURAL',
    target_competencies: [state.blueprint[0].id],
    framework: 'STAR',
    kind: 'MAIN',
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const upgraded = upgradeStoredQuestionState(state);
    assert.equal(upgraded.current_question.validated, true);
    assert.notEqual(upgraded.current_question.candidate_text, F2);
    assert.deepEqual(validate(upgraded.current_question.candidate_text), { ok: true, reasons: [] });
    assert.ok(upgraded.plan.every((question) => question.validated));
  } finally {
    console.warn = originalWarn;
  }
});

test('mocked Housekeeping Attendant ENTRY pipeline serves eight valid main questions', async () => {
  const state = makeState('ENTRY');
  const served = [];
  let modelCalls = 0;
  for (const [index, planned] of state.plan.entries()) {
    let attempt = 0;
    const generated = await generateQuestionWithRetry({
      state: { ...state, question_number: index + 1, current_question: planned },
      action: 'MOVE_ON',
      probeTarget: '',
      kind: 'MAIN',
      budget: new ModelCallBudget(2),
      request: async () => {
        modelCalls += 1;
        attempt += 1;
        return {
          candidate_text: index % 2 === 0 && attempt === 1 ? F2 : planned.candidate_text,
          question_type: planned.question_type,
          target_competencies: planned.target_competencies,
          interviewer_intent: planned.interviewer_intent,
        };
      },
      log: () => {},
    });
    served.push(generated ?? makeBankQuestion({
      question_id: `e2e_fallback_${index + 1}`,
      candidate_text: 'What is one relevant example from your experience?',
      interviewer_intent: 'E2E_FALLBACK',
      question_type: 'BEHAVIOURAL',
      target_competencies: planned.target_competencies,
      seniority: 'ENTRY',
    }));
  }
  assert.equal(served.length, 8);
  assert.ok(modelCalls > 8);
  for (const question of served) {
    const validation = validate(question.candidate_text, 'ENTRY');
    assert.deepEqual(validation, { ok: true, reasons: [] });
    assert.match(question.candidate_text, /\b(?:you|your)\b/i);
    assert.ok(question.candidate_text.trim().split(/\s+/).length <= 35);
    assert.equal(question.kind, 'MAIN');
    assert.equal(question.validated, true);
  }
});
