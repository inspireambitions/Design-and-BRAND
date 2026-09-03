import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import './test-hooks/register.mjs';

const output = resolve(process.argv[2] || 'tmp/pdfs/evaluation-sample.pdf');
const workspace = resolve('.');
if (!output.startsWith(`${workspace}\\`) && output !== workspace) throw new Error('Output must stay inside the workspace.');

const { buildEvaluationPdf } = await import('../lib/evaluation-report-pdf.ts');
const { sampleEvaluationReport } = await import('../lib/fixtures/evaluation-report.ts');
const pdf = buildEvaluationPdf(sampleEvaluationReport);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(await pdf.arrayBuffer()));
console.log(output);
