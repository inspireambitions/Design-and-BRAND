import { z } from 'zod';

const CompetencyFamilySchema = z.enum([
  'behavioural',
  'technical',
  'leadership',
  'commercial',
  'cognitive',
  'motivation',
]);
const ExperienceLevelSchema = z.enum(['ENTRY', 'PROFESSIONAL', 'MANAGER', 'SENIOR_MANAGER', 'EXECUTIVE']);
const QuestionTypeSchema = z.enum([
  'INTRODUCTION',
  'MOTIVATION',
  'BEHAVIOURAL',
  'SITUATIONAL',
  'TECHNICAL',
  'LEADERSHIP',
  'COMMERCIAL',
  'CAREER_HISTORY',
  'ROLE_KNOWLEDGE',
]);
const FrameworkSchema = z.enum([
  'STAR',
  'MOTIVATION',
  'SITUATIONAL_JUDGEMENT',
  'TECHNICAL_REASONING',
  'LEADERSHIP_DEPTH',
  'COMMERCIAL_REASONING',
  'CAREER_NARRATIVE',
  'ROLE_KNOWLEDGE',
]);
const CriterionStatusSchema = z.enum(['MISSING', 'WEAK', 'PRESENT', 'STRONG']);
const CriterionNameSchema = z.enum([
  'situation', 'task', 'action', 'result',
  'specificity', 'role_understanding', 'credibility', 'career_logic',
  'judgement', 'prioritisation', 'risk_recognition', 'reasoning',
  'conceptual_understanding', 'application', 'trade_offs', 'clarity',
  'scope', 'ownership', 'decision', 'stakeholder_handling', 'outcome',
  'numbers', 'causality', 'coherence', 'relevance',
  'accuracy_of_role_understanding', 'realism', 'priorities',
]);

export const CandidateProfileSchema = z.object({
  experience_level: ExperienceLevelSchema,
  years_experience: z.number().int().min(0).max(60),
  current_or_previous_role: z.string().trim().max(120),
  target_role: z.string().trim().min(2).max(120),
  industry_background: z.string().trim().max(120),
  career_change: z.boolean(),
  management_experience: z.boolean(),
  language: z.literal('en'),
}).strict();

export const DiscoverySchema = z.object({
  competencies: z.array(z.object({
    id: z.string().regex(/^c_[a-z0-9_]{2,60}$/),
    name: z.string().trim().min(2).max(80),
    family: CompetencyFamilySchema,
    source: z.enum(['EXPLICIT', 'INFERRED', 'ASSUMED']),
    source_text: z.string().trim().max(240),
    importance: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  }).strict()).min(5).max(12),
  role_summary: z.string().trim().min(10).max(500),
  seniority_detected: ExperienceLevelSchema,
  management_scope: z.string().trim().max(200),
}).strict();

export const PlanSchema = z.object({
  plan: z.array(z.object({
    slot: z.number().int().min(1).max(8),
    question_type: QuestionTypeSchema,
    primary_intent: z.string().trim().min(2).max(80),
    target_competencies: z.array(z.string().regex(/^c_[a-z0-9_]{2,60}$/)).min(1).max(2),
    text: z.string().trim().min(8).max(300),
    framework: FrameworkSchema,
  }).strict()).length(8),
}).strict();

export const ExtractionSchema = z.object({
  answered_the_question: z.boolean(),
  evidence: z.object({
    summary: z.string().trim().max(600),
    example_key: z.string().trim().max(120),
    competencies: z.array(z.object({
      id: z.string().regex(/^c_[a-z0-9_]{2,60}$/),
      strength: z.enum(['WEAK', 'MEDIUM', 'STRONG']),
      evidence_type: z.enum(['EMPLOYMENT', 'INTERNSHIP', 'ACADEMIC', 'VOLUNTEER', 'PERSONAL_PROJECT', 'HYPOTHETICAL']),
    }).strict()).max(5),
    criteria: z.array(z.object({
      criterion: CriterionNameSchema,
      status: CriterionStatusSchema,
    }).strict()).min(3).max(5),
    personal_ownership: z.enum(['CLEAR', 'UNCLEAR', 'ABSENT']),
    numbers_stated: z.array(z.string().max(80)).max(10),
    unsupported_claims: z.array(z.string().max(200)).max(10),
    same_example_as: z.string().regex(/^E\d{2,}$/).nullable(),
  }).strict(),
  recommended_action: z.enum([
    'PROBE_TASK',
    'PROBE_ACTION',
    'PROBE_RESULT',
    'PROBE_OWNERSHIP',
    'PROBE_SPECIFICITY',
    'PROBE_SCALE',
    'PROBE_REASONING',
    'CLARIFY',
    'REDIRECT',
    'MOVE_ON',
  ]),
  probe_target: z.string().trim().max(200),
  possible_inconsistency: z.object({
    earlier_evidence_id: z.string().regex(/^E\d{2,}$/),
    what_differs: z.string().trim().min(2).max(240),
  }).strict().nullable(),
}).strict();

export const GeneratedQuestionSchema = z.object({
  text: z.string().trim().min(5).max(300),
  question_type: QuestionTypeSchema,
  target_competencies: z.array(z.string().regex(/^c_[a-z0-9_]{2,60}$/)).min(1).max(2),
  intent: z.string().trim().min(2).max(100),
}).strict();

export const FeedbackSchema = z.object({
  competencies: z.array(z.object({
    id: z.string().regex(/^c_[a-z0-9_]{2,60}$/),
    what_worked: z.string().trim().max(500),
    what_is_missing: z.string().trim().max(500),
    improve_this: z.string().trim().max(500),
    evidence_ids: z.array(z.string().regex(/^E\d{2,}$/)).max(20),
  }).strict()).min(1).max(5),
  patterns: z.array(z.object({
    flag: z.enum(['repeated_example', 'weak_ownership', 'unsupported_claims', 'no_result_given']),
    plain_text: z.string().trim().min(2).max(300),
  }).strict()).max(4),
  single_highest_value_improvement: z.string().trim().min(2).max(500),
  retry_recommended_question: z.number().int().min(1).max(8),
}).strict();

export const DiscoverRequestSchema = z.object({
  profile: CandidateProfileSchema,
  job_description: z.string().max(20_000).default(''),
}).strict();

export const ConfirmRequestSchema = z.object({
  interview_id: z.string().uuid(),
  competency_ids: z.array(z.string()).length(5),
}).strict();

export const TurnRequestSchema = z.object({
  interview_id: z.string().uuid(),
  answer: z.string().max(12_000),
}).strict();

export const FeedbackRequestSchema = z.object({
  interview_id: z.string().uuid(),
}).strict();

export const RetryRequestSchema = z.object({
  interview_id: z.string().uuid(),
  question_number: z.number().int().min(1).max(8),
  answer: z.string().max(12_000),
}).strict();

export { ExperienceLevelSchema, FrameworkSchema, QuestionTypeSchema };
