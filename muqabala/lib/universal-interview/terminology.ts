import type { CandidateProfile } from './types.ts';

export type CanonicalEducationConcept =
  | 'ACADEMIC_PROJECT'
  | 'CAPSTONE'
  | 'PRACTICAL_WORK_EXPOSURE'
  | 'CLINICAL_PLACEMENT'
  | 'RESEARCH'
  | 'VOLUNTEERING'
  | 'STUDENT_LEADERSHIP'
  | 'COMPETITION'
  | 'PORTFOLIO'
  | 'PERSONAL_PROJECT'
  | 'PART_TIME_WORK'
  | 'ENTREPRENEURSHIP';

export type CountryPack = {
  country_code: string;
  country_name: string;
  education_system: string;
  concept_terms: Record<CanonicalEducationConcept, string>;
  evidence_fallback_sources: string[];
};

export const GLOBAL_COUNTRY_PACKS: Record<string, CountryPack> = {
  CA: {
    country_code: 'CA',
    country_name: 'Canada',
    education_system: 'Canadian Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'course project',
      CAPSTONE: 'capstone project',
      PRACTICAL_WORK_EXPOSURE: 'co-op or internship',
      CLINICAL_PLACEMENT: 'practicum or clinical placement',
      RESEARCH: 'academic research',
      VOLUNTEERING: 'volunteering or student club',
      STUDENT_LEADERSHIP: 'student association leadership',
      COMPETITION: 'case competition or hackathon',
      PORTFOLIO: 'project portfolio',
      PERSONAL_PROJECT: 'personal or team project',
      PART_TIME_WORK: 'part-time work',
      ENTREPRENEURSHIP: 'student venture or side business',
    },
    evidence_fallback_sources: [
      'coursework',
      'a capstone',
      'co-op',
      'volunteering or part-time work',
    ],
  },
  US: {
    country_code: 'US',
    country_name: 'United States',
    education_system: 'US Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'course project',
      CAPSTONE: 'senior capstone',
      PRACTICAL_WORK_EXPOSURE: 'internship',
      CLINICAL_PLACEMENT: 'clinical rotation or practicum',
      RESEARCH: 'undergraduate research',
      VOLUNTEERING: 'student organisation or volunteering',
      STUDENT_LEADERSHIP: 'campus leadership',
      COMPETITION: 'case competition or hackathon',
      PORTFOLIO: 'design portfolio',
      PERSONAL_PROJECT: 'independent project',
      PART_TIME_WORK: 'campus or part-time job',
      ENTREPRENEURSHIP: 'startup or freelance initiative',
    },
    evidence_fallback_sources: [
      'coursework',
      'a senior capstone',
      'an internship',
      'volunteering or campus work',
    ],
  },
  IN: {
    country_code: 'IN',
    country_name: 'India',
    education_system: 'Indian Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'course project',
      CAPSTONE: 'final-year project',
      PRACTICAL_WORK_EXPOSURE: 'internship or industrial training',
      CLINICAL_PLACEMENT: 'hospital posting or clinical duty',
      RESEARCH: 'academic research or paper',
      VOLUNTEERING: 'NSS, society or NGO volunteering',
      STUDENT_LEADERSHIP: 'student club or fest committee',
      COMPETITION: 'hackathon or technical fest',
      PORTFOLIO: 'project portfolio',
      PERSONAL_PROJECT: 'independent project',
      PART_TIME_WORK: 'part-time or freelance work',
      ENTREPRENEURSHIP: 'startup or incubation initiative',
    },
    evidence_fallback_sources: [
      'coursework',
      'your final-year project',
      'industrial training',
      'volunteering or part-time work',
    ],
  },
  CN: {
    country_code: 'CN',
    country_name: 'China',
    education_system: 'Chinese Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'course project',
      CAPSTONE: 'graduation thesis or design project',
      PRACTICAL_WORK_EXPOSURE: 'internship or enterprise practice',
      CLINICAL_PLACEMENT: 'hospital internship or clinical practice',
      RESEARCH: 'laboratory research or academic paper',
      VOLUNTEERING: 'youth volunteer service or campus society',
      STUDENT_LEADERSHIP: 'student union or league committee',
      COMPETITION: 'innovation competition or contest',
      PORTFOLIO: 'work portfolio',
      PERSONAL_PROJECT: 'independent project',
      PART_TIME_WORK: 'part-time work or work-study',
      ENTREPRENEURSHIP: 'innovation and entrepreneurship project',
    },
    evidence_fallback_sources: [
      'coursework',
      'a graduation project',
      'an internship',
      'volunteer work or practical projects',
    ],
  },
  UG: {
    country_code: 'UG',
    country_name: 'Uganda',
    education_system: 'Ugandan Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'coursework project',
      CAPSTONE: 'final-year research or project',
      PRACTICAL_WORK_EXPOSURE: 'internship or industrial attachment',
      CLINICAL_PLACEMENT: 'clinical attachment or hospital placement',
      RESEARCH: 'academic research or dissertation',
      VOLUNTEERING: 'community volunteering or student guild',
      STUDENT_LEADERSHIP: 'guild or departmental leadership',
      COMPETITION: 'academic challenge or project exhibition',
      PORTFOLIO: 'work showcase or portfolio',
      PERSONAL_PROJECT: 'personal initiative or practical project',
      PART_TIME_WORK: 'part-time work or gig',
      ENTREPRENEURSHIP: 'small business or student enterprise',
    },
    evidence_fallback_sources: [
      'coursework',
      'a project',
      'industrial attachment',
      'volunteering or part-time work',
    ],
  },
  KE: {
    country_code: 'KE',
    country_name: 'Kenya',
    education_system: 'Kenyan Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'course project',
      CAPSTONE: 'final-year project or research project',
      PRACTICAL_WORK_EXPOSURE: 'internship or industrial attachment',
      CLINICAL_PLACEMENT: 'clinical attachment or practicum',
      RESEARCH: 'undergraduate research or field study',
      VOLUNTEERING: 'community service or student club',
      STUDENT_LEADERSHIP: 'student council or association executive',
      COMPETITION: 'hackathon or innovation challenge',
      PORTFOLIO: 'work portfolio',
      PERSONAL_PROJECT: 'personal project or technical build',
      PART_TIME_WORK: 'part-time job or freelance work',
      ENTREPRENEURSHIP: 'youth enterprise or side hustle',
    },
    evidence_fallback_sources: [
      'coursework',
      'a project',
      'industrial attachment',
      'volunteering or part-time work',
    ],
  },
  GH: {
    country_code: 'GH',
    country_name: 'Ghana',
    education_system: 'Ghanaian Higher Education',
    concept_terms: {
      ACADEMIC_PROJECT: 'coursework assignment or group project',
      CAPSTONE: 'long essay, final-year project or thesis',
      PRACTICAL_WORK_EXPOSURE: 'internship or industrial attachment',
      CLINICAL_PLACEMENT: 'clinical posting or hospital practicum',
      RESEARCH: 'academic research or field project',
      VOLUNTEERING: 'departmental society or volunteer service',
      STUDENT_LEADERSHIP: 'SRC or departmental executive role',
      COMPETITION: 'student challenge or exhibition',
      PORTFOLIO: 'project portfolio',
      PERSONAL_PROJECT: 'independent project',
      PART_TIME_WORK: 'part-time employment',
      ENTREPRENEURSHIP: 'student startup or venture',
    },
    evidence_fallback_sources: [
      'coursework',
      'a final-year project',
      'industrial attachment',
      'volunteering or part-time work',
    ],
  },
};

