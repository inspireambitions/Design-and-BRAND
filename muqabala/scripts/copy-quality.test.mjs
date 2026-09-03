/**
 * Copy quality gates (brief sections 2.5 and 7).
 *
 *  1. No em dashes anywhere in candidate-facing source, in any file.
 *  2. "Practice" is never used as a verb in English copy.
 *  3. English strings in lib/i18n.ts for the candidate-facing prefixes read at
 *     an average Flesch-Kincaid grade of 6 or below; any single string above
 *     grade 8 is listed.
 */
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

register('./test-hooks/ts-paths.mjs', import.meta.url);

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const COPY_GLOBS = ['lib/i18n.ts', 'lib/marketing-content.ts', 'lib/roles/*.ts', 'components/**/*.tsx', 'app/**/*.tsx'];
const copyFiles = [...new Set(COPY_GLOBS.flatMap((pattern) => globSync(pattern, { cwd: root })))]
  .filter((file) => !file.includes('node_modules'))
  .sort();

test('em dashes: none anywhere in candidate-facing source', () => {
  const problems = [];
  for (const file of copyFiles) {
    const count = (read(file).match(/\u2014/g) ?? []).length;
    if (count > 0) problems.push(`${file}: ${count} em dash${count === 1 ? '' : 'es'}`);
  }
  assert.deepEqual(problems, [], 'em dashes found');
});

const PRACTICE_VERB_CAPITAL = /\bPractice (for|with|until|this|your|now|again|the)\b/g;
const PRACTICE_VERB_LOWER = /(^|[.!?]\s+|['"`>]\s*)practice (for|until|again)\b/gm;

test('"practice" is never a verb in English copy (use "practise")', () => {
  const problems = [];
  for (const file of copyFiles) {
    const source = read(file);
    for (const match of source.matchAll(PRACTICE_VERB_CAPITAL)) problems.push(`${file}: "${match[0]}"`);
    for (const match of source.matchAll(PRACTICE_VERB_LOWER)) problems.push(`${file}: "${match[0].trim()}"`);
  }
  assert.deepEqual(problems, []);
});

function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

test('public copy never exposes internal release labels', async () => {
  const [{ STRINGS }, { infoPages }] = await Promise.all([
    import('../lib/i18n.ts'),
    import('../lib/marketing-content.ts'),
  ]);
  const publicCopy = [...collectStrings(STRINGS), ...collectStrings(infoPages)];
  const releaseLabel = /\b(?:MVP|V2|beta|prototype|proof of concept)\b/i;
  assert.deepEqual(publicCopy.filter((value) => releaseLabel.test(value)), []);

  const arabicAdaptivePrivacy = infoPages.privacy.ar.sections
    .find((section) => section.title === 'المقابلات النصية المتكيفة')?.body ?? '';
  assert.match(arabicAdaptivePrivacy, /90 يوماً/);
});

const READABILITY_PREFIXES = ['whatWorked', 'whatToImprove', 'biggestWin', 'keep', 'landing', 'readiness', 'shareCard', 'tag', 'plan'];
const MAX_AVERAGE_GRADE = 6;
const LIST_ABOVE_GRADE = 8;

function countSyllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function fleschKincaidGrade(text) {
  const plain = text.replace(/\{[a-zA-Z]+\}/g, 'x').replace(/[…]/g, '.').trim();
  const sentences = Math.max(1, (plain.match(/[.!?]+(\s|$)/g) ?? []).length);
  const words = plain.split(/\s+/).map((word) => word.replace(/[^A-Za-z'-]/g, '')).filter(Boolean);
  if (!words.length) return 0;
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

test('candidate-facing English strings read at grade 6 on average', async () => {
  const { STRINGS } = await import('../lib/i18n.ts');
  const entries = Object.entries(STRINGS.en)
    .filter(([key, value]) => READABILITY_PREFIXES.some((prefix) => key.startsWith(prefix)) && typeof value === 'string')
    .map(([key, value]) => ({ key, value, grade: fleschKincaidGrade(value) }));
  assert.ok(entries.length > 0, 'expected readability-checked strings in lib/i18n.ts');
  const average = entries.reduce((sum, entry) => sum + entry.grade, 0) / entries.length;
  const hard = entries.filter((entry) => entry.grade > LIST_ABOVE_GRADE).sort((a, b) => b.grade - a.grade);
  console.log(`# readability: ${entries.length} strings, average Flesch-Kincaid grade ${average.toFixed(2)}`);
  for (const entry of hard) console.log(`# above grade ${LIST_ABOVE_GRADE}: ${entry.key} (${entry.grade.toFixed(1)}): ${entry.value}`);
  assert.ok(average <= MAX_AVERAGE_GRADE, `average grade ${average.toFixed(2)} is above ${MAX_AVERAGE_GRADE}; hardest: ${hard.map((entry) => `${entry.key} (${entry.grade.toFixed(1)})`).join(', ')}`);
});

test('the grade formula behaves on known samples', () => {
  assert.ok(fleschKincaidGrade('The cat sat on the mat.') < 2);
  assert.ok(fleschKincaidGrade('Notwithstanding the aforementioned considerations, the organisation subsequently reconsidered its implementation methodology.') > 12);
  assert.equal(countSyllables('question'), 2);
  assert.equal(countSyllables('feedback'), 2);
  assert.equal(countSyllables('interview'), 3);
});
