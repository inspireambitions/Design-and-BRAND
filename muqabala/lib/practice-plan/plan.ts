import type { AnswerFeedback } from '@/lib/scoring';
import { SevenDayPlanSchema, type SevenDayPlan } from './schema';

export type PlanFeedbackInput = {
  questionText: string;
  feedback: AnswerFeedback;
};

function clean(value: string, max = 220): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildSevenDayPlan(
  locale: 'en' | 'ar',
  roleTitle: string,
  answers: PlanFeedbackInput[],
): SevenDayPlan {
  const improvements = answers.flatMap((item) => item.feedback.improvements.map(clean)).filter(Boolean);
  const tips = answers.map((item) => clean(item.feedback.coachTip)).filter(Boolean);
  const strengths = answers.flatMap((item) => item.feedback.strengths.map(clean)).filter(Boolean);
  const focusItems = [...improvements, ...tips];
  const fallback = locale === 'ar' ? 'اربط كل إجابة بمثال حقيقي ونتيجة واضحة.' : 'Connect each answer to a real example and a clear result.';
  const focus = (index: number) => focusItems[index % Math.max(focusItems.length, 1)] || fallback;
  const strength = strengths[0] || (locale === 'ar' ? 'لديك أساس يمكن تطويره بالممارسة اليومية.' : 'You have a base you can strengthen through daily practice.');

  const english = [
    ['Choose your evidence', 'Strong answers start with one relevant example.', 'Write down two real work examples. For each one, name the problem, your action and the result.', 'You have two examples with all three parts.'],
    ['Build a clear opening', 'A direct first sentence helps the interviewer follow your story.', 'Record a 60-second answer. Start by naming the situation and your responsibility in one sentence.', 'Your opening states the situation and your responsibility within 15 seconds.'],
    ['Show your action', 'Recruiters need to hear what you personally did.', 'Answer one question using “I” statements. Name three actions you took without claiming other people’s work.', 'The recording contains three clear personal actions.'],
    ['Make the result concrete', 'A result turns a task description into evidence.', 'Repeat yesterday’s answer. Add what changed, who confirmed it or a number you can truthfully support.', 'The final sentence contains one verifiable result.'],
    ['Practise under time', 'A timed answer reduces rambling without removing useful proof.', 'Give two answers with a two-minute timer. Stop when time ends, then note one sentence you could cut.', 'Both answers finish within two minutes and keep the result.'],
    ['Repair the weakest answer', 'Focused repetition is more useful than repeating your strongest answer.', 'Use the focus below to rewrite and record your weakest answer twice. Keep the second attempt only.', 'The second attempt addresses the focus and is clearer than the first.'],
    ['Run a final mock', 'A full run tests whether the changes hold without prompts.', 'Answer three interview questions aloud without stopping. Review each answer once against its success check.', 'All three answers include a situation, personal action and result.'],
  ] as const;

  const arabic = [
    ['اختر أدلتك', 'تبدأ الإجابة القوية بمثال واحد مناسب.', 'اكتب مثالين حقيقيين من العمل. حدّد المشكلة وما فعلته والنتيجة في كل مثال.', 'لديك مثالان يحتوي كل منهما على المشكلة والفعل والنتيجة.'],
    ['ابدأ بوضوح', 'تساعد الجملة الأولى المباشرة المحاور على متابعة قصتك.', 'سجّل إجابة مدتها 60 ثانية. ابدأ بذكر الموقف ومسؤوليتك في جملة واحدة.', 'تذكر الموقف ومسؤوليتك خلال أول 15 ثانية.'],
    ['وضّح ما فعلته', 'يحتاج مسؤول التوظيف إلى معرفة دورك الشخصي.', 'أجب عن سؤال واحد بصيغة المتكلم. اذكر ثلاثة أفعال قمت بها من دون نسب عمل الآخرين إليك.', 'يتضمن التسجيل ثلاثة أفعال شخصية واضحة.'],
    ['اجعل النتيجة واضحة', 'تحوّل النتيجة وصف المهمة إلى دليل عملي.', 'كرّر إجابة الأمس. أضف ما تغيّر أو من أكّد النتيجة أو رقماً تستطيع إثباته.', 'تتضمن الجملة الأخيرة نتيجة واحدة قابلة للتحقق.'],
    ['تدرّب ضمن الوقت', 'تساعد الإجابة المحددة بالوقت على تقليل التكرار مع الحفاظ على الدليل.', 'قدّم إجابتين مع مؤقت لدقيقتين. بعد كل إجابة، حدّد جملة واحدة يمكن حذفها.', 'تنتهي الإجابتان خلال دقيقتين وتحتفظان بالنتيجة.'],
    ['أصلح أضعف إجابة', 'التكرار المركّز أفضل من تكرار أقوى إجابة لديك.', 'استخدم نقطة التركيز أدناه لإعادة كتابة أضعف إجابة وتسجيلها مرتين. احتفظ بالمحاولة الثانية.', 'تعالج المحاولة الثانية نقطة التركيز وهي أوضح من الأولى.'],
    ['نفّذ مقابلة تجريبية أخيرة', 'يكشف التدريب الكامل إن كانت التحسينات ثابتة من دون تلميحات.', 'أجب عن ثلاثة أسئلة بصوت مرتفع من دون توقف. راجع كل إجابة مرة واحدة.', 'تتضمن الإجابات الثلاث موقفاً وفعلاً شخصياً ونتيجة.'],
  ] as const;

  const copy = locale === 'ar' ? arabic : english;
  return SevenDayPlanSchema.parse({
    version: '1',
    summary: locale === 'ar'
      ? `خطة تدريب لمدة سبعة أيام لوظيفة ${clean(roleTitle, 100)}. حافظ على هذه النقطة القوية: ${strength}`
      : `A seven-day practice plan for ${clean(roleTitle, 100)}. Keep this strength: ${strength}`,
    days: copy.map((item, index) => ({
      day: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      focus: index === 5 ? `${item[0]}: ${focus(index)}` : item[0],
      whyThisMatters: index === 5 ? `${item[1]} ${focus(index)}` : item[1],
      exercise: item[2],
      estimatedMinutes: [15, 15, 20, 20, 25, 25, 30][index],
      successCheck: item[3],
    })),
  });
}
