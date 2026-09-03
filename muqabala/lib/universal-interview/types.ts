export const PROMPT_VERSION = 'universal-brain-v2.0.0';

export type CompetencyFamily =
  | 'behavioural'
  | 'technical'
  | 'leadership'
  | 'commercial'
  | 'cognitive'
  | 'motivation';

export type CompetencySource = 'EXPLICIT' | 'INFERRED' | 'ASSUMED';
export type Importance = 'HIGH' | 'MEDIUM' | 'LOW';
export type ExperienceLevel = 'ENTRY' | 'PROFESSIONAL' | 'MANAGER' | 'SENIOR_MANAGER' | 'EXECUTIVE';
export type CriterionStatus = 'MISSING' | 'WEAK' | 'PRESENT' | 'STRONG';
export type CoverageStatus = 'NO_EVIDENCE' | 'WEAK' | 'PARTIAL' | 'SUFFICIENT' | 'STRONG';
export type EvidenceStrength = 'WEAK' | 'MEDIUM' | 'STRONG';
export type EvidenceType =
  | 'EMPLOYMENT'
  | 'INTERNSHIP'
  | 'ACADEMIC'
  | 'VOLUNTEER'
  | 'PERSONAL_PROJECT'
  | 'HYPOTHETICAL';

export type QuestionType =
  | 'INTRODUCTION'
  | 'MOTIVATION'
  | 'BEHAVIOURAL'
  | 'SITUATIONAL'
  | 'TECHNICAL'
  | 'LEADERSHIP'
  | 'COMMERCIAL'
  | 'CAREER_HISTORY'
  | 'ROLE_KNOWLEDGE';

export type Framework =
  | 'STAR'
  | 'MOTIVATION'
  | 'SITUATIONAL_JUDGEMENT'
  | 'TECHNICAL_REASONING'
  | 'LEADERSHIP_DEPTH'
  | 'COMMERCIAL_REASONING'
  | 'CAREER_NARRATIVE'
  | 'ROLE_KNOWLEDGE';

export type TurnAction =
  | 'PROBE_TASK'
  | 'PROBE_ACTION'
  | 'PROBE_RESULT'
  | 'PROBE_OWNERSHIP'
  | 'PROBE_SPECIFICITY'
  | 'PROBE_SCALE'
  | 'PROBE_REASONING'
  | 'CLARIFY'
  | 'REDIRECT'
  | 'OFFER_HYPOTHETICAL'
  | 'REPHRASE'
  | 'SKIP'
  | 'MOVE_ON'
  | 'COMPLETE';

export type InterviewPhase = 'AWAITING_CONFIRMATION' | 'ACTIVE' | 'COMPLETE';

export type CandidateProfile = {
  experience_level: ExperienceLevel;
  years_experience: number;
  current_or_previous_role: string;
  target_role: string;
  industry_background: string;
  career_change: boolean;
  management_experience: boolean;
  language: 'en';
};

export type DiscoveredCompetency = {
  id: string;
  name: string;
  family: CompetencyFamily;
  source: CompetencySource;
  source_text: string;
  importance: Importance;
  jd_order?: number;
};

export type DiscoveryResult = {
  competencies: DiscoveredCompetency[];
  role_summary: string;
  seniority_detected: ExperienceLevel;
  management_scope: string;
};

export type JDQualityOutcome = 'PASS' | 'WEAK' | 'FAIL';

export type JDQualityResult = {
  outcome: JDQualityOutcome;
  score: number;
  cleaned_text: string;
  word_count: number;
  responsibility_lines: number;
  boilerplate_ratio: number;
  detected_titles: string[];
  stripped_patterns: string[];
  truncated: boolean;
  reason: string | null;
};

export type PlannedQuestion = {
  slot: number;
  question_type: QuestionType;
  primary_intent: string;
  target_competencies: string[];
  text: string;
  rephrase: string;
  framework: Framework;
};

export type GeneratedQuestion = {
  text: string;
  question_type: QuestionType;
  target_competencies: string[];
  intent: string;
  framework: Framework;
  kind: 'MAIN' | 'PROBE' | 'CLARIFY' | 'REDIRECT' | 'HYPOTHETICAL' | 'REPHRASE';
};

export type ExtractedCompetency = {
  id: string;
  strength: EvidenceStrength;
  evidence_type: EvidenceType;
};

export type PossibleInconsistency = {
  earlier_evidence_id: string;
  what_differs: string;
};

