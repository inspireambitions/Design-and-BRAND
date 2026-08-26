export type Competency = {
  id: string;
  label: string;
  labelAr: string;
  /** What a strong answer demonstrates. Used by the scorer as the rubric anchor. */
  anchor: string;
  /** Arabic rendering of the same anchor. Older signed interviews may omit it. */
  anchorAr?: string;
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
  /**
   * Extra questions this role can draw on so repeat practice does not repeat
   * the interview. Never rendered directly: the interview a candidate takes is
   * drawn by lib/interview-draw.ts from questions + bank. Scoring must accept
   * ids from either list.
   */
  bank?: Question[];
};

export const STAR_HINT =
  'Answer with a real story: the situation, what you personally did, and how it ended.';
export const STAR_HINT_AR =
  'أجب بقصة حقيقية: الموقف، وما قمت به أنت شخصياً، وكيف انتهى الأمر.';

/** Competencies shared across customer-facing roles. */
export const serviceCompetencies: Competency[] = [
  {
    id: 'communication',
    label: 'Communication',
    labelAr: 'التواصل',
    anchor: 'Organises the answer in a clear sequence that a guest or colleague could follow.',
    anchorAr: 'يرتّب الإجابة في تسلسل واضح يمكن للضيف أو الزميل متابعته.',
  },
  {
    id: 'ownership',
    label: 'Ownership',
    labelAr: 'تحمّل المسؤولية',
    anchor: 'Describes what they personally decided and did, not only what the team did.',
    anchorAr: 'يصف ما قرره وفعله بنفسه، وليس ما فعله الفريق فقط.',
  },
  {
    id: 'problem_solving',
    label: 'Problem solving',
    labelAr: 'حل المشكلات',
    anchor: 'Shows a clear sequence of actions that resolved a real problem.',
    anchorAr: 'يعرض تسلسلاً واضحاً للإجراءات التي حلّت مشكلة حقيقية.',
  },
  {
    id: 'evidence',
    label: 'Specific evidence',
    labelAr: 'أدلة محددة',
    anchor: 'Gives concrete details — numbers, names of systems, timeframes, outcomes.',
    anchorAr: 'يقدم تفاصيل محددة مثل الأرقام وأسماء الأنظمة والمدد والنتائج.',
  },
  {
    id: 'customer_focus',
    label: 'Customer focus',
    labelAr: 'التركيز على العميل',
    anchor: 'Keeps the guest or customer experience central throughout the answer.',
    anchorAr: 'يجعل تجربة الضيف أو العميل محور الإجابة من بدايتها إلى نهايتها.',
  },
];

/** Competencies for trades, technical and safety-critical roles. */
export const technicalCompetencies: Competency[] = [
  {
    id: 'communication',
    label: 'Communication',
    labelAr: 'التواصل',
    anchor: 'Explains technical or procedural detail in language a non-expert can follow.',
    anchorAr: 'يشرح التفاصيل الفنية أو الإجرائية بلغة يستطيع غير المتخصص متابعتها.',
  },
  {
    id: 'ownership',
    label: 'Ownership',
    labelAr: 'تحمّل المسؤولية',
    anchor: 'Describes what they personally decided and did, not only what the team did.',
    anchorAr: 'يصف ما قرره وفعله بنفسه، وليس ما فعله الفريق فقط.',
  },
  {
    id: 'problem_solving',
    label: 'Problem solving',
    labelAr: 'حل المشكلات',
    anchor: 'Shows a clear diagnostic or procedural sequence that resolved a real problem.',
    anchorAr: 'يعرض تسلسلاً واضحاً للتشخيص أو الإجراءات التي حلّت مشكلة حقيقية.',
  },
  {
    id: 'evidence',
    label: 'Specific evidence',
    labelAr: 'أدلة محددة',
    anchor: 'Gives concrete details — numbers, systems, standards, timeframes, outcomes.',
    anchorAr: 'يقدم تفاصيل محددة مثل الأرقام والأنظمة والمعايير والمدد والنتائج.',
  },
  {
    id: 'compliance',
    label: 'Standards & safety',
    labelAr: 'المعايير والسلامة',
    anchor: 'Shows awareness of the rules, standards or safety requirements of the role.',
    anchorAr: 'يُظهر فهماً لقواعد الوظيفة ومعاييرها ومتطلبات السلامة فيها.',
  },
];

/** Competencies for roles caring for people — patients, children, residents. */
export const careCompetencies: Competency[] = [
  {
    id: 'communication',
    label: 'Communication',
    labelAr: 'التواصل',
    anchor: 'Explains clearly and kindly to the person in their care and to their family.',
    anchorAr: 'يشرح بوضوح ولطف للشخص الذي يرعاه ولأسرته.',
  },
  {
    id: 'ownership',
    label: 'Ownership',
    labelAr: 'تحمّل المسؤولية',
    anchor: 'Describes what they personally decided and did, not only what the team did.',
    anchorAr: 'يصف ما قرره وفعله بنفسه، وليس ما فعله الفريق فقط.',
  },
  {
    id: 'problem_solving',
    label: 'Judgement',
    labelAr: 'حسن التقدير',
    anchor: 'Shows sound judgement about when to act alone and when to escalate.',
    anchorAr: 'يُظهر حُسن التقدير في معرفة متى يتصرف بنفسه ومتى يصعّد الأمر.',
  },
  {
    id: 'evidence',
    label: 'Specific evidence',
    labelAr: 'أدلة محددة',
    anchor: 'Gives concrete details — what was observed, what was done, what changed.',
    anchorAr: 'يقدم تفاصيل محددة عمّا لاحظه وما فعله وما الذي تغيّر.',
  },
  {
    id: 'compliance',
    label: 'Safety & dignity',
    labelAr: 'السلامة والكرامة',
    anchor: 'Protects the safety and the dignity of the person in their care.',
    anchorAr: 'يحمي سلامة وكرامة الشخص الذي يرعاه.',
  },
];

export function q(
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

/** Every interview opens with this. */
export const opener = q(
  'intro',
  'Tell me about yourself and why you are applying for this role.',
  'حدثني عن نفسك ولماذا تتقدم لهذه الوظيفة.',
  ['communication', 'customer_focus'],
  'Keep it to your work history, your strengths, and why this specific role. About 90 seconds.',
  'ركّز على خبرتك العملية ونقاط قوتك وسبب اهتمامك بهذه الوظيفة تحديداً. حوالي ٩٠ ثانية.',
  30,
  120,
);

/** Every interview closes with this. */
export const closer = q(
  'why_gulf',
  'Why do you want to work in the Gulf, and what do you know about working here?',
  'لماذا ترغب في العمل في الخليج، وماذا تعرف عن العمل هنا؟',
  ['communication', 'evidence'],
  'Show you have thought seriously about the move — the pace, the diversity, the expectations.',
  'أظهر أنك فكرت جدياً في هذه الخطوة — وتيرة العمل والتنوع والتوقعات.',
  30,
  90,
);

/** Closer for trades and safety-critical roles, which scores compliance instead. */
export const closerTechnical = q(
  'why_gulf_tech',
  'Why do you want to work in the Gulf, and what do you know about site standards here?',
  'لماذا ترغب في العمل في الخليج، وماذا تعرف عن معايير العمل هنا؟',
  ['communication', 'compliance'],
  'Show you have thought seriously about the move, including the heat, the hours and the safety rules.',
  'أظهر أنك فكرت جدياً في هذه الخطوة، بما في ذلك الحرارة وساعات العمل وقواعد السلامة.',
  30,
  90,
);
