import type { CourseRec, SalaryStage } from "./types";

export interface RoleKnowledge {
  role: string;
  aliases: string[];
  coreSkills: { skill: string; priority: "high" | "medium" | "low"; how: string }[];
  courses: (CourseRec & { minBudget: number })[];
  salary: SalaryStage[];
  communities: string[];
  people: string[];
  events: string[];
  dayInLife: { time: string; activity: string }[];
  demand: string;
  difficultyBase: number;
  planB: string;
  frameworks: string[];
}

export const POPULAR_TARGETS: RoleKnowledge[] = [
  {
    role: "UX Designer",
    aliases: ["ux", "ux designer", "product designer", "ui/ux", "ui designer", "designer"],
    coreSkills: [
      { skill: "User Research", priority: "high", how: "Practice interviews + NN/g articles; run 3 usability tests on real products" },
      { skill: "Figma & Prototyping", priority: "high", how: "Figma's free Essentials course (8 hrs), then rebuild 3 apps you use daily" },
      { skill: "Information Architecture", priority: "medium", how: "Nielsen Norman Group articles + a card-sorting practice project" },
      { skill: "Interaction Design", priority: "high", how: "Google UX Certificate modules 3–4 + daily UI pattern analysis" },
      { skill: "Visual Design Fundamentals", priority: "medium", how: "Refactoring UI (book) + typography/spacing drills" },
      { skill: "Design Systems", priority: "low", how: "Study Material Design and Polaris; contribute to an open-source system" },
      { skill: "Stakeholder Communication", priority: "medium", how: "Often transferable — reframe presentations and cross-team work" },
    ],
    courses: [
      { name: "Google UX Design Professional Certificate", provider: "Coursera · Google", cost: "$49/mo (≈$300 total)", duration: "6 months part-time", rating: "4.8/5", why: "7-course series covering research, wireframing, prototyping, and testing. Highly regarded by hiring managers for career switchers.", badge: "Best for career switchers", minBudget: 500, url: "https://www.coursera.org/professional-certificates/google-ux-design" },
      { name: "Figma Learn: Design Essentials", provider: "Figma", cost: "Free", duration: "8 hours", rating: "4.7/5", why: "The fastest path to tool fluency — do this in week one.", badge: "Start here, free", minBudget: 0, url: "https://www.figma.com/resource-library/design-basics/" },
      { name: "DesignLab UX Academy", provider: "DesignLab", cost: "$7,249", duration: "6 months intensive", rating: "4.6/5", why: "1-on-1 mentorship and a job guarantee — only worth it if budget is flexible and you want structure.", badge: "Premium mentorship", minBudget: 5000 },
      { name: "Intro to UX (Free Curriculum)", provider: "The Odin-style open resources + NN/g", cost: "Free", duration: "Self-paced", rating: "4.5/5", why: "A zero-cost path: NN/g articles, Laws of UX, and public case-study teardowns.", minBudget: 0 },
    ],
    salary: [
      { stage: "First role (Junior UX)", range: "$65k – $85k", note: "Portfolio quality matters more than years of experience", pct: 40 },
      { stage: "2 years in (Mid-level)", range: "$85k – $115k", note: "Specializing (research, systems) accelerates this jump", pct: 60 },
      { stage: "4–5 years (Senior)", range: "$115k – $150k", note: "Leading projects end-to-end and mentoring juniors", pct: 80 },
      { stage: "Lead / Principal", range: "$150k – $190k+", note: "Strategy, org-level design direction", pct: 100 },
    ],
    communities: ["ADPList (free mentorship)", "Designer Hangout (Slack)", "UX Mastery Community", "r/UXDesign", "Local IxDA chapter"],
    people: ["Nielsen Norman Group (research)", "Femke van Schoonhoven (career switching)", "Joe Natoli (practical UX)", "Erika Hall (research methods)"],
    events: ["Local UX meetups (Meetup.com)", "Config by Figma (free virtual)", "UXDX conference", "Portfolio review nights on ADPList"],
    dayInLife: [
      { time: "9:00", activity: "Standup with product trio — align on the sprint's design priorities" },
      { time: "9:30", activity: "Deep work: iterate on checkout flow wireframes in Figma" },
      { time: "11:30", activity: "Usability test session — watch 2 users struggle (or not) with your prototype" },
      { time: "13:30", activity: "Synthesis: turn test notes into 3 concrete design changes" },
      { time: "15:00", activity: "Design critique — present work, absorb feedback without flinching" },
      { time: "16:00", activity: "Handoff prep: annotate specs for engineers, answer Slack questions" },
    ],
    demand: "High — every product company hires UX; AI tools raise the bar for craft but demand for judgment keeps growing",
    difficultyBase: 5,
    planB: "Product Design adjacent roles: UX Research, Content Design, or Design Ops — each reuses ~70% of the same preparation and often has less portfolio pressure.",
    frameworks: ["Design thinking (empathize → define → ideate → prototype → test)", "STAR stories built around 2 portfolio case studies", "Critique vocabulary: hierarchy, affordance, friction, accessibility"],
  },
  {
    role: "Software Engineer",
    aliases: ["software engineer", "developer", "web developer", "swe", "programmer", "frontend", "backend", "full stack", "full-stack developer"],
    coreSkills: [
      { skill: "Programming Fundamentals (JS/Python)", priority: "high", how: "The Odin Project or CS50 — build muscle memory with daily coding" },
      { skill: "Data Structures & Algorithms", priority: "high", how: "NeetCode 150 over 8–10 weeks; focus on patterns, not memorization" },
      { skill: "Git & Collaboration", priority: "high", how: "Contribute to one open-source project; open real pull requests" },
      { skill: "Web Frameworks (React/Node)", priority: "medium", how: "Build 3 full-stack projects with auth, database, and deployment" },
      { skill: "Databases & SQL", priority: "medium", how: "SQLBolt + design the schema for each portfolio project yourself" },
      { skill: "Testing & Debugging", priority: "medium", how: "Add test suites to your projects; practice reading stack traces" },
      { skill: "System Design Basics", priority: "low", how: "ByteByteGo newsletter + explain one architecture per week aloud" },
    ],
    courses: [
      { name: "CS50: Introduction to Computer Science", provider: "Harvard / edX", cost: "Free ($199 for certificate)", duration: "12 weeks", rating: "4.9/5", why: "The gold-standard foundation — teaches you how to think, not just syntax.", badge: "Best foundation", minBudget: 0, url: "https://cs50.harvard.edu/x/" },
      { name: "The Odin Project", provider: "Open source", cost: "Free", duration: "6–9 months part-time", rating: "4.8/5", why: "Full-stack curriculum with real projects; the best zero-cost path to hireable.", badge: "Best free path", minBudget: 0, url: "https://www.theodinproject.com/" },
      { name: "Scrimba Frontend Career Path", provider: "Scrimba", cost: "$30/mo", duration: "4–6 months", rating: "4.7/5", why: "Interactive, project-first; strong for visual learners moving into frontend.", minBudget: 200 },
      { name: "Launch School", provider: "Launch School", cost: "$199/mo", duration: "12–18 months", rating: "4.8/5", why: "Mastery-based and rigorous — slower but produces genuinely strong engineers.", badge: "Most rigorous", minBudget: 2000 },
    ],
    salary: [
      { stage: "First role (Junior)", range: "$70k – $95k", note: "Projects + referrals beat resume keywords", pct: 40 },
      { stage: "2 years in (Mid-level)", range: "$95k – $130k", note: "Owning features end-to-end", pct: 60 },
      { stage: "4–5 years (Senior)", range: "$130k – $180k", note: "Technical leadership and system design", pct: 82 },
      { stage: "Staff / Lead", range: "$180k – $250k+", note: "Cross-team architecture and mentorship", pct: 100 },
    ],
    communities: ["The Odin Project Discord", "CodeNewbie", "Dev.to", "r/cscareerquestions", "Local tech meetups"],
    people: ["ThePrimeagen (engineering culture)", "Dan Abramov (React)", "Cassidy Williams (career advice)", "freeCodeCamp (tutorials)"],
    events: ["Local hackathons (great for portfolio + network)", "Meetup.com JS/Python groups", "Conference volunteer slots (free entry)"],
    dayInLife: [
      { time: "9:30", activity: "Standup — report progress on your ticket, flag blockers" },
      { time: "10:00", activity: "Deep work: implement a feature branch, write tests as you go" },
      { time: "12:30", activity: "Code review — give and receive feedback on pull requests" },
      { time: "14:00", activity: "Pairing session with a senior engineer on a tricky bug" },
      { time: "15:30", activity: "Deploy to staging; watch dashboards, fix what breaks" },
      { time: "16:30", activity: "Write a short design doc for next sprint's work" },
    ],
    demand: "High but competitive at entry level — differentiation comes from real projects and domain expertise from your previous career",
    difficultyBase: 7,
    planB: "QA Automation, Technical Support Engineering, or Solutions Engineering — all value coding skills with a lower hiring bar, and commonly ladder into SWE within 18 months.",
    frameworks: ["STAR stories for behavioral rounds", "UMPIRE method for coding interviews (Understand, Match, Plan, Implement, Review, Evaluate)", "Explain-aloud practice: narrate your thinking constantly"],
  },
  {
    role: "Data Analyst",
    aliases: ["data analyst", "data analytics", "business analyst", "analytics", "bi analyst", "business intelligence"],
    coreSkills: [
      { skill: "SQL", priority: "high", how: "SQLBolt then StrataScratch problems daily — SQL is 60% of the job" },
      { skill: "Excel / Sheets (advanced)", priority: "high", how: "Often transferable — level up with pivot tables, LOOKUPs, and modeling" },
      { skill: "Data Visualization (Tableau/Power BI)", priority: "high", how: "Rebuild 5 Makeover Monday challenges; publish to Tableau Public" },
      { skill: "Statistics Fundamentals", priority: "medium", how: "Khan Academy statistics + apply to every portfolio analysis" },
      { skill: "Python (pandas)", priority: "medium", how: "Kaggle's free micro-courses; automate one analysis end-to-end" },
      { skill: "Business Storytelling", priority: "high", how: "Usually transferable — every analysis ends in a recommendation slide" },
    ],
    courses: [
      { name: "Google Data Analytics Certificate", provider: "Coursera · Google", cost: "$49/mo (≈$250 total)", duration: "6 months part-time", rating: "4.8/5", why: "The most recognized switcher credential; covers SQL, R, Tableau, and a capstone.", badge: "Best for career switchers", minBudget: 500, url: "https://www.coursera.org/professional-certificates/google-data-analytics" },
      { name: "SQLBolt + StrataScratch", provider: "Free / freemium", cost: "Free", duration: "6–8 weeks", rating: "4.7/5", why: "Interview-grade SQL skills at zero cost.", badge: "Start here, free", minBudget: 0, url: "https://sqlbolt.com/" },
      { name: "Maven Analytics Bootcamp", provider: "Maven Analytics", cost: "$39/mo", duration: "4–6 months", rating: "4.8/5", why: "Excellent project-based Power BI / Tableau / SQL tracks with portfolio datasets.", minBudget: 200 },
    ],
    salary: [
      { stage: "First role (Junior Analyst)", range: "$55k – $75k", note: "Domain knowledge from your old career is a genuine edge", pct: 38 },
      { stage: "2 years in (Analyst II)", range: "$75k – $95k", note: "Owning dashboards and stakeholder relationships", pct: 55 },
      { stage: "4–5 years (Senior Analyst)", range: "$95k – $125k", note: "Or branch to Analytics Engineer / Data Scientist", pct: 75 },
      { stage: "Lead / Manager", range: "$125k – $160k+", note: "Team leadership or deep specialization", pct: 100 },
    ],
    communities: ["Locally Optimistic (Slack)", "Data Talks Club", "r/dataanalysis", "Tableau Public community", "Maven Analytics Discord"],
    people: ["Avery Smith (career switching to data)", "Alex The Analyst (YouTube roadmaps)", "Cassie Kozyrkov (decision intelligence)"],
    events: ["Makeover Monday (weekly viz challenge)", "Local data meetups", "Tableau User Groups (free)"],
    dayInLife: [
      { time: "9:00", activity: "Check overnight dashboard alerts; triage a data quality issue" },
      { time: "10:00", activity: "Write SQL to answer a product manager's question about churn" },
      { time: "11:30", activity: "Stakeholder meeting — translate 'sales feel slow' into a measurable question" },
      { time: "13:30", activity: "Build a Tableau view for the quarterly business review" },
      { time: "15:30", activity: "Deep dive: why did signups spike Tuesday? Document findings" },
      { time: "16:30", activity: "Ship a one-page summary with a clear recommendation" },
    ],
    demand: "Strong and broadening — every function now expects data fluency; analysts who communicate well are scarce",
    difficultyBase: 4,
    planB: "Operations Analyst or Revenue/Marketing Operations — same toolkit applied inside a business function, often an easier first landing with your existing domain background.",
    frameworks: ["Hypothesis-driven analysis (question → metric → cut → recommendation)", "STAR stories around 2 portfolio analyses", "The 'so what' test for every chart"],
  },
  {
    role: "Product Manager",
    aliases: ["product manager", "pm", "product owner", "product management", "apm"],
    coreSkills: [
      { skill: "User Empathy & Discovery", priority: "high", how: "Run 5 mock discovery interviews; write problem statements, not feature lists" },
      { skill: "Prioritization & Roadmapping", priority: "high", how: "Practice RICE/opportunity scoring on a product you know deeply" },
      { skill: "Data-Informed Decisions", priority: "high", how: "SQL basics + define success metrics for 3 feature ideas" },
      { skill: "Stakeholder Management", priority: "medium", how: "Usually transferable — reframe your cross-functional wins" },
      { skill: "Technical Fluency", priority: "medium", how: "CS50 week 0–5 or a 'tech for PMs' course — enough to earn engineer trust" },
      { skill: "Product Sense & Writing", priority: "high", how: "Write 6 product teardowns; practice PRDs and one-pagers" },
    ],
    courses: [
      { name: "Reforge Product Management Foundations", provider: "Reforge", cost: "$1,995/yr", duration: "6 weeks/course", rating: "4.7/5", why: "Industry-standard for serious PMs; best once you have some context.", badge: "Industry standard", minBudget: 2000 },
      { name: "Product Management First Steps + PM Fundamentals", provider: "Product School / free resources", cost: "Free–$500", duration: "6–8 weeks", rating: "4.5/5", why: "Structured intro; pair with Lenny's Newsletter archive (free) for real-world depth.", minBudget: 0 },
      { name: "Exponent PM Interview Prep", provider: "Exponent", cost: "$149/yr", duration: "Ongoing", rating: "4.6/5", why: "The de-facto standard for PM interview practice with peer mocks.", badge: "Interview prep", minBudget: 200 },
    ],
    salary: [
      { stage: "First role (APM/PM)", range: "$85k – $115k", note: "Internal transfers land this fastest", pct: 45 },
      { stage: "2 years in (PM)", range: "$115k – $145k", note: "Owning a product area with measurable outcomes", pct: 62 },
      { stage: "4–5 years (Senior PM)", range: "$145k – $185k", note: "Strategy + zero-to-one launches", pct: 80 },
      { stage: "Group PM / Director", range: "$185k – $250k+", note: "Team and portfolio leadership", pct: 100 },
    ],
    communities: ["Lenny's Community", "Mind the Product", "Product School Slack", "r/ProductManagement"],
    people: ["Lenny Rachitsky", "Shreyas Doshi (product thinking)", "Teresa Torres (discovery)", "Marty Cagan (Inspired)"],
    events: ["ProductCon (free virtual)", "Mind the Product meetups", "Internal product council at your current company"],
    dayInLife: [
      { time: "9:00", activity: "Scan metrics dashboard; one number is off — dig in before standup" },
      { time: "9:30", activity: "Standup with engineering; unblock two decisions in 10 minutes" },
      { time: "10:30", activity: "Customer call — discovery interview for next quarter's bet" },
      { time: "12:00", activity: "Write: turn this week's learning into a crisp one-pager" },
      { time: "14:00", activity: "Roadmap review with design and engineering leads" },
      { time: "16:00", activity: "Stakeholder alignment — sales wants a feature; negotiate the real problem" },
    ],
    demand: "Competitive — the classic path is an internal transfer; switchers who bring deep domain expertise have a real edge",
    difficultyBase: 7,
    planB: "Product Operations, Program Management, or Business Analyst roles — adjacent seats at the same table that convert to PM internally more easily than external applications.",
    frameworks: ["CIRCLES for product design questions", "AARM metrics framing", "STAR+outcome stories: always end with the measurable result"],
  },
  {
    role: "Digital Marketer",
    aliases: ["digital marketer", "marketing", "growth marketer", "content marketer", "seo", "performance marketing", "social media manager"],
    coreSkills: [
      { skill: "Channel Fundamentals (SEO/paid/email)", priority: "high", how: "Google's free certifications + run one tiny real campaign ($50 budget)" },
      { skill: "Analytics (GA4)", priority: "high", how: "Google Analytics certification + instrument a personal site yourself" },
      { skill: "Copywriting", priority: "high", how: "Daily copywork; rewrite 20 landing pages; study direct-response classics" },
      { skill: "Content & AI Tooling", priority: "medium", how: "Build a repeatable content pipeline with AI assistance and human editing" },
      { skill: "Marketing Automation", priority: "medium", how: "Free HubSpot Academy certification + build a nurture sequence" },
      { skill: "Experimentation & CRO", priority: "medium", how: "Run A/B tests on your own project; document hypotheses and results" },
    ],
    courses: [
      { name: "Google Digital Marketing & E-commerce Certificate", provider: "Coursera · Google", cost: "$49/mo (≈$250)", duration: "6 months part-time", rating: "4.8/5", why: "Broad, recognized, and includes hands-on tools practice.", badge: "Best for career switchers", minBudget: 500 },
      { name: "HubSpot Academy Certifications", provider: "HubSpot", cost: "Free", duration: "2–4 weeks each", rating: "4.6/5", why: "Free, respected certificates in inbound, content, and email marketing.", badge: "Start here, free", minBudget: 0, url: "https://academy.hubspot.com/" },
      { name: "CXL Growth Marketing Minidegree", provider: "CXL", cost: "$999", duration: "3–4 months", rating: "4.7/5", why: "Taught by practitioners; the most rigorous option for growth roles.", badge: "Most rigorous", minBudget: 1000 },
    ],
    salary: [
      { stage: "First role (Coordinator/Specialist)", range: "$45k – $62k", note: "A portfolio of real campaigns shortcuts this stage", pct: 35 },
      { stage: "2 years in (Marketing Manager)", range: "$62k – $85k", note: "Channel ownership with revenue attribution", pct: 55 },
      { stage: "4–5 years (Senior/Growth Lead)", range: "$85k – $120k", note: "Full-funnel strategy", pct: 78 },
      { stage: "Head of Marketing", range: "$120k – $170k+", note: "Team + budget ownership", pct: 100 },
    ],
    communities: ["Superpath (content)", "Demand Curve community", "r/marketing", "Online Geniuses (Slack)", "Women in Tech SEO"],
    people: ["Amanda Natividad", "Ross Simmonds", "Aleyda Solis (SEO)", "Katelyn Bourgoin (buyer psychology)"],
    events: ["Local AMA (American Marketing Association) chapters", "MozCon / brightonSEO (virtual options)", "Marketing meetups"],
    dayInLife: [
      { time: "9:00", activity: "Check campaign dashboards; pause an underperforming ad set" },
      { time: "10:00", activity: "Write and schedule this week's email — subject line A/B test" },
      { time: "11:30", activity: "SEO content brief for a freelance writer" },
      { time: "13:30", activity: "Analyze last week's experiment; write up the learning" },
      { time: "15:00", activity: "Cross-functional sync with sales on lead quality" },
      { time: "16:00", activity: "Plan next month's content calendar around a product launch" },
    ],
    demand: "Steady with churn — AI is reshaping execution, so strategy + analytics + taste is the durable combination",
    difficultyBase: 3,
    planB: "Marketing Operations or Sales Enablement — more process-driven, less content pressure, and heavily hiring.",
    frameworks: ["AIDA / PAS copy frameworks", "ICE prioritization for experiments", "Portfolio-first interviews: bring the campaign, the numbers, and the lesson"],
  },
  {
    role: "Cybersecurity Analyst",
    aliases: ["cybersecurity", "security analyst", "soc analyst", "infosec", "security engineer", "cyber security"],
    coreSkills: [
      { skill: "Networking Fundamentals", priority: "high", how: "CompTIA Network+ material + build a home lab with pfSense" },
      { skill: "Security Concepts (CIA, threats)", priority: "high", how: "CompTIA Security+ — the standard entry certification" },
      { skill: "Linux & Command Line", priority: "high", how: "OverTheWire Bandit wargames; daily terminal use" },
      { skill: "SIEM & Log Analysis", priority: "medium", how: "Free Splunk Fundamentals + TryHackMe SOC Level 1 path" },
      { skill: "Scripting (Python/Bash)", priority: "medium", how: "Automate 3 small security tasks; publish on GitHub" },
      { skill: "Incident Response Process", priority: "medium", how: "Study NIST IR framework; write mock incident reports" },
    ],
    courses: [
      { name: "CompTIA Security+", provider: "CompTIA", cost: "$392 exam (+$0–300 prep)", duration: "2–3 months", rating: "4.7/5", why: "The baseline credential most SOC job postings screen for.", badge: "The standard first cert", minBudget: 500 },
      { name: "TryHackMe SOC Level 1 Path", provider: "TryHackMe", cost: "$14/mo", duration: "3–4 months", rating: "4.8/5", why: "Hands-on labs that map directly to day-one SOC analyst work.", badge: "Best hands-on", minBudget: 100, url: "https://tryhackme.com/" },
      { name: "Google Cybersecurity Certificate", provider: "Coursera · Google", cost: "$49/mo (≈$300)", duration: "6 months part-time", rating: "4.8/5", why: "Beginner-friendly, includes Linux, SQL, SIEM, and Python basics.", badge: "Best for career switchers", minBudget: 500 },
    ],
    salary: [
      { stage: "First role (SOC Analyst I)", range: "$60k – $80k", note: "Certs + home lab + any IT-adjacent history", pct: 40 },
      { stage: "2 years in (Analyst II)", range: "$80k – $105k", note: "Detection tuning and IR participation", pct: 58 },
      { stage: "4–5 years (Senior/Specialist)", range: "$105k – $140k", note: "Threat hunting, DFIR, or cloud security", pct: 78 },
      { stage: "Lead / Architect", range: "$140k – $185k+", note: "Security architecture and leadership", pct: 100 },
    ],
    communities: ["TryHackMe Discord", "r/cybersecurity", "Blue Team Village", "Local BSides community", "LetsDefend community"],
    people: ["John Hammond (hands-on content)", "Gerald Auger (Simply Cyber, career focus)", "Lesley Carhart (DFIR + careers)"],
    events: ["BSides (affordable local cons)", "SANS free summits", "CTF competitions (great résumé signal)"],
    dayInLife: [
      { time: "8:30", activity: "Shift handoff — review overnight alerts and open incidents" },
      { time: "9:00", activity: "Triage SIEM queue; separate real signal from noise" },
      { time: "11:00", activity: "Investigate a phishing report; trace the email's path" },
      { time: "13:00", activity: "Write up an incident: timeline, impact, containment steps" },
      { time: "14:30", activity: "Tune a noisy detection rule with a senior analyst" },
      { time: "16:00", activity: "Threat intel reading; update watchlists" },
    ],
    demand: "Very high — a persistent global talent shortage, and entry-level pipelines reward demonstrated hands-on labs",
    difficultyBase: 6,
    planB: "IT Support → Security transition (the classic route), or GRC Analyst (governance/compliance) — less technical, heavily hiring, same industry.",
    frameworks: ["Explain incidents with the kill-chain / MITRE ATT&CK vocabulary", "STAR stories from lab scenarios and CTFs", "Show, don't tell: bring your home-lab write-ups"],
  },
  {
    role: "Project Manager",
    aliases: ["project manager", "program manager", "scrum master", "delivery manager", "pmo"],
    coreSkills: [
      { skill: "Planning & Scheduling", priority: "high", how: "Often transferable — formalize with CAPM/PMP vocabulary" },
      { skill: "Agile / Scrum", priority: "high", how: "Scrum.org PSM I ($200) — study free guides, pass the exam" },
      { skill: "Stakeholder & Risk Management", priority: "high", how: "Usually transferable — document 3 real examples from your career" },
      { skill: "PM Tooling (Jira, Asana)", priority: "medium", how: "Free trials + rebuild one of your past projects in each tool" },
      { skill: "Budgeting & Reporting", priority: "medium", how: "Transferable for most; practice building a project dashboard" },
    ],
    courses: [
      { name: "Google Project Management Certificate", provider: "Coursera · Google", cost: "$49/mo (≈$250)", duration: "6 months part-time", rating: "4.8/5", why: "Recognized, practical, and counts toward PMP education hours.", badge: "Best for career switchers", minBudget: 500 },
      { name: "PSM I (Professional Scrum Master)", provider: "Scrum.org", cost: "$200 exam", duration: "3–4 weeks self-study", rating: "4.6/5", why: "Cheap, respected, no mandatory course — the efficient agile credential.", badge: "Best value cert", minBudget: 200, url: "https://www.scrum.org/assessments/professional-scrum-master-i-certification" },
      { name: "PMP (Project Management Professional)", provider: "PMI", cost: "$405–$575 exam + prep", duration: "2–4 months prep", rating: "4.7/5", why: "The heavyweight credential — pursue once you have documented project hours.", badge: "Career accelerator", minBudget: 1000 },
    ],
    salary: [
      { stage: "First role (Project Coordinator/PM)", range: "$60k – $80k", note: "Your existing industry knowledge often prices you higher", pct: 42 },
      { stage: "2 years in (PM)", range: "$80k – $105k", note: "Full project ownership", pct: 58 },
      { stage: "4–5 years (Senior PM)", range: "$105k – $135k", note: "Programs and larger budgets; PMP helps here", pct: 78 },
      { stage: "Program Director", range: "$135k – $180k+", note: "Portfolio leadership", pct: 100 },
    ],
    communities: ["PMI local chapters", "r/projectmanagement", "Scrum.org forums", "Digital Project Manager community"],
    people: ["The Digital Project Manager (resources)", "PMI (standards)", "Melissa Boggs (agile leadership)"],
    events: ["PMI chapter meetings (networking gold)", "Agile meetups", "Industry-specific PM conferences"],
    dayInLife: [
      { time: "8:45", activity: "Review project dashboard; two tasks slipped — investigate before anyone asks" },
      { time: "9:30", activity: "Daily standup; capture blockers, chase two dependencies" },
      { time: "10:30", activity: "Steering committee prep — status report with honest RAG ratings" },
      { time: "13:00", activity: "Risk review: a vendor delay threatens the launch date. Options analysis" },
      { time: "14:30", activity: "1:1 with a struggling workstream lead — listen first" },
      { time: "16:00", activity: "Update the plan; communicate the change and the why" },
    ],
    demand: "Steady across industries — the most transferable-friendly target role; your domain background is a direct asset",
    difficultyBase: 3,
    planB: "Operations Manager or Chief of Staff-style roles — same coordination muscles, often reachable inside your current company first.",
    frameworks: ["RAID logs and RACI matrices in interview answers", "STAR stories about conflict, slippage, and recovery", "Speak in outcomes and dates, not activities"],
  },
  {
    role: "AI / ML Engineer",
    aliases: ["ai engineer", "ml engineer", "machine learning", "ai/ml", "data scientist", "llm engineer", "ai"],
    coreSkills: [
      { skill: "Python (solid)", priority: "high", how: "CS50P or Python for Everybody; then daily practice with real datasets" },
      { skill: "Math for ML (linear algebra, stats)", priority: "high", how: "3Blue1Brown series + Khan Academy — enough to read papers, not prove theorems" },
      { skill: "ML Fundamentals", priority: "high", how: "Andrew Ng's ML Specialization — still the canonical starting point" },
      { skill: "LLM & Prompt Engineering", priority: "high", how: "Build 3 apps on the Claude or OpenAI APIs: RAG, agents, evals" },
      { skill: "MLOps / Deployment", priority: "medium", how: "Deploy one model + one LLM app end-to-end with monitoring" },
      { skill: "Data Engineering Basics", priority: "medium", how: "SQL + pipelines; Kaggle micro-courses" },
    ],
    courses: [
      { name: "Machine Learning Specialization", provider: "Coursera · DeepLearning.AI", cost: "$49/mo (≈$150)", duration: "3 months part-time", rating: "4.9/5", why: "Andrew Ng's canonical course — the field's shared foundation.", badge: "The canonical start", minBudget: 200, url: "https://www.coursera.org/specializations/machine-learning-introduction" },
      { name: "fast.ai Practical Deep Learning", provider: "fast.ai", cost: "Free", duration: "2–3 months", rating: "4.8/5", why: "Top-down and practical: you train real models in week one.", badge: "Best free path", minBudget: 0, url: "https://course.fast.ai/" },
      { name: "AI Engineering Bootcamps / LLM courses", provider: "Various (e.g., Maven cohorts)", cost: "$500–$3,000", duration: "6–10 weeks", rating: "4.5/5", why: "Cohort courses on LLM apps, RAG, and evals — fastest route to the newest, most-hired-for skills.", minBudget: 500 },
    ],
    salary: [
      { stage: "First role (ML/AI Engineer)", range: "$100k – $140k", note: "LLM application skills currently command a premium", pct: 48 },
      { stage: "2 years in", range: "$140k – $180k", note: "Production systems and eval rigor", pct: 65 },
      { stage: "4–5 years (Senior)", range: "$180k – $240k", note: "Architecture and research-to-product judgment", pct: 85 },
      { stage: "Staff / Lead", range: "$240k – $350k+", note: "The current market's hottest seat", pct: 100 },
    ],
    communities: ["Hugging Face Discord", "fast.ai forums", "MLOps Community", "Latent Space Discord", "r/MachineLearning"],
    people: ["Andrej Karpathy (education)", "Jeremy Howard (fast.ai)", "Chip Huyen (ML systems)", "Simon Willison (LLM applications)"],
    events: ["Local AI meetups (exploding everywhere)", "Kaggle competitions", "Hackathons with AI tracks"],
    dayInLife: [
      { time: "9:30", activity: "Review eval dashboard — last night's prompt change moved accuracy +2%" },
      { time: "10:00", activity: "Deep work: improve retrieval quality in the RAG pipeline" },
      { time: "12:30", activity: "Pair with a product engineer integrating your model API" },
      { time: "14:00", activity: "Error analysis: read 30 failure cases, tag the patterns" },
      { time: "15:30", activity: "Experiment: fine-tune vs. few-shot comparison; log results" },
      { time: "16:30", activity: "Write up findings; propose next week's experiment" },
    ],
    demand: "Explosive — the fastest-growing engineering specialty; application-layer (LLM) roles are the most accessible entry point",
    difficultyBase: 8,
    planB: "AI-adjacent roles: Data Analyst with ML flavor, Solutions Engineer at an AI company, or AI-tooling power user in your current field — each keeps you in the ecosystem while you keep building.",
    frameworks: ["Walk through one project deeply: data → model → eval → deployment → learning", "Paper-reading habit: one classic + one recent per week", "Show a live demo, always"],
  },
];

export function findRole(target: string): RoleKnowledge | undefined {
  const t = target.trim().toLowerCase();
  return POPULAR_TARGETS.find(
    (r) => r.role.toLowerCase() === t || r.aliases.some((a) => t.includes(a) || a.includes(t))
  );
}

export const BUDGET_CAPS: Record<string, number> = {
  free: 0,
  "500": 500,
  "2000": 2000,
  flexible: 100000,
};
