/**
 * Arabic parity. Every candidate-facing string ships in both languages:
 * catalogue roles (questions, competencies, hints and the rubric anchors that
 * feed the sample answer), the question tags, and every key in lib/i18n.ts.
 */
import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('./test-hooks/ts-paths.mjs', import.meta.url);

const { ROLES } = await import('../lib/roles/index.ts');
const { QUESTION_TAGS } = await import('../lib/roles/question-tags.ts');
const { STRINGS } = await import('../lib/i18n.ts');

const ARABIC = /[\u0600-\u06FF]/;
const filled = (value) => typeof value === 'string' && value.trim().length > 0;

function pairs(label, object, fields) {
  const problems = [];
  for (const field of fields) {
    const en = object[field];
    const ar = object[`${field}Ar`];
    if (!filled(en)) problems.push(`${label}.${field} is empty`);
    if (!filled(ar)) problems.push(`${label}.${field}Ar is empty`);
    else if (!ARABIC.test(ar)) problems.push(`${label}.${field}Ar is not Arabic`);
  }
  return problems;
}

test('every role, question, competency and model answer field exists in English and Arabic', () => {
  const problems = [];
  for (const role of ROLES) {
    problems.push(...pairs(`role ${role.id}`, role, ['title', 'industry', 'blurb']));
    for (const competency of role.competencies) {
      problems.push(...pairs(`${role.id}/${competency.id}`, competency, ['label', 'anchor']));
    }
    const questions = [...role.questions, ...(role.bank ?? [])];
    for (const question of questions) {
      problems.push(...pairs(`${role.id}/${question.id}`, question, ['text', 'hint']));
    }
  }
  assert.deepEqual(problems, []);
});

test('question tags carry both labels', () => {
  assert.deepEqual(QUESTION_TAGS.flatMap((tag) => pairs(`tag ${tag.id}`, tag, ['label'])), []);
});

test('lib/i18n.ts Arabic key set equals the English key set and no value is empty', () => {
  const en = Object.keys(STRINGS.en).sort();
  const ar = Object.keys(STRINGS.ar).sort();
  const missingInArabic = en.filter((key) => !ar.includes(key));
  const extraInArabic = ar.filter((key) => !en.includes(key));
  assert.deepEqual({ missingInArabic, extraInArabic }, { missingInArabic: [], extraInArabic: [] });
  const empty = [
    ...en.filter((key) => !filled(STRINGS.en[key])).map((key) => `en.${key}`),
    ...ar.filter((key) => !filled(STRINGS.ar[key])).map((key) => `ar.${key}`),
  ];
  assert.deepEqual(empty, []);
});
