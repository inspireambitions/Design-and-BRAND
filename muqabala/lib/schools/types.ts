export const INSTITUTIONAL_INDUSTRIES = [
  { id: 'finance', labelEn: 'Finance & Banking', labelAr: 'المالية والمصارف' },
  { id: 'engineering', labelEn: 'Engineering', labelAr: 'الهندسة' },
  { id: 'technology', labelEn: 'Technology & Computing', labelAr: 'التكنولوجيا والحوسبة' },
  { id: 'healthcare', labelEn: 'Healthcare & Medicine', labelAr: 'الرعاية الصحية والطب' },
  { id: 'hospitality', labelEn: 'Hospitality & Tourism', labelAr: 'الضيافة والسياحة' },
  { id: 'retail', labelEn: 'Retail & Consumer Goods', labelAr: 'التجزئة والسلع الاستهلاكية' },
  { id: 'professional_services', labelEn: 'Professional Services & Consulting', labelAr: 'الخدمات المهنية والاستشارات' },
  { id: 'government', labelEn: 'Government & Public Sector', labelAr: 'القطاع الحكومي والعام' },
  { id: 'education', labelEn: 'Education & Academic', labelAr: 'التعليم والتدريب' },
  { id: 'other', labelEn: 'Other Sector', labelAr: 'قطاعات أخرى' },
] as const;

export type InstitutionalIndustry = typeof INSTITUTIONAL_INDUSTRIES[number]['id'];

export type InstitutionalHierarchy = {
  campus?: string | null;
  faculty?: string | null;
  programme?: string | null;
  name: string;
};

export type StudentRosterRow = {
  studentIdentifier?: string;
  name: string;
  email?: string;
};

export type RosterParseResult = {
  total: number;
  valid: StudentRosterRow[];
  duplicates: StudentRosterRow[];
  invalid: { line: number; raw: string; error: string }[];
};

export type DeliveryMode = 'form_v1' | 'adaptive_v2';

export type FlexibleAssignmentPayload = {
  cohortId: string;
  roleId: string;
  questionIds: string[];
  dueAt: string;
  industry?: string | null;
  jobTitle?: string | null;
  jobDescription?: string | null;
  competencies?: string[];
  maxAttempts?: number | null;
  instructions?: string | null;
  status?: 'draft' | 'published' | 'closed';
  deliveryMode?: DeliveryMode;
};

