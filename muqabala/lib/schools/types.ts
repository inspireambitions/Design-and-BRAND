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
};
