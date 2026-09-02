import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { evaluateObservedTurns, validateGoldSet } from '../lib/universal-interview/evaluation.ts';
import { readJsonLines } from './universal-gold-gate.mjs';

const goldDirectory = path.resolve(process.argv[2] || 'evaluation/universal/gold');
const resultsFile = path.resolve(process.argv[3] || 'evaluation/universal/results/latest.jsonl');
const gold = await readJsonLines(goldDirectory);
const gate = validateGoldSet(gold);
if (!gate.ok) {
  console.error(gate.errors.join('\n'));
  process.exit(1);
}
const results = (await readFile(resultsFile, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const evaluation = evaluateObservedTurns(gold, results);
console.log(JSON.stringify(evaluation, null, 2));
if (!evaluation.pass) process.exitCode = 1;