export type ProgrammeEntity = {
  id: string;
  institution_id: string;
  name: string;
  code?: string | null;
  status: 'active' | 'inactive' | 'archived';
  campus?: string | null;
  faculty?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentLifecycleState = 'draft' | 'published' | 'closed';

export type InterventionCategory =
  | 'deadline_unstarted'
  | 'stalled_draft'
  | 'low_evidence'
  | 'stagnant_attempts'
  | 'support_requested';

export type InterventionSignal = {
  id: string;
  studentId: string;
  studentName: string;
  studentIdentifier?: string | null;
  assignmentId: string;
  assignmentRole: string;
  category: InterventionCategory;
  severity: 'urgent' | 'advisory';
  humanReason: string;
  evidenceBasis: string;
  timestamp: string;
  suggestedAction: string;
};

export type StudentAssignmentCard = {
  id: string;
  cohortId: string;
  roleTitle: string;
  industry?: string | null;
  instructions?: string | null;
  dueAt: string;
  relativeTime: string;
  isOverdue: boolean;
  status: 'not_started' | 'draft_in_progress' | 'submitted_awaiting_review' | 'reviewed_feedback_ready';
  attemptsAllowed: number | null;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  actionLabel: string;
  actionHref: string;
};

export const STANDARD_INSTITUTIONAL_COMPETENCIES = [
  { id: 'analytical_thinking', label: 'Analytical Thinking', keywords: ['analys', 'data', 'metrics', 'evaluate', 'investigate', 'research', 'critical'] },
  { id: 'communication', label: 'Verbal & Written Communication', keywords: ['communicat', 'present', 'write', 'report', 'explain', 'articulate', 'client'] },
  { id: 'collaboration', label: 'Teamwork & Collaboration', keywords: ['team', 'collaborat', 'cross-functional', 'partner', 'relationship', 'stakeholder'] },
  { id: 'problem_solving', label: 'Structured Problem Solving', keywords: ['problem', 'solve', 'troubleshoot', 'diagnos', 'resolve', 'innovat', 'root cause'] },
  { id: 'leadership', label: 'Initiative & Leadership', keywords: ['lead', 'initiat', 'owner', 'drive', 'coordinate', 'manage', 'mentoring'] },
  { id: 'adaptability', label: 'Adaptability & Resilience', keywords: ['adapt', 'resilien', 'fast-paced', 'change', 'agile', 'pressure', 'flexible'] },
  { id: 'commercial_awareness', label: 'Commercial & Industry Awareness', keywords: ['commercial', 'business', 'market', 'financial', 'revenue', 'cost', 'industry'] },
  { id: 'attention_to_detail', label: 'Attention to Detail', keywords: ['detail', 'accuracy', 'precise', 'quality', 'compliance', 'standards', 'rigour'] },
  { id: 'project_management', label: 'Planning & Organisation', keywords: ['plan', 'organis', 'priorit', 'deadline', 'deliver', 'milestone', 'timeline'] },
  { id: 'technical_proficiency', label: 'Technical Proficiency', keywords: ['technical', 'software', 'tools', 'system', 'methodology', 'framework', 'code'] }
];

export type CompetencyExtractionResult = {
  competencies: string[];
  arabicDetected: boolean;
};

export function extractCompetenciesFromJobText(jobText: string): string[] {
  return extractCompetenciesWithMetadata(jobText).competencies;
}

export function extractCompetenciesWithMetadata(jobText: string): CompetencyExtractionResult {
  if (!jobText || jobText.trim().length < 20) {
    return { competencies: [], arabicDetected: false };
  }

  const arabicRegex = /[\u0600-\u06FF]/;
  const hasArabic = arabicRegex.test(jobText);

  const lower = jobText.toLowerCase();
  const matched = STANDARD_INSTITUTIONAL_COMPETENCIES.filter((comp) =>
    comp.keywords.some((kw) => lower.includes(kw))
  ).map((c) => c.label);

  return {
    competencies: matched.slice(0, 5),
    arabicDetected: hasArabic,
  };
}

export type CanonicalQuestionData = {
  versionId: string;
  questionIndex: number;
  questionText: string;
  noExampleFollowUp?: string | null;
  rubric: { id: string; label: string; description: string }[];
};

import type { ExperienceLevel, PlannedQuestion, QuestionType } from '../universal-interview/types.ts';

export function buildAdaptivePlanFromCanonical(
  canonicalQuestions: CanonicalQuestionData[],
  competencies: { id: string; name: string }[],
  profile: { experience_level: ExperienceLevel }
): PlannedQuestion[] {
  return canonicalQuestions.map((q, index) => {
    const assignedComp = competencies[index % competencies.length] || { id: `c_canonical_${index + 1}`, name: 'Core Criterion' };
    const isIntro = index === 0;
    let cleanText = q.questionText.trim();
    if (cleanText.endsWith('.')) cleanText = cleanText.slice(0, -1);
    if (!cleanText.endsWith('?')) cleanText = `${cleanText}?`;
    const qType: QuestionType = isIntro ? 'INTRODUCTION' : 'BEHAVIOURAL';
    return {
      question_id: `canonical_${index + 1}`,
      candidate_text: cleanText,
      interviewer_intent: isIntro ? 'ROLE_RELEVANCE' : 'CHALLENGE_OR_EXECUTION',
      probe_targets: q.rubric.map((r) => r.id),
      question_type: qType,
      target_competencies: [assignedComp.id],
      seniority: profile.experience_level,
      language: 'en',
      source: 'BANK',
      prompt_version: '1.0',
      validated: true,
      rephrase_text: isIntro ? 'What experience from your background is most relevant here?' : 'What is one relevant example from your experience?',
      framework: 'STAR',
      kind: 'MAIN',
      slot: index + 1,
    };
  });
}
