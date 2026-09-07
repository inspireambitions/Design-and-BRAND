import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));

async function harness(file, exportName, actions = {}) {
  const source = await readFile(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const states = []; let cursor = 0; const pushes = []; const refreshes = [];
  const component = name => Object.assign(() => null, { displayName: name });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { return this.useState({ current: initial })[0]; },
    useEffect() {},
  };
  // Destructured hooks must retain access to the hook store.
  react.useRef = initial => react.useState({ current: initial })[0];
  const fallback = new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : component(String(key)) });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, setTimeout: () => 1, clearTimeout() {}, Date,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (id === 'next/navigation') return { useRouter: () => ({ push: value => pushes.push(value), refresh: () => refreshes.push(true) }) };
      if (id.endsWith('/actions')) return actions;
      if (id.endsWith('LanguageProvider')) return { useLang: () => ({ t: key => key, lang: 'en' }) };
      if (id.endsWith('employer-dashboard')) return require('../lib/employer-dashboard.ts');
      if (id.endsWith('/analytics')) return { track() {}, employerVolumeProps() { return {}; } };
      if (id.endsWith('.css')) return { default: new Proxy({}, { get: (_target, key) => String(key) }) };
      return fallback;
    },
  });
  return { render(props) { cursor = 0; return exports[exportName](props); }, pushes, refreshes };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const reviewProps = {
  interviewId: 'candidate-test', roleId: 'role-test', displayName: 'Synthetic candidate', roleTitle: 'Synthetic role', workplace: 'Test', submittedAt: '2026-09-05T10:00:00Z',
  coverage: { items: [{ id: 'test', label: 'Test evidence', covered: false, status: 'unavailable' }] }, answers: [], position: 1, total: 2, nextId: 'next-test', latestDecision: null, shares: [],
};

test('review retains deletion and explicit Next without capturing touch gestures', async () => {
  const h = await harness('CandidateReview', 'CandidateReview');
  const view = h.render(reviewProps);
  assert.equal(view.props.onTouchStart, undefined);
  assert.equal(view.props.onTouchEnd, undefined);
  assert.equal(nodes(view, n => n.type?.displayName === 'EmployerDeleteInterview').length, 1);
  const next = nodes(view, n => n.type === 'button' && n.props.children === 'Next')[0];
  next.props.onClick();
  assert.deepEqual(h.pushes, ['/employer/interviews/next-test']);
  assert.equal(nodes(view, n => n.type === 'small' && n.props.children === 'employerAnalysisUnavailable').length, 1);
});

test('rejected decision restores review buttons and preserves the note', async () => {
  const h = await harness('CandidateReview', 'CandidateReview', { recordDecision: async () => { throw Error('network'); } });
  let view = h.render(reviewProps);
  nodes(view, n => n.type === 'input')[0].props.onChange({ target: { value: 'Keep this note' } });
  view = h.render(reviewProps);
  nodes(view, n => n.type === 'button' && n.props.children === 'Shortlist')[0].props.onClick();
  await tick(); view = h.render(reviewProps);
  assert.equal(nodes(view, n => n.type === 'button' && n.props.children === 'Shortlist')[0].props.disabled, false);
  assert.equal(nodes(view, n => n.type === 'input')[0].props.value, 'Keep this note');
  assert.equal(nodes(view, n => n.props?.role === 'alert')[0].props.children, 'employerActionInterrupted');
  assert.equal(h.refreshes.length, 1);
});

test('video signing failure and media failure both allow a fresh playback request', async () => {
  let calls = 0;
  const h = await harness('EmployerReportVideo', 'EmployerReportVideo', { signEmployerVideo: async () => { calls++; if (calls === 1) throw Error('network'); return { url: `https://example.test/video-${calls}` }; } });
  const props = { interviewId: 'test', questionIndex: 0, label: 'test', durationSeconds: 10 };
  let view = h.render(props);
  nodes(view, n => n.type === 'button')[0].props.onClick(); await tick();
  view = h.render(props);
  assert.equal(nodes(view, n => n.type === 'button')[0].props.disabled, false);
  nodes(view, n => n.type === 'button')[0].props.onClick(); await tick();
  view = h.render(props); assert.equal(view.type, 'video');
  view.props.onError(); view = h.render(props);
  nodes(view, n => n.type === 'button')[0].props.onClick(); await tick();
  view = h.render(props); assert.equal(view.props.src, 'https://example.test/video-3');
});

test('rejected dashboard decision exits saving state and Hold remains visible', async () => {
  const h = await harness('DashboardDecisionActions', 'DashboardDecisionActions', { recordDecision: async () => { throw Error('network'); } });
  const props = { interviewId: 'test', candidateLabel: 'test', currentDecision: 'later' };
  let view = h.render(props);
  assert.equal(nodes(view, n => n.props?.role === 'status')[0].props.children, 'Hold');
  nodes(view, n => n.type === 'button')[0].props.onClick(); await tick();
  view = h.render(props);
  assert.equal(nodes(view, n => n.type === 'button')[0].props.disabled, false);
  assert.equal(nodes(view, n => n.props?.role === 'alert')[0].props.children, 'employerActionInterrupted');
});
