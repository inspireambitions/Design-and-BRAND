import type { Question, Role } from '@/lib/roles/shared';

/**
 * A strong sample answer, built from the rubric the question is scored against.
 * It is deliberately a worked shape rather than an invented story: the
 * candidate must supply the real example, and the email says so. Each
 * paragraph is one sentence group so it reads cleanly in plain text and RTL.
 */
export function buildSampleAnswer(role: Role, question: Question, locale: 'en' | 'ar'): string[] {
  const anchors = question.competencies
    .map((id) => role.competencies.find((competency) => competency.id === id))
    .filter((competency): competency is NonNullable<typeof competency> => Boolean(competency));
  const ar = locale === 'ar';
  const roleTitle = ar ? role.titleAr : role.title;
  const hint = plainDash(ar ? question.hintAr : question.hint);

  const rubricLines = anchors.map((competency) => {
    const label = ar ? competency.labelAr : competency.label;
    const anchor = plainDash((ar ? competency.anchorAr : competency.anchor) ?? competency.anchor);
    return ar ? `${label}: ${anchor}` : `${label}: ${lowerFirst(anchor)}`;
  });

  if (ar) {
    return [
      `إليك شكل الإجابة القوية على هذا السؤال في وظيفة ${roleTitle}. استبدل التفاصيل بمثال حقيقي من عملك.`,
      `الموقف: ابدأ بجملة واحدة تحدد المكان ودورك والمشكلة. مثال: "في عملي السابق، حدث كذا، وكنت المسؤول عن كذا."`,
      `ما فعلته: اذكر خطوتين أو ثلاث خطوات قمت بها أنت شخصياً بالترتيب. استخدم "أنا" وليس "نحن".`,
      `النتيجة: أنهِ بما تغيّر، أو بمن أكّد النتيجة، أو برقم تستطيع إثباته.`,
      ...(hint ? [`تلميح السؤال: ${hint}`] : []),
      ...(rubricLines.length ? [`ما يبحث عنه المحاور: ${rubricLines.join(' ')}`] : []),
    ];
  }

  return [
    `Here is the shape of a strong answer to this question for a ${roleTitle} role. Replace the details with a real example from your own work.`,
    'Situation: open with one sentence that names the place, your role and the problem. For example: "In my last job, this happened, and I was responsible for that."',
    'What you did: give two or three steps you personally took, in order. Say "I", not "we".',
    'Result: finish with what changed, who confirmed it, or a number you can truthfully support.',
    ...(hint ? [`Question hint: ${hint}`] : []),
    ...(rubricLines.length ? [`What the interviewer listens for. ${rubricLines.join(' ')}`] : []),
  ];
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Catalogue copy predates the house style and still carries a few dashes.
 * Email copy must not, so anything quoted from the catalogue passes through
 * here: a dash that introduces a list becomes a colon, any other becomes a comma.
 */
export function plainDash(value: string): string {
  return value
    .replace(/\s*[\u2014\u2013]\s*(?=[a-z\u0600-\u06FF])/g, ': ')
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}
