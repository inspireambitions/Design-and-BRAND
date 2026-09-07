import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'out', 'evaluation-controls-fixture');
await mkdir(output, { recursive: true });
const entry = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EvaluationControls } from './components/EvaluationControls';

function Fixture() {
  const [name, setName] = useState('Synthetic reviewer');
  const [version, setVersion] = useState(2);
  const [fail, setFail] = useState(false);
  const [notes, setNotes] = useState([{ text: 'Synthetic first note: the candidate has two years of experience.', created_at: '2026-09-07T12:00:00Z' }]);
  const [shares, setShares] = useState([{ id: 'synthetic-older-share', version: 1, expiresAt: '2099-01-01T00:00:00Z', revokedAt: null }]);
  const [events, setEvents] = useState([]);
  const run = async (action, input, mutate) => {
    setEvents((items) => [...items, { action, input, rejected: fail }]);
    if (fail) throw new Error('Synthetic network rejection');
    return mutate();
  };
  window.__fixtureActions = {
    updateEvaluationInterviewer: (input) => run('updateEvaluationInterviewer', input, () => { setName(input.interviewerName); return { ok: true }; }),
    addEvaluationNote: (input) => run('addEvaluationNote', input, () => { setNotes((items) => [...items, { text: input.text, created_at: new Date().toISOString() }]); return { ok: true }; }),
    createEvaluationShare: (input) => run('createEvaluationShare', input, () => { const id = 'synthetic-' + Date.now(); const expiresAt = '2099-01-01T00:00:00Z'; setShares((items) => [...items, { id, version, expiresAt, revokedAt: null }]); return { id, expiresAt, url: 'https://example.invalid/synthetic-private-link' }; }),
    revokeEvaluationShare: (input) => run('revokeEvaluationShare', input, () => { setShares((items) => items.map((item) => item.id === input.shareId ? { ...item, revokedAt: new Date().toISOString() } : item)); return { ok: true }; }),
    regenerateEvaluationReport: (input) => run('regenerateEvaluationReport', input, () => { setVersion(version + 1); return { version: version + 1 }; }),
  };
  return <main>
    <h1>Evaluation controls: synthetic browser fixture</h1>
    <p>This page uses local fake actions. It does not contact Muqabala or save real records.</p>
    <label><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Reject actions to test recovery</label>
    <p>Current report version: <strong>{version}</strong></p>
    <EvaluationControls key={version} interviewId="synthetic-interview" decisionRecorded interviewerName={name} notes={notes} shares={shares} />
    <section aria-label="Synthetic saved notes"><h2>Saved notes</h2><ol>{notes.map((note, index) => <li key={index}>{note.text}</li>)}</ol></section>
    <details><summary>Recorded synthetic actions</summary><pre id="fixture-events">{JSON.stringify(events, null, 2)}</pre></details>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
`;
await build({
  absWorkingDir: root,
  stdin: { contents: entry, resolveDir: root, sourcefile: 'evaluation-controls-fixture.tsx', loader: 'tsx' },
  outfile: path.join(output, 'fixture.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  loader: { '.module.css': 'local-css' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'synthetic-actions-only',
    setup(build) {
      build.onResolve({ filter: /^(@\/app\/employer\/evaluation-actions|next\/navigation)$/ }, (args) => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
        contents: args.path === 'next/navigation'
          ? 'export function useRouter() { return { refresh() {} }; }'
          : ['addEvaluationNote', 'createEvaluationShare', 'regenerateEvaluationReport', 'revokeEvaluationShare', 'updateEvaluationInterviewer'].map((name) => 'export const ' + name + ' = (input) => window.__fixtureActions.' + name + '(input);').join('\n'),
        loader: 'js',
      }));
    },
  }],
});
await writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic evaluation controls</title><link rel="icon" href="data:,"><link rel="stylesheet" href="fixture.css"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#f8faf9;color:#14241f;font-family:Arial,sans-serif;--font-body:Arial,sans-serif;--font-display:Arial,sans-serif}main{padding:24px;max-width:1200px;margin:auto}h1{font-size:24px}section[aria-label="Synthetic saved notes"]{margin-top:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><div id="root"></div><script type="module" src="fixture.js"></script></body></html>');
console.log('Built synthetic fixture at ' + output);
console.log('Serve this directory on localhost with a static server. No application routes or backend calls are used.');
