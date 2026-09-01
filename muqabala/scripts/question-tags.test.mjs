import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('./test-hooks/ts-paths.mjs', import.meta.url);

const { ROLES } = await import('../lib/roles/index.ts');
const { QUESTION_TAGS, QUESTION_TAG_IDS, MAX_TAGS_PER_QUESTION, isQuestionTagId, questionTagLabel } = await import('../lib/roles/question-tags.ts');

const allQuestions = ROLES.flatMap((role) => [...role.questions, ...(role.bank ?? [])].map((question) => ({ role: role.id, question })));

test('the tag list is controlled, unique and bilingual', () => {
  assert.ok(QUESTION_TAGS.length >= 5);
  assert.equal(new Set(QUESTION_TAG_IDS).size, QUESTION_TAG_IDS.length);
  for (const tag of QUESTION_TAGS) {
    assert.match(tag.id, /^[a-z_]+$/, `${tag.id} is snake_case`);
    assert.ok(tag.label.trim().length > 0, `${tag.id} has an English label`);
    assert.ok(tag.labelAr.trim().length > 0, `${tag.id} has an Arabic label`);
    assert.match(tag.labelAr, /[\u0600-\u06FF]/, `${tag.id} Arabic label is Arabic`);
    assert.doesNotMatch(`${tag.label}${tag.labelAr}`, /—/);
  }
  for (const id of ['uae_hotel', 'saudi_agency', 'qatar_healthcare', 'oman_bahrain_kuwait_retail', 'gulf_general']) {
    assert.ok(isQuestionTagId(id), `${id} is in the list`);
  }
  assert.equal(questionTagLabel('uae_hotel', 'en'), 'Common in UAE hotel interviews');
  assert.equal(questionTagLabel('missing', 'en'), undefined);
});

test('no question carries more than two tags and every tag id is in the list', () => {
  for (const { role, question } of allQuestions) {
    const tags = question.tags ?? [];
    assert.ok(tags.length <= MAX_TAGS_PER_QUESTION, `${role}/${question.id} has ${tags.length} tags`);
    assert.equal(new Set(tags).size, tags.length, `${role}/${question.id} has duplicate tags`);
    for (const tag of tags) assert.ok(isQuestionTagId(tag), `${role}/${question.id} uses unknown tag ${tag}`);
  }
});

test('the hospitality, care and office roles named in the brief are tagged', () => {
  for (const id of ['front-office-agent', 'waiter', 'housekeeping-attendant', 'nurse', 'medical-receptionist', 'receptionist']) {
    const role = ROLES.find((candidate) => candidate.id === id);
    assert.ok(role, `${id} exists`);
    const tagged = role.questions.filter((question) => (question.tags ?? []).length > 0);
    assert.ok(tagged.length >= 3, `${id} has at least three tagged questions, found ${tagged.length}`);
  }
});
