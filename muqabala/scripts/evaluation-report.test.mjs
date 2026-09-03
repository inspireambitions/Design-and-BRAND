import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import './test-hooks/register.mjs';
import {
  CandidateEvaluationReportSchema,
  bandFromEvidence,
  formatPlaybackTime,
  quotedEvidenceFallback,
  validateEvidenceLine,
} from '../lib/evaluation-report.ts';

const {
  evidenceModelInput,
  generateEvidenceLines,
  generateFollowupQuestion,
} = await import('../lib/server/evaluation-report-language.ts');
const { evaluationPdfLines, buildEvaluationPdf, evaluationPdfFilename } = await import('../lib/evaluation-report-pdf.ts');
const { sampleEvaluationReport } = await import('../lib/fixtures/evaluation-report.ts');
const [generatorSource, pdfRouteSource, shareRouteSource, actionSource, pageSource, playbackSource, migrationSource, marketingSource, reportViewSource, interviewerMigrationSource] = await Promise.all([
  readFile(new URL('../lib/server/evaluation-report.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/employer/candidates/[id]/evaluation/pdf/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/evaluation-share/[token]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/employer/evaluation-actions.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/employer/candidates/[id]/evaluation/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/EvidencePlayback.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260903181735_candidate_evaluation_reports.sql', import.meta.url), 'utf8'),
  readFile(new URL('../components/EmployerProofCreate.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/EvaluationReportView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260903191312_add_manual_evaluation_interviewer.sql', import.meta.url), 'utf8'),
]);

const record = {
  id: '11111111-1111-4111-8111-111111111111',
  competency_id: 'c_guest_service',
  transcript_span: 'I cleaned 14 rooms and used the hotel checklist before the supervisor checked my work.',
  question_index: 1,
  start_ms: 94_000,
  end_ms: 101_000,
  recording_duration_seconds: 120,
  evidence_strength: 'STRONG',
  criterion_results: { action: 'STRONG' },
};

test('rubric mapping is deterministic and never guesses an unknown value upward', () => {
  assert.equal(bandFromEvidence([]), 'EVIDENCE_NOT_FOUND');
  assert.equal(bandFromEvidence([{ criterion_results: { action: 'WEAK' } }]), 'PARTIAL');
  assert.equal(bandFromEvidence([{ criterion_results: { action: 'PRESENT' } }]), 'EVIDENCE_FOUND');
  assert.equal(bandFromEvidence([{ evidence_strength: 'MEDIUM', criterion_results: { action: 'STRONG' } }]), 'PARTIAL');
  assert.equal(bandFromEvidence([{ evidence_strength: 'STRONG', criterion_results: { action: 'MISSING' } }]), 'EVIDENCE_FOUND');
  const logged = [];
  assert.equal(bandFromEvidence([{ criterion_results: { action: 'UNKNOWN' } }], (value) => logged.push(value)), 'EVIDENCE_NOT_FOUND');
  assert.deepEqual(logged, ['UNKNOWN']);
});

test('evidence validator accepts a grounded line and formats its playback point', () => {
  const result = validateEvidenceLine({
    evidence_id: record.id,
    text: 'Cleaned 14 rooms and used the hotel checklist before a supervisor checked the work.',
  }, [record], 220);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.question_number, 2);
    assert.equal(result.line.timestamp_seconds, 94);
    assert.equal(formatPlaybackTime(result.line.timestamp_seconds), '01:34');
  }
});

const rejectionCases = [
  ['CITATION_MISSING', { text: 'Used the hotel checklist.' }, 220],
  ['CITATION_UNKNOWN', { evidence_id: '22222222-2222-4222-8222-222222222222', text: 'Used the hotel checklist.' }, 220],
  ['TIMESTAMP_INVALID', { evidence_id: record.id, text: 'Used the hotel checklist.' }, 50],
  ['TOO_LONG', { evidence_id: record.id, text: Array.from({ length: 26 }, () => 'work').join(' ') }, 220],
  ['FORBIDDEN_WORD', { evidence_id: record.id, text: 'The candidate seemed nervous.' }, 220],
  ['UNGROUNDED_NUMBER', { evidence_id: record.id, text: 'Cleaned 20 rooms.' }, 220],
  ['UNGROUNDED_TERM', { evidence_id: record.id, text: 'Used Ecolab products.' }, 220],
  ['EMPTY', { evidence_id: record.id, text: '' }, 220],
];

