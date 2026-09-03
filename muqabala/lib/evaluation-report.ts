import { z } from 'zod';

export const REPORT_FORMAT_VERSION = '1.0';
export const REPORT_PIPELINE_VERSION = 'candidate-evaluation-v1';
export const REPORT_BANDS = ['EVIDENCE_FOUND', 'PARTIAL', 'EVIDENCE_NOT_FOUND'] as const;

export type ReportBand = typeof REPORT_BANDS[number];

const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length;

export const EvidenceLineSchema = z.object({
  evidence_id: z.string().uuid(),
  text: z.string().trim().min(1).max(400).refine((value) => wordCount(value) <= 25, 'Evidence text must be 25 words or fewer.'),
  question_number: z.number().int().min(1).max(50),
  timestamp_seconds: z.number().int().min(0).max(128),
  transcript_span: z.string().trim().min(1).max(1200),
}).strict();

export const ReportCompetencySchema = z.object({
  competency_id: z.string().regex(/^c_[a-z0-9_]{2,60}$/),
  name: z.string().trim().min(2).max(100),
  rubric_order: z.number().int().min(1).max(8),
  band: z.enum(REPORT_BANDS),
  evidence_lines: z.array(EvidenceLineSchema).max(3),
  followup_question: z.string().trim().min(5).max(300).nullable(),
}).strict().superRefine((competency, context) => {
  if (competency.band === 'EVIDENCE_FOUND' && competency.followup_question !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A follow-up question is allowed only when evidence has a gap.',
      path: ['followup_question'],
    });
  }
});

export const EmployerNoteSchema = z.object({
  author_id: z.string().uuid(),
  author_name: z.string().trim().min(1).max(100),
  created_at: z.string().datetime(),
  text: z.string().trim().min(1).max(1000),
}).strict();

export const EvaluationDecisionSchema = z.object({
  outcome: z.enum(['SHORTLIST', 'PASS', 'HOLD']),
  decided_by_id: z.string().uuid(),
  decided_by_name: z.string().trim().min(1).max(100),
  decided_at: z.string().datetime(),
}).strict();

export const CandidateEvaluationReportSchema = z.object({
  report_id: z.string().regex(/^EVAL-[0-9]{4}-[A-F0-9]{8}$/),
  report_format_version: z.literal(REPORT_FORMAT_VERSION),
  report_version: z.number().int().min(1).max(100),
  rubric_version: z.string().trim().min(1).max(80),
  interview_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  candidate_name: z.string().trim().min(1).max(100),
  role_id: z.string().min(1).max(160),
  role_title: z.string().trim().min(1).max(200),
  workplace: z.string().trim().min(1).max(200),
  employer_id: z.string().uuid(),
  interviewer_of_record: z.string().trim().min(1).max(100),
  interview_datetime: z.string().datetime(),
  duration_seconds: z.number().int().min(0).max(10_000),
  question_count: z.number().int().min(1).max(50),
  seniority_band: z.string().trim().min(1).max(80),
  competencies: z.array(ReportCompetencySchema).min(1).max(8),
  employer_notes: z.array(EmployerNoteSchema).max(50),
  decision: EvaluationDecisionSchema.nullable(),
  generated_at: z.string().datetime(),
  generated_by_pipeline_version: z.literal(REPORT_PIPELINE_VERSION),
}).strict();

export type CandidateEvaluationReport = z.infer<typeof CandidateEvaluationReportSchema>;
export type ReportEvidenceLine = z.infer<typeof EvidenceLineSchema>;

export type StoredEvidenceRecord = {
  id: string;
  competency_id: string;
  transcript_span: string;
  question_index: number;
  start_ms: number;
  end_ms: number;
  recording_duration_seconds: number;
  evidence_strength: string;
  criterion_results: Record<string, unknown>;
};

const RUBRIC_STATUS = {
  STRONG: 'met',
  PRESENT: 'met',
  WEAK: 'partial',
  MISSING: 'partial',
} as const;
const EVIDENCE_STATUS = { STRONG: 'met', MEDIUM: 'partial', WEAK: 'partial' } as const;

export function bandFromEvidence(
  records: Array<Pick<StoredEvidenceRecord, 'criterion_results'> & Partial<Pick<StoredEvidenceRecord, 'evidence_strength'>>>,
  log: (value: unknown) => void = (value) => console.warn('unmapped_evaluation_rubric_status', value),
): ReportBand {
  if (records.length === 0) return 'EVIDENCE_NOT_FOUND';
  let mapped = false;
  let met = false;
  for (const record of records) {
    if (record.evidence_strength !== undefined) {
      const status = EVIDENCE_STATUS[String(record.evidence_strength) as keyof typeof EVIDENCE_STATUS];
      if (!status) log(record.evidence_strength);
      else {
        mapped = true;
        if (status === 'met') met = true;
      }
      continue;
    }
    for (const value of Object.values(record.criterion_results)) {
      const status = RUBRIC_STATUS[String(value) as keyof typeof RUBRIC_STATUS];
      if (!status) {
        log(value);
        continue;
      }
      mapped = true;
      if (status === 'met') met = true;
    }
  }
  if (met) return 'EVIDENCE_FOUND';
  return mapped ? 'PARTIAL' : 'EVIDENCE_NOT_FOUND';
}

