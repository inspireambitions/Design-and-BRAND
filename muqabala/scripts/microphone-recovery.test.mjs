import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const tick = () => new Promise(resolve => setImmediate(resolve));
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const button = (view, label) => nodes(view, n => n.type === 'button' && n.props.children === label)[0];
async function component(name, mocks, globals = {}) {
  const source = await readFile(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const states = [], dependencies = [], effects = [], cleanups = [];
  let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => react.useState({ current: initial })[0],
    useCallback: fn => fn,
    useEffect(fn, deps) { const i = cursor++; if (!dependencies[i] || deps.some((v, j) => v !== dependencies[i][j])) { dependencies[i] = deps; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Blob, URL, Error, console, setTimeout, clearTimeout, ...globals,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      const key = Object.keys(mocks).find(k => id.endsWith(k));
      if (key) return mocks[key];
      return new Proxy({}, { get: (_target, field) => Object.assign(() => null, { displayName: field }) });
    },
  });
  return {
    render(props) { cursor = 0; const view = exports[name](props); while (effects.length) effects.shift()(); return view; },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}

test('microphone confirmation requires playback and is invalidated when the device changes', async () => {
  const timers = new Map(), events = new Map(), confirmed = [];
  let discarded = false;
  const Playback = () => null;
  const h = await component('MicrophoneCheck', {
    'audio-capture': { startAudioCaptureFromStream: () => ({ stop: async () => new Blob(['audio']), discard: () => { discarded = true; } }) },
    '/media': { startLevelMeter: () => null },
    'RecordingPlayback': { RecordingPlayback: Playback },
  }, {
    setTimeout: (fn, ms) => { timers.set(ms, fn); return ms; }, clearTimeout: id => timers.delete(id),
    navigator: { mediaDevices: { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) } },
  });
  const props = { stream: { getAudioTracks: () => [{ label: 'Test microphone', addEventListener() {}, removeEventListener() {} }] }, lang: 'en', onConfirm: v => confirmed.push(v) };
  let view = h.render(props);
  button(view, 'Record a five-second test').props.onClick();
  view = h.render(props);
  assert.equal(button(view, 'Recording test. Say a short sentence…').props.disabled, true);
  await timers.get(5000)(); view = h.render(props);
  assert.equal(nodes(view, n => n.type === 'input')[0].props.disabled, true);
  nodes(view, n => n.type === Playback)[0].props.onPlayed(); view = h.render(props);
  const checkbox = nodes(view, n => n.type === 'input')[0];
  assert.equal(checkbox.props.disabled, false);
  checkbox.props.onChange({ target: { checked: true } });
  assert.equal(confirmed.at(-1), true);
  events.get('devicechange')(); view = h.render(props);
  assert.equal(confirmed.at(-1), false);
  assert.equal(nodes(view, n => n.type === 'input')[0].props.checked, false);
  button(view, 'Record another test').props.onClick(); h.unmount();
  assert.equal(discarded, true);
});

test('a restored answer retries transcription before upload and keeps it on failure', async () => {
  const calls = [], drafts = [], listeners = new Map();
  let transcriptions = 0, release;
  const audio = new Blob(['retained audio']);
  const draft = { questionIndex: 0, blob: new Blob(['video']), mimeType: 'video/webm', durationSeconds: 5,
    transcript: '', transcriptionAudio: audio, needsTranscription: true };
  const brain = { stage: 'questions', current_question: { question_id: 'q1', candidate_text: 'Question', question_number: 1, total_questions: 2 } };
  let received = false;
  const status = () => ({ currentQuestion: received ? 1 : 0, answers: received ? [{ questionIndex: 0, receivedAt: 'now' }] : [], brain });
  const copy = { recoveredRecording: 'We recovered a response that had not finished uploading. We will continue from it.' };
  const h = await component('EmployerVideoInterview', {
    'LanguageProvider': { useLang: () => ({ lang: 'en', setLang() {}, dir: 'ltr', t: () => '' }) },
    'screening-draft-store': {
      getScreeningRecordingDrafts: async () => [draft],
      saveScreeningRecordingDraft: async (...args) => { drafts.push(args); calls.push('draft'); },
      deleteScreeningRecordingDraft: async () => calls.push('delete'),
    },
    'screening-transcription': { resolveScreeningTranscript: async captured => {
      assert.equal(captured, audio); calls.push('transcribe'); transcriptions++;
      if (transcriptions === 1) return { ok: false, reason: 'service' };
      await new Promise(resolve => { release = resolve; });
      return { ok: true, value: { transcript: 'I called my manager and resolved the problem', transcriptSegments: [], transcriptTimingVersion: null } };
    } },
    'screening-video-upload': { uploadScreeningVideo: async () => calls.push('upload') },
  }, {
    navigator: { onLine: true },
    window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key), confirm: () => false },
    fetch: async (url) => {
      if (url.endsWith('/resume')) return { ok: true, json: async () => ({ resume: { id: 'test', candidateName: 'Test' } }) };
      if (url.endsWith('/status')) return { ok: true, json: async () => status() };
      if (url.endsWith('/upload-url')) return { ok: true, json: async () => ({ path: 'test', signedUrl: 'test' }) };
      if (url.endsWith('/answers')) { received = true; return { ok: true, json: async () => ({}) }; }
      if (url.endsWith('/brain')) return { ok: true, json: async () => ({ brain, nextTurnIndex: 1 }) };
      throw new Error(url);
    },
  });
  const props = { role: { questions: [{ id: 'q1' }], title: 'Test' }, publicCode: 'test', candidateEmail: 'test@example.test' };
  h.render(props); await tick(); h.render(props); await tick();
  let view = h.render(props);
  assert.equal(transcriptions, 1);
  assert.ok(calls.indexOf('draft') < calls.indexOf('transcribe'));
  assert.equal(calls.includes('upload'), false);
  assert.equal(calls.includes('delete'), false);
  assert.equal(drafts[0][6].transcriptionAudio, audio);
  const retry = button(view, 'Retry transcription'); assert.ok(retry);
  retry.props.onClick(); await tick();
  retry.props.onClick(); listeners.get('online')?.(); await tick();
  assert.equal(transcriptions, 2, 'overlapping retries must share one attempt');
  release(); await tick(); await tick(); view = h.render(props);
  assert.equal(calls.filter(x => x === 'upload').length, 1);
  assert.equal(calls.at(-1), 'delete');
  assert.equal(button(view, 'Start recording') !== undefined, true);
  h.unmount();
});
