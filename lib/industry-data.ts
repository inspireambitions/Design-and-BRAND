import type { RoleKnowledge } from "./careers-data";
import type { ProjectRec } from "./types";
import { HOSPITALITY_ROLE_TITLES } from "./hospitality-data";

export const INDUSTRY_OPTIONS = [
  { value: "logistics", label: "Warehouse, logistics and supply chain" },
  { value: "trades", label: "Construction and skilled trades" },
  { value: "care", label: "Healthcare and care work" },
  { value: "education", label: "Education and childcare" },
  { value: "retail", label: "Retail and customer service" },
  { value: "administration", label: "Office and administration" },
  { value: "finance", label: "Accounting and finance support" },
  { value: "sales", label: "Sales and marketing" },
  { value: "technology", label: "IT, digital and technology" },
  { value: "manufacturing", label: "Manufacturing and production" },
  { value: "transport", label: "Transport and delivery" },
  { value: "security", label: "Security and safety" },
  { value: "facilities", label: "Cleaning and facilities" },
  { value: "beauty", label: "Beauty, fitness and wellness" },
  { value: "hospitality", label: "Hospitality, food and tourism" },
  { value: "business", label: "Small business and self-employment" },
  { value: "agriculture", label: "Agriculture and food production" },
  { value: "other", label: "Something else" },
] as const;

export type IndustryValue = typeof INDUSTRY_OPTIONS[number]["value"];

export const CURRENT_ROLE_SUGGESTIONS: Record<string, string[]> = {
  logistics: ["Warehouse Assistant", "Picker / Packer", "Storekeeper", "Forklift Operator", "Inventory Clerk", "Dispatcher"],
  trades: ["Construction Helper", "Electrician's Mate", "Plumber's Helper", "Painter", "Carpenter", "Maintenance Worker"],
  care: ["Care Assistant", "Healthcare Assistant", "Nursing Assistant", "Support Worker", "Clinic Receptionist", "Community Worker"],
  education: ["Teaching Assistant", "Teacher", "Nursery Assistant", "Tutor", "School Administrator", "Youth Worker"],
  retail: ["Shop Assistant", "Cashier", "Customer Service Agent", "Call Centre Agent", "Merchandiser", "Retail Supervisor"],
  administration: ["Office Assistant", "Receptionist", "Administrative Assistant", "Data Entry Clerk", "Personal Assistant", "Document Controller"],
  finance: ["Accounts Assistant", "Bookkeeper", "Payroll Assistant", "Billing Clerk", "Cashier", "Credit Controller"],
  sales: ["Sales Assistant", "Sales Representative", "Telesales Agent", "Marketing Assistant", "Social Media Assistant", "Business Development Executive"],
  technology: ["IT Support Assistant", "Help Desk Agent", "Computer Technician", "Data Entry Clerk", "Junior Developer", "Systems Assistant"],
  manufacturing: ["Production Worker", "Machine Operator", "Quality Checker", "Assembly Worker", "Production Planner", "Team Leader"],
  transport: ["Delivery Rider", "Driver", "Driver's Assistant", "Courier", "Transport Coordinator", "Fleet Assistant"],
  security: ["Security Guard", "CCTV Operator", "Loss Prevention Officer", "Safety Assistant", "Security Supervisor", "Control Room Operator"],
  facilities: ["Cleaner", "Housekeeper", "Caretaker", "Facilities Assistant", "Maintenance Assistant", "Cleaning Supervisor"],
  beauty: ["Salon Assistant", "Hairdresser", "Barber", "Beauty Therapist", "Fitness Assistant", "Spa Therapist"],
  hospitality: ["Waiter", "Barista", "Receptionist", "Room Attendant", "Commis Chef", "Guest Service Agent"],
  business: ["Market Seller", "Online Seller", "Freelancer", "Small Business Owner", "Craft Maker", "Service Provider"],
  agriculture: ["Farm Worker", "Food Production Worker", "Packhouse Worker", "Irrigation Assistant", "Livestock Assistant", "Quality Checker"],
  other: ["Student", "Unemployed", "Volunteer", "Recent Graduate"],
};