export const GENERIC_DEFAULT_PACK: CountryPack = {
  country_code: 'GLOBAL',
  country_name: 'Global',
  education_system: 'International Higher Education',
  concept_terms: {
    ACADEMIC_PROJECT: 'university project',
    CAPSTONE: 'capstone or final project',
    PRACTICAL_WORK_EXPOSURE: 'internship or practical placement',
    CLINICAL_PLACEMENT: 'clinical placement or practicum',
    RESEARCH: 'academic research',
    VOLUNTEERING: 'volunteering',
    STUDENT_LEADERSHIP: 'student leadership',
    COMPETITION: 'project competition or hackathon',
    PORTFOLIO: 'work portfolio',
    PERSONAL_PROJECT: 'practical project',
    PART_TIME_WORK: 'part-time work',
    ENTREPRENEURSHIP: 'practical initiative',
  },
  evidence_fallback_sources: [
    'university',
    'project',
    'volunteering',
    'other practical experience',
  ],
};

/**
 * Interface prepared for future institutional prospectus and programme integration.
 */
export type InstitutionContextPack = {
  id: string;
  institution_name: string;
  country_code: string;
  programmes: Record<
    string,
    {
      programme_name: string;
      qualification: string;
      learning_areas?: string[];
      projects?: string[];
      labs?: string[];
      placements?: string[];
      internships?: string[];
      practicum?: string[];
      clinical_experience?: string[];
      research?: string[];
      competitions?: string[];
      career_paths?: string[];
    }
  >;
};

