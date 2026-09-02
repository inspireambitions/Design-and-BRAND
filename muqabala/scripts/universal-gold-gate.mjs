import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateGoldSet } from '../lib/universal-interview/evaluation.ts';

export async function readJsonLines(directory) {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.jsonl')).sort();
  const cases = [];
  for (const file of files) {
    const content = await readFile(path.join(directory, file), 'utf8');
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      try {
        cases.push(JSON.parse(line));
      } catch {
        throw new Error(`${file}:${index + 1} is not valid JSON.`);
      }
    }
  }
  return cases;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'))) {
  const directory = path.resolve(process.argv[2] || 'evaluation/universal/gold');
  const cases = await readJsonLines(directory);
  const gate = validateGoldSet(cases);
  console.log(JSON.stringify({ turns: cases.length, agreement: gate.agreement, errors: gate.errors }, null, 2));
  if (!gate.ok) process.exitCode = 1;
}
