import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import './test-hooks/register.mjs';

const argumentsList = process.argv.slice(2);
const arabic = argumentsList.includes('--arabic');
const outputArgument = argumentsList.find((value) => !value.startsWith('--'));
const output = resolve(outputArgument || `tmp/pdfs/evaluation-sample${arabic ? '-arabic' : ''}.pdf`);
const workspace = resolve('.');
if (!output.startsWith(`${workspace}\\`) && output !== workspace) throw new Error('Output must stay inside the workspace.');

const { buildEvaluationPdf } = await import('../lib/evaluation-report-pdf.ts');
const { CandidateEvaluationReportSchema } = await import('../lib/evaluation-report.ts');
const { sampleEvaluationReport } = await import('../lib/fixtures/evaluation-report.ts');
const report = arabic ? CandidateEvaluationReportSchema.parse({
  ...sampleEvaluationReport,
  candidate_name: 'أمينة أوكيلو',
  role_title: 'مشرفة التدبير الفندقي',
  workplace: 'فندق النور',
  competencies: sampleEvaluationReport.competencies.map((competency, index) => index === 0 ? {
    ...competency,
    name: 'خدمة الضيوف',
    evidence_lines: competency.evidence_lines.map((line) => ({
      ...line,
      text: 'شرحت كيف رحبت بالضيف وتأكدت من الطلب ثم أبلغت المشرف قبل تسليم المستلزمات.',
      transcript_span: 'شرحت كيف رحبت بالضيف وتأكدت من الطلب ثم أبلغت المشرف قبل تسليم المستلزمات.',
    })),
  } : competency),
  employer_notes: [{
    ...sampleEvaluationReport.employer_notes[0],
    author_name: 'ريم حداد',
    text: 'مراجعة مثال خدمة الضيوف مع مدير العمليات.',
  }],
  decision: {
    ...sampleEvaluationReport.decision,
    outcome: 'NOT_PROCEEDING',
    decided_by_name: 'ريم حداد',
  },
}) : sampleEvaluationReport;
const pdf = await buildEvaluationPdf(report);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(await pdf.arrayBuffer()));
console.log(output);