/**
 * Synthetic Chitkara University prospectus fixture for testing programme context hooks.
 * Used ONLY to verify compatibility and representative educational evidence environments.
 */
export const CHITKARA_PROSPECTUS_FIXTURE: InstitutionContextPack = {
  id: 'inst_chitkara_test',
  institution_name: 'Chitkara University',
  country_code: 'IN',
  programmes: {
    computer_science: {
      programme_name: 'BE Computer Science & Engineering',
      qualification: 'Bachelor of Engineering',
      learning_areas: ['Data Structures', 'Cloud Computing', 'Full Stack Development', 'AI/ML'],
      projects: ['Semester Capstone', 'Full-stack Web Applications'],
      labs: ['Computing Architecture Lab', 'AI Innovation Lab'],
      internships: ['6-month Semester Industrial Training', 'Summer Industry Internship'],
      competitions: ['Smart India Hackathon', 'Campus Coding Competitions'],
      career_paths: ['Software Engineer', 'Systems Analyst', 'Data Engineer'],
    },
    mechanical_engineering: {
      programme_name: 'BE Mechanical Engineering',
      qualification: 'Bachelor of Engineering',
      learning_areas: ['Thermodynamics', 'CAD/CAM Modeling', 'Manufacturing Processes', 'Mechatronics'],
      projects: ['Automotive Prototype Build', 'Robotics Capstone'],
      labs: ['Thermal Engineering Lab', 'CNC Machining Workshop'],
      internships: ['Industrial Training in Manufacturing Facility'],
      competitions: ['BAJA SAE', 'Formula Student'],
      career_paths: ['Design Engineer', 'Operations Trainee', 'Production Engineer'],
    },
    finance_business: {
      programme_name: 'BBA Finance & Banking',
      qualification: 'Bachelor of Business Administration',
      learning_areas: ['Corporate Finance', 'Investment Analysis', 'Financial Modeling', 'Banking Operations'],
      projects: ['Equity Research Valuation Report', 'Portfolio Simulation'],
      labs: ['Bloomberg / Financial Analytics Terminal'],
      internships: ['Summer Banking Internship', 'Corporate Finance Training'],
      competitions: ['National Case Study Competitions'],
      career_paths: ['Financial Analyst', 'Investment Banking Associate', 'Risk Analyst'],
    },
    nursing_healthcare: {
      programme_name: 'BSc Nursing',
      qualification: 'Bachelor of Science in Nursing',
      learning_areas: ['Clinical Patient Care', 'Pharmacology', 'Surgical Nursing', 'Community Health'],
      clinical_experience: ['Hospital Bedside Rotations', 'ICU Postings', 'Rural Community Health Centre Duty'],
      practicum: ['Direct Patient Vital Monitoring', 'Medication Administration Protocol'],
      competitions: ['Healthcare Simulation Olympiads'],
      career_paths: ['Clinical Staff Nurse', 'Critical Care Nurse', 'Healthcare Coordinator'],
    },
    hospitality: {
      programme_name: 'BSc Hospitality & Hotel Administration',
      qualification: 'Bachelor of Science',
      learning_areas: ['Front Office Operations', 'Food & Beverage Service', 'Culinary Arts', 'Housekeeping Management'],
      practicum: ['Training Restaurant Operations', 'Commercial Kitchen Production'],
      internships: ['6-Month Hotel Industrial Exposure Training'],
      career_paths: ['Management Trainee', 'Front Office Executive', 'F&B Operations Associate'],
    },
    design: {
      programme_name: 'BDes User Experience & Interaction Design',
      qualification: 'Bachelor of Design',
      learning_areas: ['User Research', 'Wireframing & Prototyping', 'Design Systems', 'Usability Testing'],
      projects: ['Industry Live Design Briefs', 'End-to-End Mobile App Redesign'],
      labs: ['Usability & Eye-Tracking Testing Lab'],
      internships: ['Design Studio Summer Internship'],
      competitions: ['Global Design Awards', 'UX Hackathons'],
      career_paths: ['Product Designer', 'UX/UI Designer', 'Interaction Specialist'],
    },
  },
};