for (const [reason, proposal, duration] of rejectionCases) {
  test(`evidence validator rejects ${reason}`, () => {
    const result = validateEvidenceLine(proposal, [record], duration);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reasons.includes(reason));
  });
}

function report(overrides = {}) {
  return {
    report_id: 'EVAL-2026-ABCDEF12',
    report_format_version: '1.0',
    report_version: 1,
    rubric_version: 'universal-brain-v2.0.1',
    interview_id: '22222222-2222-4222-8222-222222222222',
    candidate_id: '33333333-3333-4333-8333-333333333333',
    candidate_name: 'Amina Okello',
    role_id: 'housekeeping-attendant',
    role_title: 'Housekeeping Attendant',
    workplace: 'Al Reef Beach Resort',
    employer_id: '44444444-4444-4444-8444-444444444444',
    interviewer_of_record: '',
    interview_datetime: '2026-08-28T10:10:00.000Z',
    duration_seconds: 1260,
    question_count: 8,
    seniority_band: 'Entry',
    competencies: [{
      competency_id: 'c_guest_service',
      name: 'Guest service',
      rubric_order: 1,
      band: 'PARTIAL',
      evidence_lines: [quotedEvidenceFallback(record)],
      followup_question: 'What did you do when a guest asked for help?',
    }],
    employer_notes: [],
    decision: null,
    generated_at: '2026-09-03T12:00:00.000Z',
    generated_by_pipeline_version: 'candidate-evaluation-v1',
    ...overrides,
  };
}

test('report schema enforces evidence and competency limits and rejects rating fields', () => {
  assert.equal(CandidateEvaluationReportSchema.safeParse(report()).success, true);
  const one = report().competencies[0];
  assert.equal(CandidateEvaluationReportSchema.safeParse(report({
    competencies: [{ ...one, evidence_lines: Array.from({ length: 4 }, () => one.evidence_lines[0]) }],
  })).success, false);
  assert.equal(CandidateEvaluationReportSchema.safeParse(report({
    competencies: [{ ...one, evidence_lines: [{ ...one.evidence_lines[0], text: Array.from({ length: 26 }, () => 'word').join(' ') }] }],
  })).success, false);
  assert.equal(CandidateEvaluationReportSchema.safeParse(report({
    competencies: Array.from({ length: 9 }, (_, index) => ({ ...one, competency_id: `c_comp_${index}`, rubric_order: Math.min(index + 1, 8) })),
  })).success, false);
  assert.equal(CandidateEvaluationReportSchema.safeParse(report({ rating: 8 })).success, false);
  assert.equal(CandidateEvaluationReportSchema.safeParse(report({
    competencies: [{ ...one, band: 'EVIDENCE_FOUND', followup_question: 'What did you do next?' }],
  })).success, false);
});

test('full report renderer contains no prohibited assessment wording or numeric measure pattern', () => {
  const rendered = evaluationPdfLines(sampleEvaluationReport).map((line) => line.text).join('\n');
  assert.doesNotMatch(rendered, /\b(?:strengths?|weakness(?:es)?|concerns?|red flags?|risks?|fit|personality|attitude|confident|nervous|articulate|fluent|accent|native|age|nationality|gender|religion|appearance|recommend\w*|hire\w*|reject\w*|scores?|ratings?)\b|%|\/10|\bout of\b/iu);
});

test('maximum fixture produces exactly one A4 PDF page', async () => {
  let nextId = 100;
  const maximum = CandidateEvaluationReportSchema.parse({
    ...sampleEvaluationReport,
    competencies: sampleEvaluationReport.competencies.map((competency) => ({
      ...competency,
      band: 'EVIDENCE_FOUND',
      followup_question: null,
      evidence_lines: Array.from({ length: 3 }, (_, index) => ({
        evidence_id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
        text: `Described completing the room checklist and telling the supervisor when task ${index + 1} was ready.`,
        question_number: competency.rubric_order,
        timestamp_seconds: 20 + index * 10,
        transcript_span: `Described completing the room checklist and telling the supervisor when task ${index + 1} was ready.`,
      })),
    })),
  });
  const bytes = Buffer.from(await buildEvaluationPdf(maximum).arrayBuffer()).toString('latin1');
  assert.match(bytes, /\/Type \/Pages[\s\S]*\/Count 1\b/);
  assert.doesNotMatch(bytes, /\/Count 2\b/);
});

