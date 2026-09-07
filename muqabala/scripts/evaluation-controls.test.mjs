import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

const source = await readFile(new URL('../components/EvaluationControls.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(actions = {}, extraProps = {}) {
  const state = [];
  let cursor = 0;
  const exports = {};
  const require = (id) => {
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === 'react') return { useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial; return [state[slot], (value) => { state[slot] = value; }]; } };
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (id === '@phosphor-icons/react') return {};
    if (id.endsWith('.css')) return { default: {} };
    if (id.endsWith('evaluation-actions')) return actions;
    throw new Error(`Unexpected import ${id}`);
  };
  new Function('require', 'exports', compiled)(require, exports);
  function render() { cursor = 0; return exports.EvaluationControls({ interviewId: 'synthetic', decisionRecorded: true, interviewerName: 'Original name', shares: [], ...extraProps }); }
  function all(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => all(child, predicate));
    return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
  }
  function content(node) { if (Array.isArray(node)) return node.map(content).join(''); if (node && typeof node === 'object') return content(node.props?.children); return node ?? ''; }
  return { render, find: (predicate) => all(render(), predicate)[0], button: (label) => all(render(), (node) => node.type === 'button' && content(node) === label)[0] };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('saved interviewer names can be edited again and cancel restores the last save', async () => {
  const saves = [];
  const ui = harness({ updateEvaluationInterviewer: async (input) => { saves.push(input); return { ok: true }; } });
  ui.button('Edit name').props.onClick();
  ui.find((node) => node.type === 'input').props.onChange({ target: { value: 'Correct name' } });
  ui.button('Save changes').props.onClick();
  await settle();
  assert.equal(saves[0].interviewerName, 'Correct name');
  assert.ok(ui.button('Edit name'));
  ui.button('Edit name').props.onClick();
  ui.find((node) => node.type === 'input').props.onChange({ target: { value: 'Unsaved mistake' } });
  ui.button('Cancel').props.onClick();
  assert.equal(ui.find((node) => node.type === 'input').props.value, 'Correct name');
});

test('a rejected note action preserves text and releases the busy controls', async () => {
  const ui = harness({ addEvaluationNote: async () => { throw new Error('offline'); } });
  ui.find((node) => node.type === 'textarea').props.onChange({ target: { value: 'Keep this draft' } });
  ui.button('Add note').props.onClick();
  await settle();
  assert.equal(ui.find((node) => node.type === 'textarea').props.value, 'Keep this draft');
  assert.equal(ui.button('Add note').props.disabled, false);
  assert.ok(ui.find((node) => node.props?.role === 'status'));
});

test('correction references the original and cannot submit an empty correction template', async () => {
  const added = [];
  const original = { text: 'Original factual note', created_at: '2026-09-07T12:00:00Z' };
  const ui = harness({ addEvaluationNote: async (input) => { added.push(input.text); return { ok: true }; } }, { notes: [original] });
  ui.find((node) => node.type === 'select' && node.props.value === '').props.onChange({ target: { value: '0' } });
  const prefix = ui.find((node) => node.type === 'textarea').props.value;
  assert.match(prefix, /Original factual note/);
  assert.match(prefix, /2026-09-07T12:00:00Z/);
  assert.equal(ui.button('Add correction').props.disabled, true);
  ui.find((node) => node.type === 'textarea').props.onChange({ target: { value: `${prefix}Corrected information here.` } });
  ui.button('Add correction').props.onClick();
  await settle();
  assert.equal(added.length, 1);
  assert.equal(original.text, 'Original factual note');
  assert.equal(ui.find((node) => node.type === 'textarea').props.value, '');
});
