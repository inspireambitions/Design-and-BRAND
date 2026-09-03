import { CandidateEvaluationReportSchema, type CandidateEvaluationReport } from '@/lib/evaluation-report';

const competencies = [
  ['Guest care', 'EVIDENCE_FOUND', [
    'Greeted the guest, confirmed the towel request, updated the supervisor, and returned with the items.',
    'Explained checking that the guest had received every requested item before leaving the room.',
    'Described thanking the guest and recording the request for the next shift handover.',
  ], null],
  ['Room preparation', 'EVIDENCE_FOUND', [
    'Prepared 12 rooms by following the hotel checklist from the entrance through the bathroom.',
    'Explained replacing linen, restocking supplies, and checking each surface before closing the room.',
    'Described separating clean and used linen throughout the room preparation process.',
  ], null],
  ['Quality checks', 'PARTIAL', [
    'Used a written checklist before asking the supervisor to inspect the completed room.',
    'Returned to correct one missed bathroom item after the supervisor completed the inspection.',
    'Recorded completed rooms on the shift sheet before moving to the next floor.',
  ], 'What did you check yourself before asking the supervisor to inspect your work?'],
  ['Time planning', 'EVIDENCE_FOUND', [
    'Ordered rooms by departure time and started with the room needed first by reception.',
    'Called the supervisor when a late departure changed the order of the room list.',
    'Completed the priority room before returning to the remaining rooms on the floor.',
  ], null],
  ['Team communication', 'PARTIAL', [
    'Reported a missing item to the supervisor and noted the room number on the shift sheet.',
    'Told reception when the priority room was ready for the arriving guest.',
    'Shared the remaining room list with the next shift during handover.',
  ], 'How did you confirm that the next shift understood the handover details?'],
  ['Property handling', 'EVIDENCE_FOUND', [
    'Left a guest item untouched, called the supervisor, and followed the lost property process.',
    'Recorded the room number and item description while the supervisor was present.',
    'Explained keeping the room secure until the item was collected under the hotel process.',
  ], null],
  ['Safety practice', 'PARTIAL', [
    'Placed a warning sign before cleaning the wet bathroom floor.',
    'Stored cleaning materials on the trolley and kept the trolley beside the room entrance.',
    'Reported a damaged power socket to the supervisor before continuing the room check.',
  ], 'What steps did you take after reporting the damaged socket?'],
  ['Service recovery', 'EVIDENCE_NOT_FOUND', [], 'What did you do when a guest said the room was not ready?'],
] as const;

let evidenceNumber = 1;
export const sampleEvaluationReport: CandidateEvaluationReport = CandidateEvaluationReportSchema.parse({
  report_id: 'EVAL-2026-4A7C19D2',
  report_format_version: '1.0',
  report_version: 1,
  rubric_version: 'universal-brain-v2.0.1',
  interview_id: '10000000-0000-4000-8000-000000000001',
  candidate_id: '10000000-0000-4000-8000-000000000002',
  candidate_name: 'Amina Okello',
  role_id: 'housekeeping-attendant',
  role_title: 'Housekeeping Attendant',
  workplace: 'Al Noor Beach Hotel',
  employer_id: '10000000-0000-4000-8000-000000000003',
  interviewer_of_record: 'R. Haddad',
  interview_datetime: '2026-08-28T10:10:00.000Z',
  duration_seconds: 621,
  question_count: 8,
  seniority_band: 'Entry',
  competencies: competencies.map(([name, band, evidence, followup], competencyIndex) => ({
    competency_id: `c_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    rubric_order: competencyIndex + 1,
    band,
    evidence_lines: evidence.map((text, lineIndex) => {
      const id = `00000000-0000-4000-8000-${String(evidenceNumber).padStart(12, '0')}`;
      evidenceNumber += 1;
      return {
        evidence_id: id,
        text,
        question_number: Math.min(8, competencyIndex + 1),
        timestamp_seconds: 18 + competencyIndex * 11 + lineIndex * 7,
        transcript_span: text,
      };
    }),
    followup_question: followup,
  })),
  employer_notes: [{
    author_id: '10000000-0000-4000-8000-000000000003',
    author_name: 'R. Haddad',
    created_at: '2026-08-28T12:20:00.000Z',
    text: 'Review the property handling example with the operations lead.',
  }],
  decision: {
    outcome: 'HOLD',
    decided_by_id: '10000000-0000-4000-8000-000000000003',
    decided_by_name: 'R. Haddad',
    decided_at: '2026-08-28T12:30:00.000Z',
  },
  generated_at: '2026-08-28T12:00:00.000Z',
  generated_by_pipeline_version: 'candidate-evaluation-v1',
});