export type ExtractionResult = {
  answered_the_question: boolean;
  evidence: {
    summary: string;
    example_key: string;
    competencies: ExtractedCompetency[];
    criteria: Record<string, CriterionStatus>;
    personal_ownership: 'CLEAR' | 'UNCLEAR' | 'ABSENT';
    numbers_stated: string[];
    unsupported_claims: string[];
    same_example_as: string | null;
  };
  recommended_action: Exclude<TurnAction, 'OFFER_HYPOTHETICAL' | 'REPHRASE' | 'SKIP' | 'COMPLETE'>;
  probe_target: string;
  possible_inconsistency: PossibleInconsistency | null;
};

export type EvidenceLedgerEntry = {
  id: string;
  question_number: number;
  summary: string;
  example_key: string;
  competencies: Record<string, EvidenceStrength>;
  criteria: Record<string, CriterionStatus>;
  evidence_type: EvidenceType;
  unsupported_claims: string[];
  dedupe_key: string;
};

export type CoverageEntry = {
  status: CoverageStatus;
  evidence_ids: string[];
};

export type DecisionLogEntry = {
  interview_id: string;
  turn: number;
  prompt_version: string;
  precheck: string | null;
  t1_action: TurnAction | null;
  code_action: TurnAction;
  override_reason: string | null;
  dedupe_hit: boolean;
  probe_count: number;
  model_calls: number;
  latency_ms: number;
  schema_retry: boolean;
  fallback_used: boolean;
  sufficient_competencies: number;
  stripped_patterns: string[];
};

export type RolePackQuestion = {
  text: string;
  question_type: QuestionType;
  target_competencies: string[];
  intent: string;
};

export type RolePack = {
  role: string;
  version: string;
  author: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  implicit_competencies: string[];
  core_competencies: string[];
  question_bank: RolePackQuestion[];
  assessment_type: 'COMPETENCY' | 'PRACTICAL' | 'PORTFOLIO';
  technical_reference: null | {
    name: string;
    reviewed_by: string;
    reviewed_at: string;
  };
  is_fallback?: boolean;
};

export type InterviewState = {
  interview_id: string;
  prompt_version: string;
  role: string;
  seniority: ExperienceLevel;
  profile: CandidateProfile;
  jd_quality: JDQualityResult;
  discovery: DiscoveredCompetency[];
  blueprint: DiscoveredCompetency[];
  confirmed_by_candidate: boolean;
  plan: PlannedQuestion[];
  question_number: number;
  current_question: GeneratedQuestion | null;
  probe_count_current: number;
  coverage: Record<string, CoverageEntry>;
  evidence_ledger: EvidenceLedgerEntry[];
  transcripts: Record<string, string>;
  examples_used: string[];
  dedupe_keys: string[];
  clarified_inconsistencies: string[];
  hypothetical_offered_for: number[];
  executive_ownership_probe_used: boolean;
  pattern_flags: {
    repeated_example: number;
    weak_ownership: number;
    unsupported_claims: number;
    no_result_given: number;
  };
  decision_log: DecisionLogEntry[];
  role_pack: RolePack;
  retry_used: boolean;
  retry_result: RetryComparison | null;
  final_feedback: FinalFeedback | null;
  phase: InterviewPhase;
  status: 'ACTIVE' | 'COMPLETE';
};

export type RetryComparison = {
  question_number: number;
  before: Record<string, CoverageStatus>;
  after: Record<string, CoverageStatus>;
  feedback: FinalFeedback['competencies'];
};

export type PrecheckResult = {
  kind: 'NONE' | 'NO_EXAMPLE' | 'REPHRASE_REQUEST' | 'SKIP_REQUEST';
  cleaned_answer: string;
  word_count: number;
  short_answer: boolean;
  truncated: boolean;
  stripped_patterns: string[];
};

export type TurnDecision = {
  action: TurnAction;
  probe_target: string;
  counts_as_probe: boolean;
  override_reason: string | null;
};

export type CompetencyFeedback = {
  id: string;
  what_worked: string;
  what_is_missing: string;
  improve_this: string;
  evidence_ids: string[];
};

export type FeedbackModelOutput = {
  competencies: CompetencyFeedback[];
  patterns: Array<{ flag: keyof InterviewState['pattern_flags']; plain_text: string }>;
  single_highest_value_improvement: string;
  retry_recommended_question: number;
};

export type FinalFeedback = Omit<FeedbackModelOutput, 'competencies'> & {
  competencies: Array<CompetencyFeedback & { band: 'Strong evidence' | 'Developing evidence' | 'Missing evidence' }>;
  caveats: string[];
};