export const INDUSTRY_SKILLS: Record<string, string[]> = {
  logistics: ["Stock control", "Picking and packing", "Following safety rules", "Using scanners", "Checking details", "Dispatch paperwork"],
  trades: ["Using tools", "Reading measurements", "Repairs", "Following safety rules", "Troubleshooting", "Practical work"],
  care: ["Helping people", "Personal care", "Safeguarding", "Keeping records", "Patience", "Following care plans"],
  education: ["Teaching", "Explaining clearly", "Child safeguarding", "Lesson preparation", "Behaviour support", "Keeping records"],
  retail: ["Helping customers", "Cash handling", "Stock work", "Handling complaints", "Selling", "Visual display"],
  administration: ["Filing", "Data entry", "Scheduling", "Email", "Document control", "Meeting support"],
  finance: ["Bookkeeping", "Invoices", "Payroll", "Cash handling", "Reconciliation", "Checking figures"],
  sales: ["Finding customers", "Selling", "Following up", "Social media", "Writing offers", "Negotiation"],
  technology: ["Computer setup", "Troubleshooting", "Help desk support", "Networking basics", "Data entry", "Cyber safety"],
  manufacturing: ["Machine operation", "Quality checks", "Following safety rules", "Production targets", "Basic maintenance", "Team handovers"],
  transport: ["Route planning", "Safe driving", "Delivery paperwork", "Vehicle checks", "Customer service", "Timekeeping"],
  security: ["Access control", "CCTV monitoring", "Incident reports", "Patrolling", "Emergency response", "Conflict management"],
  facilities: ["Cleaning standards", "Chemical safety", "Basic maintenance", "Inspection", "Stock control", "Team supervision"],
  beauty: ["Client care", "Hygiene", "Treatments", "Consultations", "Selling products", "Appointment booking"],
  business: ["Finding customers", "Pricing", "Cash flow", "Buying stock", "Selling online", "Record keeping"],
  agriculture: ["Crop care", "Food hygiene", "Using farm tools", "Quality checks", "Packing", "Following safety rules"],
};

type RoleInput = {
  role: string;
  industry: string;
  aliases: string[];
  skills: [string, string, string, string];
  difficulty: number;
  demand: string;
  planB: string;
  projects: ProjectRec[];
  safetyCritical?: boolean;
  regulatedNotice?: string;
};

function role(input: RoleInput): RoleKnowledge {
  const verify = input.safetyCritical
    ? "Use the official regulator, licensing body or an employer-approved provider. Do not rely on an online certificate alone."
    : "Compare current job adverts and choose training that employers in your location actually recognise.";
  return {
    role: input.role,
    industry: input.industry,
    aliases: input.aliases,
    coreSkills: input.skills.map((skill, index) => ({
      skill,
      priority: index < 2 ? "high" : index === 2 ? "medium" : "low",
      how: index === 0 ? `Practise this through supervised work or a real small task. ${verify}` : `Build evidence through real work, supervised practice or a short recognised course; record what you did and the result.`,
    })),
    courses: [
      { name: `Recognised local ${input.role} foundation`, provider: "Official regulator, vocational college or employer-approved provider", cost: "Check locally before paying", duration: "Varies by country and licence", rating: "Verify", why: verify, badge: "Verify recognition first", minBudget: 0 },
      { name: `Supervised ${input.role} workplace practice`, provider: "Current employer, apprenticeship or approved training centre", cost: "Often free or employer-supported", duration: "2–12 weeks to begin", rating: "Work-based", why: "Creates evidence of safe, real performance rather than a certificate with no practice.", badge: "Best evidence", minBudget: 0 },
      { name: "Role-specific short course", provider: "Accredited local provider", cost: "Compare at least three providers", duration: "Varies", rating: "Check recent employer acceptance", why: "Only choose this after confirming it appears in current job adverts or is accepted by employers.", minBudget: 500 },
    ],
    salary: [
      { stage: "Starting role", range: "Check current local adverts", note: "Compare at least 10 recent vacancies in your intended location", pct: 40 },
      { stage: "With proven experience", range: "Verify locally", note: "Responsibility, shift patterns, licence and sector can change pay", pct: 65 },
      { stage: "Supervisor or specialist", range: "Verify locally", note: "Use official statistics and live vacancies, not a global average", pct: 85 },
      { stage: "Manager or business route", range: "Varies widely", note: "Business income is not guaranteed and should be planned separately", pct: 100 },
    ],
    communities: ["A recognised local trade or professional association", "Current workers in the role", "Employer open days or approved training centres"],
    people: ["A working supervisor in the role", "An approved trainer", "A recruiter who hires this job in your location"],
    events: ["Employer recruitment or open day", "Vocational college information session", "Local trade or industry event"],
    dayInLife: [
      { time: "Start", activity: "Check the day's work, safety needs and priorities" },
      { time: "Morning", activity: `Complete the main practical or service work of a ${input.role}` },
      { time: "Midday", activity: "Update records, hand over work or coordinate with the team" },
      { time: "Afternoon", activity: "Handle problems, quality checks and customer or colleague requests" },
      { time: "End", activity: "Record results, prepare the next shift and report risks" },
    ],
    demand: input.demand,
    difficultyBase: input.difficulty,
    planB: input.planB,
    frameworks: ["Situation → action → measurable result", "Safety and quality first", "Show evidence from real or supervised work"],
    evidenceProjects: input.projects,
    safetyCritical: input.safetyCritical,
    regulatedNotice: input.regulatedNotice,
  };
}