test('report generation fails closed until the complete timed rubric state exists', () => {
  assert.match(generatorSource, /state\.status !== 'COMPLETE'/);
  assert.match(generatorSource, /processed_answer_count !== answers\.length/);
  assert.match(generatorSource, /openai-whisper-segment-v1/);
  assert.match(pageSource, /Evaluation not yet available/);
  assert.match(pageSource, /if \(!current\) \{[\s\S]{0,100}return[\s\S]{0,500}No incomplete report is shown/);
});

test('PDF and sharing are decision-gated and closed links return 410', () => {
  assert.match(pdfRouteSource, /if \(!current\.report\.decision\)[\s\S]*status: 403/);
  assert.match(actionSource, /if \(!current\.report\.decision\).*Record a decision before sharing/);
  assert.match(actionSource, /max\(30\)/);
  assert.match(shareRouteSource, /state\.status === 'closed'[\s\S]*status: 410/);
  assert.match(shareRouteSource, /sealPrivateText\(normalisedEmail\)/);
  assert.match(shareRouteSource, /action: 'VIEW'/);
});

test('timestamp tickets seek to the stored position and use the matching question recording', () => {
  assert.match(playbackSource, /signEmployerVideo\(interviewId, questionNumber - 1\)/);
  assert.match(playbackSource, /currentTime = timestampSeconds/);
  for (const competency of sampleEvaluationReport.competencies) {
    for (const line of competency.evidence_lines) assert.ok(line.timestamp_seconds >= 0 && line.timestamp_seconds <= 128);
  }
});

test('version storage is transactional and older versions remain readable', () => {
  assert.match(migrationSource, /for update/);
  assert.match(migrationSource, /set superseded_at = now\(\)/);
  assert.match(migrationSource, /insert into public\.candidate_evaluation_reports/);
  assert.match(generatorSource, /options: \{ force\?: boolean; generatedBy\?: string \}/);
  assert.match(pageSource, /loadOwnedEvaluationReportVersion/);
});

test('report tables are private and notes have no browser update path', () => {
  for (const table of ['candidate_evaluation_reports', 'evaluation_report_notes', 'evaluation_report_shares', 'evaluation_report_access_log']) {
    assert.match(migrationSource, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migrationSource, /revoke all on public\.evaluation_report_access_log from public, anon, authenticated/);
  assert.doesNotMatch(actionSource, /from\('evaluation_report_notes'\)\.update/);
});

test('workflow labels, sample link and PDF filename follow the report contract', () => {
  assert.match(pageSource, /Record the hiring decision/);
  assert.match(marketingSource, /href="\/for-employers\/sample-report"/);
  assert.equal(evaluationPdfFilename(sampleEvaluationReport), 'Muqabala-Evaluation-Okello-Housekeeping-Attendant-2026-08-28.pdf');
});

test('rubric version remains stored for audit but never appears in a shared report or PDF', () => {
  assert.match(generatorSource, /rubric_version: state\.prompt_version/);
  assert.match(migrationSource, /rubric_version text not null/);
  assert.doesNotMatch(reportViewSource, /Rubric version|report\.rubric_version/);
  const renderedPdf = evaluationPdfLines(sampleEvaluationReport).map((line) => line.text).join('\n');
  assert.doesNotMatch(renderedPdf, /Rubric:|universal-brain-v/i);
});

test('interviewer name is optional, manually saved and owner scoped', () => {
  assert.equal(CandidateEvaluationReportSchema.safeParse(report({ interviewer_of_record: '' })).success, true);
  assert.match(actionSource, /updateEvaluationInterviewer/);
  assert.match(actionSource, /interviewer_name: interviewerName \|\| null/);
  assert.match(actionSource, /\.eq\('employer_id', user\.id\)/);
  assert.match(interviewerMigrationSource, /interviewer_name text/);
  assert.match(reportViewSource, /report\.interviewer_of_record &&/);
});

test('a manually entered interviewer appears in the PDF without exposing rubric metadata', () => {
  const renderedPdf = evaluationPdfLines(report({ interviewer_of_record: 'Samira Khan' })).map((line) => line.text).join('\n');
  assert.match(renderedPdf, /Interviewed by: Samira Khan/);
  assert.doesNotMatch(renderedPdf, /Rubric:|universal-brain-v/i);
});

test('quoted fallback keeps the citation and never exceeds 25 transcript words', () => {
  const fallback = quotedEvidenceFallback({ ...record, transcript_span: Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ') });
  assert.equal(fallback.evidence_id, record.id);
  assert.equal(fallback.text.replace(/[“”…]/g, '').trim().split(/\s+/).length, 25);
});

test('quoted fallback redacts forbidden judgement terms from candidate wording', () => {
  const fallback = quotedEvidenceFallback({ ...record, transcript_span: 'I was nervous but completed the room checklist.' });
  assert.doesNotMatch(fallback.text, /nervous/i);
  assert.match(fallback.text, /\[omitted\]/);
});

test('model input contains only the competency name and stored evidence records', () => {
  const input = evidenceModelInput('Guest service', [record]);
  assert.deepEqual(Object.keys(input).sort(), ['competency_name', 'evidence_records']);
  assert.deepEqual(Object.keys(input.evidence_records[0]).sort(), [
    'evidence_id', 'question_number', 'timestamp_seconds', 'transcript_span',
  ]);
});

const hallucinationCases = [
  ['unknown citation', [{ evidence_id: '22222222-2222-4222-8222-222222222222', text: 'Used the hotel checklist.' }]],
  ['invented number', [{ evidence_id: record.id, text: 'Cleaned 20 rooms.' }]],
  ['invented product', [{ evidence_id: record.id, text: 'Used Ecolab products.' }]],
  ['judgement', [{ evidence_id: record.id, text: 'The candidate seemed nervous.' }]],
];

for (const [label, proposals] of hallucinationCases) {
  test(`double model failure falls back to a cited transcript for ${label}`, async () => {
    let calls = 0;
    const result = await generateEvidenceLines('Guest service', [record], async () => {
      calls += 1;
      return proposals;
    });
    assert.equal(calls, 2);
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0].evidence_id, record.id);
    assert.match(result.lines[0].text, /^“/);
    assert.ok(result.rejected.length > 0);
  });
}

test('a merged or missing model record cannot remove either citation', async () => {
  const second = {
    ...record,
    id: '22222222-2222-4222-8222-222222222222',
    transcript_span: 'I called housekeeping and gave the guest an update.',
    question_index: 2,
    start_ms: 20_000,
    end_ms: 25_000,
  };
  const result = await generateEvidenceLines('Guest service', [record, second], async () => [{
    evidence_id: record.id,
    text: 'Used the checklist and called housekeeping before updating the guest.',
  }]);
  assert.deepEqual(result.lines.map((line) => line.evidence_id), [record.id, second.id]);
  assert.ok(result.lines.every((line) => line.text.startsWith('“')));
});

test('a valid model line is stored unchanged', async () => {
  const text = 'Cleaned 14 rooms and used the hotel checklist before a supervisor checked the work.';
  const result = await generateEvidenceLines('Guest service', [record], async () => [{ evidence_id: record.id, text }]);
  assert.deepEqual(result.lines.map((line) => line.text), [text]);
  assert.deepEqual(result.rejected, []);
});

test('a model outage still returns one cited transcript line per record', async () => {
  const result = await generateEvidenceLines('Guest service', [record], async () => { throw new Error('offline'); });
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].evidence_id, record.id);
  assert.match(result.lines[0].text, /^“/);
});

test('follow-up generation uses the existing candidate question validator and omits repeated failures', async () => {
  const valid = await generateFollowupQuestion(
    'Guest service',
    [quotedEvidenceFallback(record)],
    'ENTRY',
    async () => 'What did you do when the guest asked for help?',
  );
  assert.equal(valid, 'What did you do when the guest asked for help?');
  let calls = 0;
  const invalid = await generateFollowupQuestion('Guest service', [], 'ENTRY', async () => {
    calls += 1;
    return 'Ask why the candidate was a good fit';
  });
  assert.equal(invalid, null);
  assert.equal(calls, 2);
});
