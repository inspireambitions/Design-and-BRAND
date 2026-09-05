import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { STRINGS } from '../lib/i18n.ts';

const component = (name) => Object.assign(() => null, { displayName: name });
function load(file, exportName, lang = 'en') {
  const source = readFileSync(new URL('../components/' + file + '.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: {} }, require(id) {
    if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (id === 'react') return { useMemo: (fn) => fn(), useState: (value) => [value, () => {}] };
    if (id.endsWith('LanguageProvider')) return { useLang: () => ({ t: (key) => STRINGS[lang][key], lang }) };
    if (id.endsWith('feedback-copy')) return { limitBlock: (items) => items.join(' '), limitSentences: (value) => value };
    if (id.endsWith('role-cards')) return { popularRoleCards: (roles) => roles };
    return new Proxy({}, { get: (_t, key) => key === '__esModule' ? true : component(String(key)) });
  } });
  return exports[exportName];
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const feedback = {
  status: 'scored', score: 85, source: 'ai', headline: 'Relevant work experience',
  competencies: [], strengths: ['Explains relevant work.'], improvements: ['Add an outcome.'], coachTip: 'Give one example.',
};
test('answer score is visible without opening detailed feedback', () => {
  const view = load('FeedbackCard', 'FeedbackCard')({ feedback });
  const rings = nodes(view, (n) => n.type?.displayName === 'ScoreRing');
  assert.equal(rings.length, 1);
  assert.equal(rings[0].props.value, 85);
  const details = nodes(view, (n) => n.type === 'details')[0];
  assert.equal(nodes(details, (n) => n.type?.displayName === 'ScoreRing').length, 0);
});
test('unscored feedback has a clear label and no numeric ring', () => {
  for (const lang of ['en', 'ar']) {
    const view = load('FeedbackCard', 'FeedbackCard', lang)({ feedback: { ...feedback, status: 'unscored', score: 0 } });
    assert.equal(nodes(view, (n) => n.type?.displayName === 'ScoreRing').length, 0);
    assert.equal(nodes(view, (n) => n.props?.children === STRINGS[lang].readinessNotScored).length, 1);
  }
});
test('role cards describe both current modes instead of the old five-question duration', () => {
  for (const lang of ['en', 'ar']) {
    const view = load('HomeView', 'HomeView', lang)({ roles: [{
      id: 'nurse', title: 'Staff Nurse', titleAr: 'ممرض', industry: 'Care', industryAr: 'رعاية',
      blurb: 'Ward nursing', blurbAr: 'تمريض', questionCount: 5,
    }] });
    assert.equal(nodes(view, (n) => n.props?.children === STRINGS[lang].landingPracticeOptions).length, 1);
  }
});