/**
 * Resolves the appropriate term for a canonical education concept following strict priority:
 * 1. Student-stated preferred terminology (override)
 * 2. Programme context (if supplied)
 * 3. Country-specific terminology pack
 * 4. Generic global fallback
 */
export function resolveEducationTerm(
  concept: CanonicalEducationConcept,
  profile?: CandidateProfile,
  programmeContext?: InstitutionContextPack['programmes'][string],
): string {
  // 1. Student-stated facts & preferred terminology
  if (profile?.preferred_education_terms && profile.preferred_education_terms[concept]) {
    return profile.preferred_education_terms[concept]!;
  }

  // 2. Programme context hooks (e.g. clinical rotations for nursing vs industrial training for engineering)
  if (programmeContext) {
    if (concept === 'PRACTICAL_WORK_EXPOSURE') {
      if (programmeContext.clinical_experience?.length) return 'clinical rotation or hospital posting';
      if (programmeContext.practicum?.length) return 'practicum or operational training';
      if (programmeContext.internships?.length) return programmeContext.internships[0].toLowerCase();
    }
    if (concept === 'CAPSTONE' && programmeContext.projects?.length) {
      return programmeContext.projects[0].toLowerCase();
    }
  }

  // 3. Country-specific terminology pack
  const code = profile?.country_code?.toUpperCase();
  if (code && GLOBAL_COUNTRY_PACKS[code]) {
    const pack = GLOBAL_COUNTRY_PACKS[code];
    return pack.concept_terms[concept] || GENERIC_DEFAULT_PACK.concept_terms[concept];
  }

  // 4. Generic global fallback
  return GENERIC_DEFAULT_PACK.concept_terms[concept];
}

/**
 * Builds the BROADEN_SETTING interviewer phrasing appropriate to the student's country
 * and preferred vocabulary without making unsupported assumptions.
 */
