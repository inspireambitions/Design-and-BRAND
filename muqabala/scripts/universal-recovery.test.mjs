import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const tick = () => new Promise(resolve => setImmediate(resolve));
const key = 'muqabala.universalInterview.v2';
const discovery = { interview_id: 'synthetic', competencies: [], suggested_competency_ids: [], notice: 'test', role_summary: 'test' };
const interview = { interview_id: 'synthetic', stage: 'interview', retry_used: false, current_question: { question_id: 'q1', candidate_text: 'Synthetic question', question_number: 1, total_questions: 1 } };
const feedback = { competencies: [], single_highest_value_improvement: 'test', caveats: [], retry_recommended_question: 1 };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const button = (view, label) => nodes(view, n => n.type === 'button' && n.props.children === label)[0];
async function harness(fetchImpl, saved = 'synthetic') {
  const source = await readFile(new URL('../components/UniversalInterview.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const states = [], dependencies = [], cleanups = [], effects = [];
  let cursor = 0;
  const listeners = new Map(), documentListeners = new Map();
  const storage = new Map(saved ? [[key, saved]] : []);
  const calls = { back: 0, push: 0, confirm: 0 };
  const t = key => key;
  const window = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    location: { href: 'https://example.test/practice/universal', reload() {} },
    history: { state: {}, pushState() { calls.push++; }, back() { calls.back++; } },
    confirm() { calls.confirm++; return false; },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  class Element { constructor(anchor) { this.anchor = anchor; } closest() { return this.anchor; } }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => react.useState({ current: initial })[0],
    useEffect(fn, deps) { const i = cursor++; if (!dependencies[i] || deps.some((value, index) => value !== dependencies[i][index])) { dependencies[i] = deps; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, window, URL, Element, fetch: fetchImpl, Error,
    document: { addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: name => documentListeners.delete(name) },
    require(id) {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (id.endsWith('LanguageProvider')) return { useLang: () => ({ t }) };
      if (id.endsWith('hero-draft')) return { takeHeroDraft: () => null };
      if (id.endsWith('footer-visibility')) return { hideUniversalInterviewFooter: () => false };
      return new Proxy({}, { get: (_target, name) => Object.assign(() => null, { displayName: name }) });
    },
  });
  return {
    render() { cursor = 0; const view = exports.UniversalInterview(); while (effects.length) effects.shift()(); return view; },
    storage, listeners, documentListeners, calls, Element,
  };
}

test('transient restore failure retains saved pointer and retry restores the same interview', async () => {
  let calls = 0;
  const h = await harness(async () => ++calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ interview, discovery }) });
  h.render(); await tick();
  let view = h.render();
  assert.equal(h.storage.get(key), 'synthetic');
  assert.equal(nodes(view, n => n.props?.role === 'alert')[0].props.children, 'brainRestoreError');
  button(view, 'brainRestoreRetry').props.onClick(); await tick();
  view = h.render();
  assert.equal(nodes(view, n => n.props?.id === 'brain-answer').length, 1);
  assert.equal(h.storage.get(key), 'synthetic');
});

test('feedback failure shows retry without re-submitting the completed answer', async () => {
  let feedbackCalls = 0;
  const urls = [];
  const h = await harness(async url => {
    urls.push(url);
    if (url.endsWith('/feedback')) return ++feedbackCalls === 1
      ? { ok: false, json: async () => ({}) }
      : { ok: true, json: async () => feedback };
    return { ok: true, json: async () => ({ interview: { ...interview, stage: 'complete' }, discovery }) };
  });
  h.render(); await tick();
  let view = h.render();
  button(view, 'brainFeedbackRetry').props.onClick(); await tick();
  view = h.render();
  assert.equal(nodes(view, n => n.props?.id === 'brain-feedback-heading').length, 1);
  assert.equal(nodes(view, n => n.type === 'label' && n.props.htmlFor === 'brain-retry-answer').length, 1);
  assert.equal(urls.some(url => url.endsWith('/turn')), false);
});

test('refresh, Back and same-tab links warn while an unsent answer stays in memory', async () => {
  const h = await harness(async () => ({ ok: true, json: async () => ({ interview, discovery }) }));
  h.render(); await tick();
  let view = h.render();
  nodes(view, n => n.props?.id === 'brain-answer')[0].props.onChange({ target: { value: 'Keep this synthetic answer' } });
  view = h.render();
  let prevented = 0;
  h.listeners.get('beforeunload')({ preventDefault() { prevented++; } });
  h.listeners.get('popstate')();
  h.documentListeners.get('click')({ button: 0, target: new h.Element({ href: '/', hasAttribute: () => false }), preventDefault() { prevented++; }, stopPropagation() {} });
  assert.equal(prevented, 2);
  assert.equal(h.calls.back, 0);
  assert.equal(h.calls.confirm, 2);
  assert.equal(nodes(h.render(), n => n.props?.id === 'brain-answer')[0].props.value, 'Keep this synthetic answer');
  assert.deepEqual([...h.storage.entries()], [[key, 'synthetic']]);
});

test('setup displays the data notice before the build action', async () => {
  const h = await harness(async () => { throw Error('unexpected fetch'); }, null);
  h.render(); await tick();
  const view = h.render();
  const elements = nodes(view, n => n.props?.children === 'brainDataNotice' || n.type === 'button' && n.props.children === 'brainBuildBlueprint');
  assert.equal(elements[0].props.children, 'brainDataNotice');
  assert.equal(elements[1].props.children, 'brainBuildBlueprint');
});
