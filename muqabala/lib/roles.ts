export type Competency = {
  id: string;
  label: string;
  labelAr: string;
  /** What a strong answer demonstrates. Used by the scorer as the rubric anchor. */
  anchor: string;
};

export type Question = {
  id: string;
  text: string;
  textAr: string;
  /** Competencies this question is scored against. */
  competencies: string[];
  prepSeconds: number;
  answerSeconds: number;
  /** Shown to the candidate before they answer — coaching, not a trick. */
  hint: string;
  hintAr: string;
};

export type Role = {
  id: string;
  title: string;
  titleAr: string;
  industry: string;
  industryAr: string;
  level: 'Entry' | 'Mid' | 'Senior';
  blurb: string;
  blurbAr: string;
  competencies: Competency[];
  questions: Question[];
};

const STAR_HINT =
  'Answer with a real story: the situation, what you personally did, and how it ended.';
const STAR_HINT_AR =
  'أجب بقصة حقيقية: الموقف، وما قمت به أنت شخصياً، وكيف انتهى الأمر.';

/** Competencies shared across most customer-facing Gulf roles. */
const serviceCompetencies: Competency[] = [
  {
    id: 'communication',
    label: 'Communication',
    labelAr: 'التواصل',
    anchor: 'Speaks clearly and in a structured way that a guest or colleague could follow.',
  },
  {
    id: 'ownership',
    label: 'Ownership',
    labelAr: 'تحمّل المسؤولية',
    anchor: 'Describes what they personally decided and did, not only what the team did.',
  },
  {
    id: 'problem_solving',
    label: 'Problem solving',
    labelAr: 'حل المشكلات',
    anchor: 'Shows a clear sequence of actions that resolved a real problem.',
  },
  {
    id: 'evidence',
    label: 'Specific evidence',
    labelAr: 'أدلة محددة',
    anchor: 'Gives concrete details — numbers, names of systems, timeframes, outcomes.',
  },
  {
    id: 'customer_focus',
    label: 'Customer focus',
    labelAr: 'التركيز على العميل',
    anchor: 'Keeps the guest or customer experience central throughout the answer.',
  },
];

const technicalCompetencies: Competency[] = [
  {
    id: 'communication',
    label: 'Communication',
    labelAr: 'التواصل',
    anchor: 'Explains technical or procedural detail in language a non-expert can follow.',
  },
  {
    id: 'ownership',
    label: 'Ownership',
    labelAr: 'تحمّل المسؤولية',
    anchor: 'Describes what they personally decided and did, not only what the team did.',
  },
  {
    id: 'problem_solving',
    label: 'Problem solving',
    labelAr: 'حل المشكلات',
    anchor: 'Shows a clear diagnostic or procedural sequence that resolved a real problem.',
  },
  {
    id: 'evidence',
    label: 'Specific evidence',
    labelAr: 'أدلة محددة',
    anchor: 'Gives concrete details — numbers, systems, standards, timeframes, outcomes.',
  },
  {
    id: 'compliance',
    label: 'Standards & safety',
    labelAr: 'المعايير والسلامة',
    anchor: 'Shows awareness of the rules, standards or safety requirements of the role.',
  },
];

function q(
  id: string,
  text: string,
  textAr: string,
  competencies: string[],
  hint = STAR_HINT,
  hintAr = STAR_HINT_AR,
  prepSeconds = 30,
  answerSeconds = 120,
): Question {
  return { id, text, textAr, competencies, hint, hintAr, prepSeconds, answerSeconds };
}

/** Questions every role opens and closes with. */
const opener = q(
  'intro',
  'Tell me about yourself and why you are applying for this role.',
  'حدثني عن نفسك ولماذا تتقدم لهذه الوظيفة.',
  ['communication', 'customer_focus'],
  'Keep it to your work history, your strengths, and why this specific role. About 90 seconds.',
  'ركّز على خبرتك العملية ونقاط قوتك وسبب اهتمامك بهذه الوظيفة تحديداً. حوالي ٩٠ ثانية.',
  30,
  120,
);

const closer = q(
  'why_gulf',
  'Why do you want to work in the Gulf, and what do you know about working here?',
  'لماذا ترغب في العمل في الخليج، وماذا تعرف عن العمل هنا؟',
  ['communication', 'evidence'],
  'Show you have thought seriously about the move — the pace, the diversity, the expectations.',
  'أظهر أنك فكرت جدياً في هذه الخطوة — وتيرة العمل والتنوع والتوقعات.',
  30,
  90,
);

