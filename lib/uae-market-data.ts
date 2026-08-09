export interface UaeMarketReality {
  demandDirection: string;
  competition: string;
  typicalRequirements: string[];
  confidence: string;
}

const DEFAULT_REALITY: UaeMarketReality = {
  demandDirection: "Vacancies exist, but demand changes by job title and emirate",
  competition: "Competitive — compare your evidence with current adverts",
  typicalRequirements: [
    "Experience doing the main tasks in the advert",
    "Clear spoken and written communication for the role",
    "Any licence, certificate or work permit the employer says is essential",
    "Examples that show reliability, safety and results",
  ],
  confidence: "Medium — broad UAE guidance, not a live vacancy count",
};

const BY_INDUSTRY: Record<string, UaeMarketReality> = {
  hospitality: {
    demandDirection: "Active hiring, shaped by season, property and department",
    competition: "High for well-known employers and guest-facing roles",
    typicalRequirements: [
      "Guest service or customer-facing examples",
      "Useful languages for the guests and team",
      "Shift flexibility and role-specific hotel or food-service systems",
      "Food safety, hygiene or other certificates where the role requires them",
    ],
    confidence: "Medium — broad UAE hospitality guidance; verify current property adverts",
  },
  logistics: {
    demandDirection: "Active but role-specific across warehousing, transport and supply chain",
    competition: "Moderate to high at entry level; evidence and systems knowledge help",
    typicalRequirements: [
      "Stock, warehouse, dispatch or transport-process experience",
      "Accuracy, safety and shift reliability",
      "Excel, warehouse systems or handheld-scanner experience where requested",
      "A relevant driving licence only where the job genuinely requires driving",
    ],
    confidence: "Medium — broad UAE logistics guidance; verify current employer adverts",
  },
  trades: {
    demandDirection: "Project-led demand that varies by trade and contract",
    competition: "Moderate; recognised trade proof and site experience matter",
    typicalRequirements: [
      "Trade-specific practical experience",
      "Safety training and authorised site practice",
      "Ability to read instructions, drawings or checklists where required",
      "A licence or local approval for regulated work",
    ],
    confidence: "Medium — broad UAE construction guidance; verify the project and trade",
  },
  care: {
    demandDirection: "Ongoing need, with strict role and licensing requirements",
    competition: "Varies by specialty; eligibility can matter before applications",
    typicalRequirements: [
      "The correct professional licence or eligibility for the emirate",
      "Verified education, experience and good-standing documents",
      "Safe clinical evidence within your authorised scope",
      "Communication suitable for patients and multidisciplinary teams",
    ],
    confidence: "High on the need to verify licensing; demand remains role-specific",
  },
  education: {
    demandDirection: "School-cycle hiring with role-specific qualification checks",
    competition: "High for established schools and popular subjects",
    typicalRequirements: [
      "Relevant teaching or support qualification where required",
      "Safeguarding, classroom or learner-support evidence",
      "Clear communication with pupils, parents and colleagues",
      "Attested documents or regulator approval where the role requires them",
    ],
    confidence: "Medium — broad UAE education guidance; verify the school and regulator",
  },
  technology: {
    demandDirection: "Selective hiring with strong demand for proven specialist skills",
    competition: "High for general roles; stronger where evidence matches the exact stack",
    typicalRequirements: [
      "Current tools named in the advert",
      "Work samples, measurable projects or production experience",
      "Data, AI and cyber awareness relevant to the job",
      "Clear explanation of decisions, trade-offs and results",
    ],
    confidence: "Medium — broad UAE technology guidance; verify the exact role and tools",
  },
  retail: {
    demandDirection: "Active but seasonal and employer-specific",
    competition: "High at entry level; language, product and sales evidence can separate candidates",
    typicalRequirements: [
      "Customer service, sales or till experience",
      "Useful languages and confident product explanation",
      "Shift availability and reliable attendance",
      "Examples of targets, service recovery or stock accuracy",
    ],
    confidence: "Medium — broad UAE retail guidance; verify current brand adverts",
  },
};

export const UAE_MARKET_CHECKED = "4 August 2026";

export const UAE_MARKET_SOURCES = [
  {
    label: "UAE Labour Market Observatory",
    url: "https://observatory.mohre.gov.ae/en/",
  },
  {
    label: "Official UAE private-sector employment guide",
    url: "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector",
  },
];

export function getUaeMarketReality(industry?: string): UaeMarketReality {
  return BY_INDUSTRY[industry || ""] || DEFAULT_REALITY;
}