export function buildBroadenSettingPrompt(profile?: CandidateProfile): string {
  // If student explicitly provided a preferred term for practical exposure, reflect it
  const preferredPractical = profile?.preferred_education_terms?.['PRACTICAL_WORK_EXPOSURE'];
  const preferredCapstone = profile?.preferred_education_terms?.['CAPSTONE'];

  const code = profile?.country_code?.toUpperCase();

  // Canada
  if (code === 'CA') {
    const practical = preferredPractical || 'co-op';
    const capstone = preferredCapstone || 'a capstone';
    return `What example from your coursework, ${capstone}, ${practical} or volunteering could you share instead?`;
  }

  // India
  if (code === 'IN') {
    const practical = preferredPractical || 'industrial training';
    const capstone = preferredCapstone || 'your final-year project';
    return `What example from your coursework, ${capstone}, ${practical} or volunteering could you share instead?`;
  }

  // Uganda or Kenya
  if (code === 'UG' || code === 'KE') {
    const practical = preferredPractical || 'industrial attachment';
    const capstone = preferredCapstone || 'a project';
    return `What example from your coursework, ${capstone}, ${practical} or volunteering could you share instead?`;
  }

  // Ghana
  if (code === 'GH') {
    const practical = preferredPractical || 'industrial attachment';
    const capstone = preferredCapstone || 'a final-year project';
    return `What example from your coursework, ${capstone}, ${practical} or volunteering could you share instead?`;
  }

  // USA
  if (code === 'US') {
    const practical = preferredPractical || 'an internship';
    const capstone = preferredCapstone || 'a senior capstone';
    return `What example from your coursework, ${capstone}, ${practical} or volunteering could you share instead?`;
  }

  // China
  if (code === 'CN') {
    const practical = preferredPractical || 'an internship';
    const capstone = preferredCapstone || 'a graduation project';
    return `What example from your coursework, ${capstone}, ${practical} or practical projects could you share instead?`;
  }

  // Generic fallback
  return 'What example from your university, project, volunteering or other practical experience could you share instead?';
}

/**
 * Detects whether candidate answer contains a terminology correction such as:
 * "We call it industrial attachment"
 * "In my university we call it co-op"
 * "We refer to it as industrial training"
 */
export function detectStudentTerminologyCorrection(
  answer: string,
): { concept: CanonicalEducationConcept; term: string } | null {
  if (!answer || typeof answer !== 'string') return null;

  const normalized = answer.trim();

  // Pattern: (we|I|in our university) call it (as) <term> (in our university)
  const matchCallIt = normalized.match(/(?:(?:we|i|in\s+(?:our|my)\s+(?:university|college|programme|program|country))\s+)?(?:call|refer to)\s+it\s+(?:as\s+)?([a-z0-9\s\-]+?)(?:\s+in\s+(?:our|my)\s+(?:university|college|programme|program|country))?[.,;!]/i)
    || normalized.match(/(?:(?:we|i|in\s+(?:our|my)\s+(?:university|college|programme|program|country))\s+)?(?:call|refer to)\s+it\s+(?:as\s+)?([a-z0-9\s\-]+?)$/i);

  if (matchCallIt) {
    const extracted = matchCallIt[1].trim().toLowerCase();
    if (extracted.includes('industrial attachment') || extracted.includes('attachment')) {
      return { concept: 'PRACTICAL_WORK_EXPOSURE', term: 'industrial attachment' };
    }
    if (extracted.includes('industrial training')) {
      return { concept: 'PRACTICAL_WORK_EXPOSURE', term: 'industrial training' };
    }
    if (extracted.includes('co-op') || extracted.includes('coop')) {
      return { concept: 'PRACTICAL_WORK_EXPOSURE', term: 'co-op' };
    }
    if (extracted.includes('practicum')) {
      return { concept: 'PRACTICAL_WORK_EXPOSURE', term: 'practicum' };
    }
    if (extracted.includes('clinical') || extracted.includes('posting')) {
      return { concept: 'CLINICAL_PLACEMENT', term: 'clinical rotation' };
    }
    if (extracted.includes('capstone')) {
      return { concept: 'CAPSTONE', term: 'capstone' };
    }
    if (extracted.includes('final-year project') || extracted.includes('final year project')) {
      return { concept: 'CAPSTONE', term: 'final-year project' };
    }
  }

  return null;
}
