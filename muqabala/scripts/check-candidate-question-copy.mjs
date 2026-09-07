import fs from 'node:fs';

const candidateFacingFiles = [
  'components/UniversalInterview.tsx',
  'components/EmployerVideoInterview.tsx',
  'lib/universal-interview/blueprint.ts',
  'lib/universal-interview/questions.ts',
  'lib/universal-interview/api.ts',
  'lib/universal-interview/employer.ts',
];
const forbidden = [
  'What specific example shows',
  'the candidate',
  'Ask for',
];
const failures = [];

for (const file of candidateFacingFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const phrase of forbidden) {
    if (source.includes(phrase)) failures.push(`${file}: ${phrase}`);
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Candidate question copy grep passed across ${candidateFacingFiles.length} files.\n`);
}
