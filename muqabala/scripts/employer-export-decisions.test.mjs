import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { exportCsv, exportCandidateSummaryLine } from '../lib/employer-volume/strip.ts';
import { coverageFor } from '../lib/employer-volume/coverage.ts';
import { buildPdf } from '../lib/employer-volume/pdf.ts';

const decisions = [
  ['shortlist', 'Shortlisted'], ['shortlisted', 'Shortlisted'],
  ['pass', 'Not proceeding'], ['not_proceeding', 'Not proceeding'], ['later', 'Hold'],
];

test('CSV decision cells use hiring labels for current and legacy records', () => {
  const csv = exportCsv(decisions.map(([decision]) => ({ name: 'Synthetic candidate', rubric: ['Unknown', false, true], decision })));
  const rows = csv.trim().split('\r\n').slice(1);
  assert.deepEqual(rows.map(row => row.split(',')[13]), decisions.map(([, label]) => label));
  assert.equal(rows[0].split(',')[9], 'Unknown');
});

test('PDF export lines preserve unavailable evidence and human decision wording', async () => {
  const coverage = coverageFor([{ id: 'test', label: 'Test' }], []);
  const lines = decisions.map(([decision]) => ({ text: exportCandidateSummaryLine({ displayName: 'Synthetic candidate', coverage, decision }) }));
  assert.deepEqual(lines.map(line => line.text), decisions.map(([, label]) => `Synthetic candidate   rubric Unknown   ${label}`));
  const pdf = await buildPdf(lines).text();
  assert.match(pdf, /rubric Unknown   Not proceeding/);
  assert.match(pdf, /rubric Unknown   Hold/);
  assert.doesNotMatch(pdf, /rubric Unknown   (?:pass|later|shortlist)\)/);
  const route = await readFile(new URL('../app/api/employer/roles/[roleId]/export/route.ts', import.meta.url), 'utf8');
  assert.match(route, /text: exportCandidateSummaryLine\(candidate\)/);
});