export type EvidenceLineReason =
  | 'CITATION_MISSING'
  | 'CITATION_UNKNOWN'
  | 'TIMESTAMP_INVALID'
  | 'TOO_LONG'
  | 'FORBIDDEN_WORD'
  | 'UNGROUNDED_NUMBER'
  | 'UNGROUNDED_TERM'
  | 'EMPTY';

export type ProposedEvidenceLine = { evidence_id?: unknown; text?: unknown };

const FORBIDDEN_EVIDENCE_WORDS = /\b(?:strengths?|weakness(?:es)?|concerns?|red flags?|risks?|fit|personality|attitude|confident|nervous|articulate|fluent|accent|native|age|nationality|gender|religion|appearance|recommend\w*|hire\w*|reject\w*|scores?|ratings?)\b|%|\/10|\bout of\b/iu;
const FORBIDDEN_EVIDENCE_WORDS_GLOBAL = new RegExp(FORBIDDEN_EVIDENCE_WORDS.source, 'giu');
const NUMBER_TOKEN = /\b\d+(?:[.,]\d+)?\b/g;
const PROPER_NOUN = /\b[A-Z][A-Za-z0-9.-]{2,}\b/g;

function normalise(value: string): string {
  return value.toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function validateEvidenceLine(
  proposal: ProposedEvidenceLine,
  records: StoredEvidenceRecord[],
  recordingDurationSeconds: number,
): { ok: true; line: ReportEvidenceLine } | { ok: false; reasons: EvidenceLineReason[] } {
  const reasons: EvidenceLineReason[] = [];
  const evidenceId = typeof proposal.evidence_id === 'string' ? proposal.evidence_id : '';
  const text = typeof proposal.text === 'string' ? proposal.text.trim() : '';
  if (!evidenceId) reasons.push('CITATION_MISSING');
  const record = records.find((item) => item.id === evidenceId);
  if (evidenceId && !record) reasons.push('CITATION_UNKNOWN');
  if (!text) reasons.push('EMPTY');
  if (text && wordCount(text) > 25) reasons.push('TOO_LONG');
  if (text && FORBIDDEN_EVIDENCE_WORDS.test(text)) reasons.push('FORBIDDEN_WORD');
  if (record) {
    if (record.start_ms < 0 || record.end_ms <= record.start_ms || record.end_ms > recordingDurationSeconds * 1000 + 3000) {
      reasons.push('TIMESTAMP_INVALID');
    }
    const spanNumbers = new Set(record.transcript_span.match(NUMBER_TOKEN) ?? []);
    if ((text.match(NUMBER_TOKEN) ?? []).some((number) => !spanNumbers.has(number))) reasons.push('UNGROUNDED_NUMBER');
    const span = normalise(record.transcript_span);
    const ungroundedTerm = (text.match(PROPER_NOUN) ?? [])
      .filter((term, index) => index > 0 || !text.startsWith(term))
      .some((term) => !span.includes(normalise(term)));
    if (ungroundedTerm) reasons.push('UNGROUNDED_TERM');
  }
  if (reasons.length > 0 || !record) return { ok: false, reasons: [...new Set(reasons)] };
  return {
    ok: true,
    line: {
      evidence_id: record.id,
      text,
      question_number: record.question_index + 1,
      timestamp_seconds: Math.floor(record.start_ms / 1000),
      transcript_span: record.transcript_span,
    },
  };
}

export function quotedEvidenceFallback(record: StoredEvidenceRecord): ReportEvidenceLine {
  const words = record.transcript_span.trim().split(/\s+/u).filter(Boolean);
  const excerpt = words.slice(0, 25).join(' ')
    .replace(/[“”"]/g, "'")
    .replace(FORBIDDEN_EVIDENCE_WORDS_GLOBAL, '[omitted]');
  return {
    evidence_id: record.id,
    text: `“${excerpt}${words.length > 25 ? '…' : ''}”`,
    question_number: record.question_index + 1,
    timestamp_seconds: Math.floor(record.start_ms / 1000),
    transcript_span: record.transcript_span,
  };
}

export function formatPlaybackTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
