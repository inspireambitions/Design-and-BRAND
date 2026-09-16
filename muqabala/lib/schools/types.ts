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

