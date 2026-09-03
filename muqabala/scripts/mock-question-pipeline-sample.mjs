import { validateCandidateText } from '../lib/universal-interview/candidate-question.ts';

const inputs = [
  'What specific example shows Why the candidate specifically wants the Housekeeping Attendant role and what relevant experience or understanding they have of room-cleaning standards and guest care.?',
  'What specific example shows Ask for one specific room-cleaning example from the hotel attachment, including the standards followed, how guest belongings and needs were handled, and why that experience motivated pursuit of this役割?',
  'Why do you want to work as a Housekeeping Attendant here?',
  'What standards did you follow when cleaning a room during your hotel attachment?',
  'How did you protect guest belongings while cleaning a room?',
  'What did you do when a guest requested urgent room service?',
  'How do you use cleaning chemicals safely at work?',
  'What do you do first when several rooms need urgent attention?',
  'How did you help your team during a difficult shift?',
  'What did you do after making a mistake at work?',
  'How do you check that a room meets the required standard?',
  'What experience from your background is most relevant to this role?',
];

const served = [];
const rejected = [];
for (const candidateText of inputs) {
  const validation = validateCandidateText(candidateText, { language: 'en', seniority: 'ENTRY' });
  if (validation.ok) served.push(candidateText);
  else rejected.push({ candidate_text: candidateText, reasons: validation.reasons });
}

if (served.length !== 10) throw new Error(`Expected 10 served questions, received ${served.length}.`);
const reasons = rejected.flatMap((item) => item.reasons).reduce((counts, reason) => {
  counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
}, {});

process.stdout.write(`Mocked inputs: ${inputs.length}\n`);
process.stdout.write(`Rejected: ${rejected.length} (${Math.round(rejected.length / inputs.length * 100)}%)\n`);
process.stdout.write(`Reasons: ${JSON.stringify(reasons)}\n`);
served.forEach((question, index) => process.stdout.write(`${index + 1}. ${question}\n`));
