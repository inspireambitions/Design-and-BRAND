import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTrustedQuestionSequence } from '../lib/interview-plan-policy.ts';
import { proofQuestions } from '../lib/proof-questions.ts';
import { signInterview, signProofPack, verifyInterview } from '../lib/interview-token.ts';

const opener = 'opening-question';
const closer = 'closing-question';

const role = {
  id: 'custom',
  title: 'Front Office Agent',
  titleAr: 'موظف استقبال',
  industry: 'Hospitality',
  industryAr: 'الضيافة',
  level: 'Mid',
  blurb: '',
  blurbAr: '',
  competencies: [{ id: 'service', label: 'Service', labelAr: 'خدمة', anchor: 'Helps guests', anchorAr: 'يساعد الضيوف' }],
  questions: [
    { id: 'intro', text: 'Tell me about yourself.', textAr: 'حدثني عن نفسك.', competencies: ['service'], hint: '', hintAr: '', prepSeconds: 30, answerSeconds: 120 },
    { id: 'proudest', text: 'What are you proud of?', textAr: 'بماذا تفتخر؟', competencies: ['service'], hint: '', hintAr: '', prepSeconds: 30, answerSeconds: 120 },
    { id: 'pressure', text: 'Tell me about pressure.', textAr: 'حدثني عن الضغط.', competencies: ['service'], hint: '', hintAr: '', prepSeconds: 30, answerSeconds: 120 },
    { id: 'why_gulf', text: 'Why the Gulf?', textAr: 'لماذا الخليج؟', competencies: ['service'], hint: '', hintAr: '', prepSeconds: 30, answerSeconds: 90 },
  ],
};

test('Quick Practice accepts exactly the trusted opening question', () => {
  assert.equal(matchesTrustedQuestionSequence('guided', [opener], opener, closer), true);
});

test('Quick Practice rejects the old five-question plan', () => {
  assert.equal(
    matchesTrustedQuestionSequence('guided', [opener, 'q2', 'q3', 'q4', closer], opener, closer),
    false,
  );
});

test('Work sample accepts opener, one job question, and closer', () => {
  assert.equal(
    matchesTrustedQuestionSequence('screening', [opener, 'angry_guest', closer], opener, closer),
    true,
  );
});

test('Work sample rejects a two-question plan', () => {
  assert.equal(matchesTrustedQuestionSequence('screening', [opener, closer], opener, closer), false);
});

test('Work sample picks opener, one job question, and closer', () => {
  const questions = proofQuestions(role);
  assert.ok(questions);
  assert.equal(questions.length, 3);
  assert.equal(questions[0].id, 'intro');
  assert.equal(questions[1].id, 'proudest');
  assert.equal(questions[2].id, 'why_gulf');
});

test('Practice tokens and proof packs stay in different families', () => {
  process.env.INTERVIEW_SECRET = 'muqabala-test-secret-key';
  const three = proofQuestions(role);
  assert.ok(three);
  const practiceToken = signInterview({
    title: role.title,
    industry: role.industry,
    level: role.level,
    competencies: role.competencies,
    questions: role.questions,
  });
  const proofToken = signProofPack({
    title: role.title,
    industry: role.industry,
    level: role.level,
    competencies: role.competencies,
    questions: three,
    workplace: 'Al Maha Hotel',
  });
  assert.ok(practiceToken);
  assert.ok(proofToken);
  const practice = verifyInterview(practiceToken);
  const proof = verifyInterview(proofToken);
  assert.equal(practice?.kind, 'practice');
  assert.equal(proof?.kind, 'proof');
  assert.equal(proof?.questions.length, 3);
  assert.equal(proof?.workplace, 'Al Maha Hotel');
  assert.notEqual(practiceToken, proofToken);
});