const standardProjects = (roleName: string, work: string, evidence: string): ProjectRec[] => [
  { title: `Improve one real ${work} result`, description: `Choose a small problem at work or with permission from a local organisation. Record the starting point, what you changed and the result. Do not use confidential information.`, skills: [work, "Problem solving", "Record keeping"], effort: "1–3 weeks" },
  { title: `Create a simple ${roleName} evidence pack`, description: `Collect safe examples such as a checklist, anonymised work record, process map, supervisor feedback or before-and-after measure. ${evidence}`, skills: ["Communication", "Quality", "Work evidence"], effort: "3–5 hours" },
  { title: "Ask a working professional to review your readiness", description: "Use a short checklist from current job adverts. Ask what you can already do, what needs supervised practice and which requirement must be formally verified.", skills: ["Career research", "Feedback"], effort: "Two conversations" },
];

export const TYPICAL_TARGETS: RoleKnowledge[] = [
  role({ role: "Logistics Coordinator", industry: "logistics", aliases: ["warehouse coordinator", "logistics assistant", "supply chain coordinator", "inventory coordinator"], skills: ["Inventory and stock control", "Dispatch planning", "Spreadsheet and system accuracy", "Safety and problem solving"], difficulty: 4, demand: "Common across retail, distribution, manufacturing and e-commerce; check live demand in your city.", planB: "Inventory Clerk, Dispatcher or Warehouse Team Leader.", projects: standardProjects("Logistics Coordinator", "stock or dispatch", "Use anonymised figures and obtain workplace permission.") }),
  role({ role: "Electrician", industry: "trades", aliases: ["electrical technician", "electrical installer", "electrician apprentice"], skills: ["Electrical safety", "Installation and maintenance", "Fault finding", "Reading diagrams"], difficulty: 7, demand: "Needed across construction and maintenance, but licence and scope rules differ sharply by country.", planB: "Electrical Mate, Maintenance Assistant or approved apprenticeship.", safetyCritical: true, regulatedNotice: "Electrical work can injure or kill. Verify the local licence, supervised-hours and safety requirements. Never practise on live systems without authorised supervision.", projects: standardProjects("Electrician", "maintenance or safety", "Use only diagrams, checklists, de-energised training boards or authorised supervised work; never live unsupervised work.") }),
  role({ role: "Care Supervisor", industry: "care", aliases: ["senior carer", "care team leader", "healthcare supervisor", "support worker supervisor"], skills: ["Safe person-centred care", "Safeguarding", "Care records and handovers", "Team support"], difficulty: 6, demand: "Care services often recruit, but registration, background checks and approved qualifications vary by location.", planB: "Care Assistant, Support Worker or Healthcare Assistant while completing recognised requirements.", safetyCritical: true, regulatedNotice: "Care work may require approved qualifications, background checks, registration and supervised practice. Do not perform clinical or personal-care tasks outside your authorised scope.", projects: standardProjects("Care Supervisor", "care quality", "Use fictional or fully anonymised examples and follow safeguarding and confidentiality rules.") }),
  role({ role: "Teaching Assistant", industry: "education", aliases: ["classroom assistant", "learning support assistant", "teacher aide", "nursery assistant"], skills: ["Learning support", "Safeguarding", "Clear communication", "Classroom organisation"], difficulty: 4, demand: "Demand varies by school system; safeguarding checks and recognised childcare requirements may apply.", planB: "Tutor, School Administrator or supervised volunteer placement.", safetyCritical: true, regulatedNotice: "Work with children requires safeguarding, background checks and clear role boundaries. Use approved placements and never use identifiable pupil information.", projects: standardProjects("Teaching Assistant", "learning support", "Use fictional learner profiles or approved anonymised examples only.") }),
  role({ role: "Customer Service Supervisor", industry: "retail", aliases: ["retail supervisor", "call centre supervisor", "customer service team leader", "shop supervisor"], skills: ["Customer problem solving", "Coaching a team", "Service measures", "Cash and stock awareness"], difficulty: 4, demand: "Widely used across retail, contact centres, banking, travel and services.", planB: "Senior Customer Service Agent, Sales Supervisor or Quality Coach.", projects: standardProjects("Customer Service Supervisor", "customer service", "Remove customer names and private data.") }),
  role({ role: "Administrative Coordinator", industry: "administration", aliases: ["administrative assistant", "office coordinator", "office administrator", "admin coordinator", "document controller"], skills: ["Document and diary control", "Clear business communication", "Spreadsheets and office systems", "Confidentiality"], difficulty: 3, demand: "Common in most sectors; digital organisation and accuracy are frequent screening requirements.", planB: "Receptionist, Data Entry Clerk, Office Assistant or Virtual Assistant.", projects: standardProjects("Administrative Coordinator", "office process", "Use invented or anonymised documents.") }),
  role({ role: "Bookkeeping and Accounts Assistant", industry: "finance", aliases: ["accounts assistant", "bookkeeper", "finance assistant", "payroll assistant", "billing clerk"], skills: ["Bookkeeping and reconciliation", "Invoice and payment accuracy", "Spreadsheet or accounting software", "Confidentiality and controls"], difficulty: 5, demand: "Common in small and medium businesses; recognised accounting pathways differ by country.", planB: "Billing Clerk, Accounts Payable Assistant or Payroll Assistant.", regulatedNotice: "Check which accounting qualification and software employers in your location actually request. Do not present yourself as a licensed accountant unless you are one.", projects: standardProjects("Accounts Assistant", "bookkeeping", "Use a fictional company dataset; never use real financial data without permission.") }),
  role({ role: "Sales Representative", industry: "sales", aliases: ["sales executive", "business development representative", "telesales", "account representative"], skills: ["Finding and qualifying customers", "Needs-based selling", "Follow-up and record keeping", "Negotiation"], difficulty: 4, demand: "Used across nearly every sector; product knowledge and evidence of results matter more than one universal certificate.", planB: "Sales Assistant, Customer Service Agent or Merchandiser.", projects: standardProjects("Sales Representative", "sales process", "Use an ethical offer and obtain permission before contacting people.") }),
  role({ role: "IT Support Technician", industry: "technology", aliases: ["help desk technician", "desktop support", "computer technician", "it support specialist"], skills: ["Troubleshooting", "Computer and account setup", "Networking basics", "Security and documentation"], difficulty: 5, demand: "A common entry point into technology across offices, schools, hotels and service companies.", planB: "Help Desk Agent, Systems Assistant or Technical Customer Support.", projects: standardProjects("IT Support Technician", "support process", "Use your own test devices or authorised lab systems; never access accounts without permission.") }),
  role({ role: "Production Team Leader", industry: "manufacturing", aliases: ["manufacturing supervisor", "production supervisor", "line leader", "factory team leader"], skills: ["Safe production control", "Quality checks", "Team handovers", "Basic improvement methods"], difficulty: 5, demand: "Common in factories, food production and assembly; sector-specific safety or hygiene certificates may apply.", planB: "Machine Operator, Quality Checker or Production Planner.", safetyCritical: true, regulatedNotice: "Machine, food and chemical work require employer-approved safety training. Do not operate equipment or change processes without authorisation.", projects: standardProjects("Production Team Leader", "production quality", "Use observations and authorised improvements; never bypass a safety control.") }),
  role({ role: "Transport Coordinator", industry: "transport", aliases: ["fleet coordinator", "delivery coordinator", "transport planner", "route coordinator"], skills: ["Route and schedule planning", "Vehicle and driver records", "Delivery communication", "Safety and compliance"], difficulty: 4, demand: "Common in delivery, retail, construction and logistics; driving and operator rules vary locally.", planB: "Dispatcher, Fleet Assistant or Delivery Controller.", safetyCritical: true, regulatedNotice: "Driving and fleet work may require valid local licences, medical checks, insurance and regulated working hours. Verify all requirements before accepting duties.", projects: standardProjects("Transport Coordinator", "route or delivery", "Use a paper exercise or authorised historical data; safety takes priority over speed.") }),
  role({ role: "Security Supervisor", industry: "security", aliases: ["security team leader", "security officer supervisor", "loss prevention supervisor", "cctv supervisor"], skills: ["Access and incident control", "Emergency response", "Clear reports", "Team briefing"], difficulty: 5, demand: "Demand exists across property, retail, events and industry; licensing and background checks are location-specific.", planB: "Security Officer, CCTV Operator or Loss Prevention Officer.", safetyCritical: true, regulatedNotice: "Security duties may require a local licence, background checks and approved first-aid or emergency training. Do not practise restraint or confrontation techniques without authorised instruction.", projects: standardProjects("Security Supervisor", "incident prevention", "Use tabletop scenarios and authorised drills, never staged confrontations.") }),
  role({ role: "Facilities Supervisor", industry: "facilities", aliases: ["cleaning supervisor", "facilities coordinator", "caretaker supervisor", "soft services supervisor"], skills: ["Cleaning and inspection standards", "Chemical and equipment safety", "Work scheduling", "Stock and team control"], difficulty: 4, demand: "Common across offices, schools, healthcare, residential property and hospitality.", planB: "Facilities Assistant, Cleaning Team Leader or Maintenance Coordinator.", safetyCritical: true, regulatedNotice: "Chemical, height and equipment work requires safety data, protective equipment and employer-approved training. Do not mix chemicals or attempt repairs outside your authority.", projects: standardProjects("Facilities Supervisor", "cleaning or facilities", "Use inspections and approved process changes; do not create chemical or equipment risks.") }),
  role({ role: "Beauty Therapist", industry: "beauty", aliases: ["beautician", "spa therapist", "skin therapist", "salon therapist"], skills: ["Client consultation and hygiene", "Safe treatment technique", "Booking and customer care", "Product knowledge"], difficulty: 5, demand: "Demand depends on location and service; some treatments require formal qualifications or health approvals.", planB: "Salon Assistant, Spa Receptionist or Beauty Retail Adviser.", safetyCritical: true, regulatedNotice: "Treatments can affect health and skin. Verify approved qualifications, hygiene rules, insurance and the legal scope of each service before practising on clients.", projects: standardProjects("Beauty Therapist", "client service", "Use consultation templates and training mannequins or approved supervised practice.") }),
  role({ role: "Small Business Owner", industry: "business", aliases: ["entrepreneur", "self employed", "business owner", "online seller", "freelancer"], skills: ["Finding a real customer problem", "Pricing and cash flow", "Selling and follow-up", "Simple operations"], difficulty: 7, demand: "Business income is uncertain; demand must be tested with real customers before spending heavily.", planB: "Run a small side service or online sales test while keeping stable income.", regulatedNotice: "Check local business registration, tax, licence, insurance and consumer rules. Never borrow heavily before testing demand.", projects: standardProjects("Small Business Owner", "customer or sales", "Start with a low-cost test and record revenue, costs and customer feedback honestly.") }),
  role({ role: "Food Production Quality Assistant", industry: "agriculture", aliases: ["food quality assistant", "farm quality assistant", "packhouse quality checker", "food production assistant"], skills: ["Food hygiene and quality checks", "Traceability records", "Safe handling", "Inspection and reporting"], difficulty: 4, demand: "Used in farms, packhouses and food factories; approved food-safety training often matters.", planB: "Production Worker, Packhouse Worker or Quality Checker.", safetyCritical: true, regulatedNotice: "Food and farm work may involve machinery, chemicals and hygiene law. Follow approved training and never change a safety or food-control process without authority.", projects: standardProjects("Food Quality Assistant", "food quality", "Use approved checklists or fictional records and never interfere with live safety controls.") }),
];

export function getTargetRolesForIndustry(industry?: string): { role: string }[] {
  if (!industry || industry === "other") return TYPICAL_TARGETS;
  if (industry === "hospitality") return HOSPITALITY_ROLE_TITLES.map((role) => ({ role }));
  return TYPICAL_TARGETS.filter((target) => target.industry === industry);
}