export const ROLES: Role[] = [
  {
    id: 'front-office-agent',
    title: 'Front Office Agent',
    titleAr: 'موظف استقبال',
    industry: 'Hospitality',
    industryAr: 'الضيافة',
    level: 'Entry',
    blurb: 'Hotel reception, check-in, guest requests and complaint handling.',
    blurbAr: 'استقبال الفندق وتسجيل الوصول وطلبات النزلاء والتعامل مع الشكاوى.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'angry_guest',
        'Tell me about a time an angry guest complained directly to you. What happened?',
        'حدثني عن موقف اشتكى فيه نزيل غاضب لك مباشرة. ماذا حدث؟',
        ['customer_focus', 'ownership', 'problem_solving', 'evidence'],
      ),
      q(
        'overbooking',
        'A guest arrives at 11pm and their room is not ready. Walk me through exactly what you do.',
        'يصل نزيل الساعة ١١ مساءً وغرفته غير جاهزة. اشرح لي بالضبط ماذا ستفعل.',
        ['problem_solving', 'communication', 'customer_focus'],
        'Walk through your steps in order. Say what you would decide yourself and when you would escalate.',
        'اشرح خطواتك بالترتيب. وضّح ما ستقرره بنفسك ومتى ستصعّد الأمر.',
      ),
      q(
        'systems',
        'Which hotel systems have you used, and what did you do in them day to day?',
        'ما أنظمة الفنادق التي استخدمتها، وماذا كنت تفعل بها يومياً؟',
        ['evidence', 'communication'],
        'Name the actual systems (Opera, Protel, Cloudbeds…) and the tasks you did in them.',
        'اذكر الأنظمة الفعلية (أوبرا، بروتيل، كلاودبيدز…) والمهام التي قمت بها.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'waiter',
    title: 'Waiter / Server',
    titleAr: 'نادل',
    industry: 'Food & Beverage',
    industryAr: 'الأغذية والمشروبات',
    level: 'Entry',
    blurb: 'Restaurant service, upselling, food safety and busy-shift pressure.',
    blurbAr: 'خدمة المطاعم والبيع الإضافي وسلامة الغذاء وضغط النوبات المزدحمة.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'wrong_order',
        'A guest says their food is wrong and they are already upset. What do you do?',
        'يقول أحد الضيوف إن طلبه خاطئ وهو منزعج بالفعل. ماذا تفعل؟',
        ['customer_focus', 'ownership', 'problem_solving'],
      ),
      q(
        'upselling',
        'Tell me about a time you successfully recommended something extra to a guest.',
        'حدثني عن مرة نجحت فيها في اقتراح شيء إضافي على أحد الضيوف.',
        ['customer_focus', 'evidence', 'communication'],
      ),
      q(
        'busy_shift',
        'You have six tables seated at once and you are alone on the floor. How do you handle it?',
        'لديك ست طاولات في وقت واحد وأنت وحدك في الصالة. كيف تتعامل مع ذلك؟',
        ['problem_solving', 'ownership', 'communication'],
        'Show how you prioritise, and what you tell the guests while they wait.',
        'أظهر كيف ترتب أولوياتك، وماذا تقول للضيوف أثناء انتظارهم.',
      ),
      closer,
    ],
  },
  {
    id: 'retail-sales',
    title: 'Retail Sales Associate',
    titleAr: 'مندوب مبيعات تجزئة',
    industry: 'Retail',
    industryAr: 'التجزئة',
    level: 'Entry',
    blurb: 'Mall retail, targets, customer service and stock handling.',
    blurbAr: 'بيع التجزئة في المراكز التجارية والأهداف وخدمة العملاء وإدارة المخزون.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'difficult_customer',
        'Tell me about a customer who wanted to return an item you could not accept. What happened?',
        'حدثني عن عميل أراد إرجاع منتج لم يكن بإمكانك قبوله. ماذا حدث؟',
        ['customer_focus', 'ownership', 'communication'],
      ),
      q(
        'targets',
        'Tell me about a sales target you were given. Did you hit it, and how?',
        'حدثني عن هدف مبيعات كُلّفت به. هل حققته، وكيف؟',
        ['evidence', 'ownership', 'problem_solving'],
        'Give the real numbers if you can — the target, what you achieved, and what you changed.',
        'اذكر الأرقام الحقيقية إن أمكن — الهدف، وما حققته، وما الذي غيّرته.',
      ),
      q(
        'quiet_floor',
        'The store is quiet and you have hours left in your shift. What do you do?',
        'المتجر هادئ ولديك ساعات متبقية في نوبتك. ماذا تفعل؟',
        ['ownership', 'customer_focus'],
        'Employers are testing initiative here. Be specific about what you would actually do.',
        'يختبر أصحاب العمل روح المبادرة هنا. كن محدداً بشأن ما ستفعله فعلياً.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'security-guard',
    title: 'Security Guard',
    titleAr: 'حارس أمن',
    industry: 'Facilities & Security',
    industryAr: 'المرافق والأمن',
    level: 'Entry',
    blurb: 'Site security, access control, incident reporting and de-escalation.',
    blurbAr: 'أمن الموقع والتحكم في الدخول وكتابة تقارير الحوادث وتهدئة المواقف.',
    competencies: technicalCompetencies,
    questions: [
      opener,
      q(
        'incident',
        'Tell me about an incident you handled on site. What did you do and what did you report?',
        'حدثني عن حادثة تعاملت معها في الموقع. ماذا فعلت وماذا سجّلت في التقرير؟',
        ['ownership', 'problem_solving', 'compliance', 'evidence'],
      ),
      q(
        'refused_entry',
        'Someone without a valid pass insists on entering and becomes aggressive. What do you do?',
        'شخص بدون تصريح صالح يصرّ على الدخول ويصبح عدوانياً. ماذا تفعل؟',
        ['compliance', 'communication', 'problem_solving'],
        'Show how you stay calm, follow procedure, and when you call for backup.',
        'أظهر كيف تحافظ على هدوئك وتتبع الإجراءات ومتى تطلب الدعم.',
      ),
      q(
        'patrol',
        'What does a proper patrol and handover look like at the end of your shift?',
        'كيف تبدو الدورية الصحيحة وتسليم النوبة في نهاية دوامك؟',
        ['compliance', 'communication', 'evidence'],
        'Be concrete about checks, logs, and what you hand to the next guard.',
        'كن محدداً بشأن الفحوصات والسجلات وما تسلّمه للحارس التالي.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'driver',
    title: 'Driver / Delivery',
    titleAr: 'سائق / مندوب توصيل',
    industry: 'Logistics',
    industryAr: 'الخدمات اللوجستية',
    level: 'Entry',
    blurb: 'Deliveries, route handling, vehicle care and customer contact.',
    blurbAr: 'التوصيل وإدارة المسارات والعناية بالمركبة والتعامل مع العملاء.',
    competencies: technicalCompetencies,
    questions: [
      opener,
      q(
        'late_delivery',
        'You are running late on a delivery because of traffic. What do you do?',
        'أنت متأخر عن التوصيل بسبب الازدحام. ماذا تفعل؟',
        ['ownership', 'communication', 'problem_solving'],
      ),
      q(
        'vehicle_issue',
        'Tell me about a time something went wrong with your vehicle or your load.',
        'حدثني عن مرة حدث فيها خطأ في مركبتك أو في حمولتك.',
        ['problem_solving', 'compliance', 'evidence'],
      ),
      q(
        'safety',
        'What checks do you do before you start driving for the day?',
        'ما الفحوصات التي تقوم بها قبل بدء القيادة كل يوم؟',
        ['compliance', 'evidence'],
        'List the actual checks. Safety awareness is what is being scored here.',
        'اذكر الفحوصات الفعلية. الوعي بالسلامة هو ما يُقيَّم هنا.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'admin-assistant',
    title: 'Administrative Assistant',
    titleAr: 'مساعد إداري',
    industry: 'Corporate',
    industryAr: 'الشركات',
    level: 'Mid',
    blurb: 'Office coordination, scheduling, documents and stakeholder handling.',
    blurbAr: 'تنسيق المكتب وجدولة المواعيد والمستندات والتعامل مع الأطراف المعنية.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'competing_priorities',
        'Two managers give you urgent work at the same time. How do you handle it?',
        'يعطيك مديران عملاً عاجلاً في نفس الوقت. كيف تتعامل مع ذلك؟',
        ['problem_solving', 'communication', 'ownership'],
      ),
      q(
        'mistake',
        'Tell me about a mistake you made at work and what you did about it.',
        'حدثني عن خطأ ارتكبته في العمل وماذا فعلت حياله.',
        ['ownership', 'evidence', 'communication'],
        'Employers respect candidates who own mistakes and fix them. Say what you changed afterwards.',
        'يحترم أصحاب العمل من يعترف بأخطائه ويصلحها. اذكر ما غيّرته بعد ذلك.',
      ),
      q(
        'tools',
        'Which office systems do you use, and what do you actually build or manage in them?',
        'ما الأنظمة المكتبية التي تستخدمها، وماذا تنشئ أو تدير بها فعلياً؟',
        ['evidence', 'communication'],
        'Name the tools and the real tasks — reports, trackers, calendars, filing systems.',
        'اذكر الأدوات والمهام الحقيقية — التقارير والمتابعات والتقويمات وأنظمة الحفظ.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'nurse',
    title: 'Staff Nurse',
    titleAr: 'ممرض / ممرضة',
    industry: 'Healthcare',
    industryAr: 'الرعاية الصحية',
    level: 'Mid',
    blurb: 'Ward care, patient safety, escalation and family communication.',
    blurbAr: 'رعاية الجناح وسلامة المرضى والتصعيد والتواصل مع العائلات.',
    competencies: technicalCompetencies,
    questions: [
      opener,
      q(
        'deteriorating',
        'Tell me about a patient whose condition deteriorated on your shift. What did you do?',
        'حدثني عن مريض تدهورت حالته أثناء نوبتك. ماذا فعلت؟',
        ['problem_solving', 'ownership', 'compliance', 'evidence'],
      ),
      q(
        'family',
        'How do you handle an anxious family member who is questioning the care being given?',
        'كيف تتعامل مع أحد أفراد العائلة القلق الذي يشكك في الرعاية المقدمة؟',
        ['communication', 'customer_focus', 'compliance'],
        'Show empathy and boundaries — what you can share, and who you involve.',
        'أظهر التعاطف والحدود — ما يمكنك مشاركته ومن تُشرِكه في الأمر.',
      ),
      q(
        'safety_protocol',
        'Describe how you check and administer medication safely.',
        'صف كيف تتحقق من الأدوية وتعطيها بأمان.',
        ['compliance', 'evidence'],
        'Walk through your actual checks step by step.',
        'اشرح فحوصاتك الفعلية خطوة بخطوة.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'accountant',
    title: 'Accountant',
    titleAr: 'محاسب',
    industry: 'Finance',
    industryAr: 'المالية',
    level: 'Mid',
    blurb: 'Ledgers, reconciliations, month-end close and VAT compliance.',
    blurbAr: 'دفاتر الحسابات والتسويات والإقفال الشهري والامتثال لضريبة القيمة المضافة.',
    competencies: technicalCompetencies,
    questions: [
      opener,
      q(
        'discrepancy',
        'Tell me about a discrepancy you found in the accounts. How did you resolve it?',
        'حدثني عن اختلاف وجدته في الحسابات. كيف قمت بحله؟',
        ['problem_solving', 'evidence', 'ownership'],
      ),
      q(
        'month_end',
        'Walk me through your month-end close process.',
        'اشرح لي عملية الإقفال الشهري لديك.',
        ['evidence', 'communication', 'compliance'],
        'Be specific about the sequence, the systems, and the deadlines you work to.',
        'كن محدداً بشأن التسلسل والأنظمة والمواعيد النهائية التي تلتزم بها.',
      ),
      q(
        'vat',
        'What is your experience with VAT filing and compliance in this region?',
        'ما خبرتك في تقديم إقرارات ضريبة القيمة المضافة والامتثال في هذه المنطقة؟',
        ['compliance', 'evidence'],
        'If your experience is from another country, say so and explain what transfers.',
        'إذا كانت خبرتك من دولة أخرى، اذكر ذلك واشرح ما يمكن تطبيقه هنا.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'sales-executive',
    title: 'Sales Executive',
    titleAr: 'تنفيذي مبيعات',
    industry: 'Sales',
    industryAr: 'المبيعات',
    level: 'Mid',
    blurb: 'B2B pipeline, targets, negotiation and client relationships.',
    blurbAr: 'مسار مبيعات الشركات والأهداف والتفاوض وعلاقات العملاء.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'lost_deal',
        'Tell me about a deal you lost. Why did you lose it and what did you learn?',
        'حدثني عن صفقة خسرتها. لماذا خسرتها وماذا تعلمت؟',
        ['ownership', 'evidence', 'problem_solving'],
      ),
      q(
        'biggest_win',
        'Walk me through your biggest win — from first contact to signature.',
        'اشرح لي أكبر صفقة حققتها — من أول اتصال حتى التوقيع.',
        ['evidence', 'communication', 'customer_focus'],
        'Give the numbers, the timeline, and what you personally did to move it forward.',
        'اذكر الأرقام والجدول الزمني وما فعلته أنت شخصياً لدفعها للأمام.',
        30,
        150,
      ),
      q(
        'pipeline',
        'How do you build and manage your pipeline week to week?',
        'كيف تبني وتدير مسار مبيعاتك أسبوعاً بعد أسبوع؟',
        ['problem_solving', 'evidence'],
        'Describe your actual routine and the tools you track it in.',
        'صف روتينك الفعلي والأدوات التي تتابع بها.',
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'construction-supervisor',
    title: 'Site Supervisor',
    titleAr: 'مشرف موقع',
    industry: 'Construction',
    industryAr: 'الإنشاءات',
    level: 'Senior',
    blurb: 'Site coordination, crew management, HSE and progress reporting.',
    blurbAr: 'تنسيق الموقع وإدارة الفريق والصحة والسلامة وتقارير التقدم.',
    competencies: technicalCompetencies,
    questions: [
      opener,
      q(
        'safety_incident',
        'Tell me about a safety issue you identified on site. What did you do?',
        'حدثني عن مشكلة سلامة اكتشفتها في الموقع. ماذا فعلت؟',
        ['compliance', 'ownership', 'problem_solving', 'evidence'],
      ),
      q(
        'behind_schedule',
        'Your crew is behind schedule and the client is pushing. How do you handle it?',
        'فريقك متأخر عن الجدول الزمني والعميل يضغط. كيف تتعامل مع ذلك؟',
        ['problem_solving', 'communication', 'ownership'],
      ),
      q(
        'crew_conflict',
        'How do you handle conflict between workers on your crew?',
        'كيف تتعامل مع الخلافات بين العمال في فريقك؟',
        ['communication', 'ownership'],
        STAR_HINT,
        STAR_HINT_AR,
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'teacher',
    title: 'Teacher',
    titleAr: 'معلم',
    industry: 'Education',
    industryAr: 'التعليم',
    level: 'Mid',
    blurb: 'Classroom practice, differentiation, behaviour and parent communication.',
    blurbAr: 'الممارسة الصفية ومراعاة الفروق الفردية والسلوك والتواصل مع أولياء الأمور.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'struggling_student',
        'Tell me about a student who was falling behind. What did you do about it?',
        'حدثني عن طالب كان متأخراً دراسياً. ماذا فعلت حيال ذلك؟',
        ['problem_solving', 'ownership', 'evidence'],
      ),
      q(
        'parent',
        'A parent disagrees strongly with a grade you gave. How do you handle the conversation?',
        'أحد أولياء الأمور يعترض بشدة على درجة منحتها. كيف تدير هذه المحادثة؟',
        ['communication', 'customer_focus', 'ownership'],
      ),
      q(
        'behaviour',
        'How do you manage a class where behaviour is becoming a problem?',
        'كيف تدير صفاً بدأ السلوك فيه يصبح مشكلة؟',
        ['problem_solving', 'communication'],
        STAR_HINT,
        STAR_HINT_AR,
        20,
        90,
      ),
      closer,
    ],
  },
  {
    id: 'hr-officer',
    title: 'HR Officer',
    titleAr: 'موظف موارد بشرية',
    industry: 'Human Resources',
    industryAr: 'الموارد البشرية',
    level: 'Mid',
    blurb: 'Recruitment, onboarding, employee relations and labour law basics.',
    blurbAr: 'التوظيف والتأهيل وعلاقات الموظفين وأساسيات قانون العمل.',
    competencies: serviceCompetencies,
    questions: [
      opener,
      q(
        'grievance',
        'Tell me about an employee complaint you handled. How did it end?',
        'حدثني عن شكوى موظف تعاملت معها. كيف انتهت؟',
        ['ownership', 'communication', 'problem_solving', 'evidence'],
      ),
      q(
        'hiring_volume',
        'You need to fill 20 roles in six weeks. How do you approach it?',
        'تحتاج إلى شغل ٢٠ وظيفة خلال ستة أسابيع. كيف تتعامل مع الأمر؟',
        ['problem_solving', 'evidence', 'ownership'],
      ),
      q(
        'labour_law',
        'What do you know about labour law and visa processes in this region?',
        'ماذا تعرف عن قانون العمل وإجراءات التأشيرات في هذه المنطقة؟',
        ['evidence', 'communication'],
        'Be honest about what you know and what you would need to learn.',
        'كن صادقاً بشأن ما تعرفه وما تحتاج إلى تعلمه.',
        20,
        90,
      ),
      closer,
    ],
  },
];

export function getRole(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id);
}

export const INDUSTRIES = Array.from(new Set(ROLES.map((r) => r.industry))).sort();
