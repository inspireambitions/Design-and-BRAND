import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validateCandidateText } from '../lib/universal-interview/candidate-question.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const projectRoot = path.resolve(import.meta.dirname, '..');
const genericQuestion = 'What relevant work example best demonstrates your experience?';

function result(text) {
  return validateCandidateText(text, { language: 'en', seniority: 'ENTRY' });
}

function repairCandidateText(input) {
  if (result(input).ok) return input;
  let text = input.trim().replaceAll('—', '-');
  text = text.replace(/^(?:Great|Thanks|Thank you|Now|So|Okay|Well)\b[,:.!]?\s*/i, '');
  text = text.replace(/[{}\[\]<>]/g, '').replace(/\b(?:TODO|TBD|XXX)\b/gi, '');

  const sentences = text.split(/(?<=[.!?])\s+/u).filter(Boolean);
  if (sentences.length > 1) {
    text = sentences.find((sentence) => /\b(?:you|your)\b/i.test(sentence)) ?? genericQuestion;
  }

  text = text.replace(/\s+and\s+(?:what|why|how|when|where|which|tell me|describe)\b.*$/i, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/[?.!,;:]+$/u, '').replace(/\?/g, '').trim();
  if (!/\b(?:you|your)\b/i.test(text)) text = genericQuestion.replace(/\?$/, '');
  text = `${text}?`;

  return result(text).ok ? text : genericQuestion;
}

function quoted(text) {
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

const rolesDirectory = path.join(projectRoot, 'lib', 'roles');
const files = fs.readdirSync(rolesDirectory)
  .filter((name) => name.endsWith('.ts') && !['index.ts', 'question-tags.ts'].includes(name))
  .sort();

let rewritten = 0;
for (const fileName of files) {
  const filePath = path.join(rolesDirectory, fileName);
  let source = fs.readFileSync(filePath, 'utf8');
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const replacements = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const call = node.expression.text;
      const offset = call === 'q' ? 0 : call === 'qt' ? 1 : -1;
      const candidateNode = offset >= 0 ? node.arguments[offset + 1] : null;
      if (candidateNode && (ts.isStringLiteral(candidateNode) || ts.isNoSubstitutionTemplateLiteral(candidateNode))) {
        const repaired = repairCandidateText(candidateNode.text);
        if (repaired !== candidateNode.text) {
          replacements.push({ start: candidateNode.getStart(file), end: candidateNode.end, value: quoted(repaired) });
          rewritten += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    source = `${source.slice(0, replacement.start)}${replacement.value}${source.slice(replacement.end)}`;
  }
  if (replacements.length) fs.writeFileSync(filePath, source, 'utf8');
}

process.stdout.write(`Rows rewritten: ${rewritten}\n`);
