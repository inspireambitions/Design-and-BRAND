import { questionTagLabel } from '@/lib/roles/question-tags';
import type { PlanLinks } from './plan';
import type { SevenDayPlan } from './schema';

export type RenderedEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

const copy = {
  en: {
    brand: 'Muqabala',
    subjectDayOne: (role: string) => `Keep this feedback: your seven-day ${role} plan`,
    subjectDay: (day: number, question: string) => `Day ${day} of 7: ${question}`,
    intro: 'You asked us to keep this feedback. Here it is, with a strong sample answer and your first question. One more question arrives each day for seven days.',
    yourFeedback: 'Your feedback',
    score: 'Score',
    strengths: 'What your answer proves',
    improvements: 'What is missing',
    coachTip: 'What to add next',
    reportUnavailable: 'Your full feedback is on the screen where you practised. This email keeps the question, a sample answer and your plan.',
    questionYouAnswered: 'The question you answered',
    sampleAnswer: 'A strong sample answer',
    sampleNote: 'This is the shape of a strong answer, built from the marking guide for this question. Put your own real example inside it.',
    today: (day: number) => `Day ${day}: today's question`,
    hint: 'Hint',
    openQuestion: 'Answer this question',
    yourWeek: 'Your seven days',
    dayLabel: 'Day',
    whatsapp: 'Get these on WhatsApp instead',
    whatsappNote: 'One tap sends all seven links to your own WhatsApp. We do not ask for your number.',
    browserCopy: 'Open a private browser copy of your plan',
    footer: 'You asked for these emails after practising on Muqabala. They stop after day seven. You were not added to a marketing list. Reply to this email if you want them to stop sooner.',
    minutes: 'About 10 minutes.',
  },
  ar: {
    brand: 'مقابلة',
    subjectDayOne: (role: string) => `احتفظ بهذه الملاحظات: خطتك لسبعة أيام لوظيفة ${role}`,
    subjectDay: (day: number, question: string) => `اليوم ${day} من 7: ${question}`,
    intro: 'طلبت منا الاحتفاظ بهذه الملاحظات. إليك الملاحظات ونموذج إجابة قوية وسؤالك الأول. سيصلك سؤال جديد كل يوم لمدة سبعة أيام.',
    yourFeedback: 'ملاحظاتك',
    score: 'الدرجة',
    strengths: 'ما تثبته إجابتك',
    improvements: 'ما ينقص إجابتك',
    coachTip: 'ما تضيفه في المحاولة التالية',
    reportUnavailable: 'ملاحظاتك الكاملة موجودة على الشاشة التي تدرّبت فيها. يحتفظ هذا البريد بالسؤال ونموذج الإجابة وخطتك.',
    questionYouAnswered: 'السؤال الذي أجبت عنه',
    sampleAnswer: 'نموذج إجابة قوية',
    sampleNote: 'هذا هو شكل الإجابة القوية، مبني على دليل التقييم لهذا السؤال. ضع مثالك الحقيقي داخله.',
    today: (day: number) => `اليوم ${day}: سؤال اليوم`,
    hint: 'تلميح',
    openQuestion: 'أجب عن هذا السؤال',
    yourWeek: 'أيامك السبعة',
    dayLabel: 'اليوم',
    whatsapp: 'استلمها على واتساب بدلاً من ذلك',
    whatsappNote: 'نقرة واحدة ترسل الروابط السبعة إلى واتساب الخاص بك. لا نطلب رقم هاتفك.',
    browserCopy: 'افتح نسخة خاصة من خطتك في المتصفح',
    footer: 'طلبت هذه الرسائل بعد تدريبك على مقابلة. تتوقف بعد اليوم السابع. لم تتم إضافتك إلى أي قائمة تسويقية. رُدّ على هذا البريد إن أردت إيقافها قبل ذلك.',
    minutes: 'حوالي 10 دقائق.',
  },
} as const;

const styles = {
  body: 'margin:0;background:#FAF8F3;color:#17211E;font-family:Arial,Helvetica,sans-serif;line-height:1.6;font-size:17px',
  main: 'max-width:600px;margin:auto;padding:32px 20px',
  brand: 'font-weight:700;color:#147D6C;margin:0 0 16px',
  h1: 'color:#0E3B36;font-size:26px;line-height:1.3;margin:0 0 16px',
  h2: 'color:#0E3B36;font-size:20px;line-height:1.35;margin:28px 0 8px',
  p: 'margin:8px 0',
  small: 'font-size:14px;color:#52615b;margin:8px 0',
  card: 'background:#ffffff;border:1px solid #d8dedb;border-radius:12px;padding:18px 20px;margin:16px 0',
  button: 'display:inline-block;background:#0E3B36;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;margin:12px 0',
  link: 'color:#0E3B36;font-weight:700',
  list: 'padding-inline-start:20px;margin:8px 0',
} as const;

function paragraphs(items: string[]): string {
  return items.map((item) => `<p style="${styles.p}">${escapeHtml(item)}</p>`).join('');
}

function bullets(items: string[]): string {
  if (!items.length) return '';
  return `<ul style="${styles.list}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function tagLine(tags: string[], locale: 'en' | 'ar'): string {
  const labels = tags.map((tag) => questionTagLabel(tag, locale)).filter((label): label is string => Boolean(label));
  return labels.join(' · ');
}

function document(locale: 'en' | 'ar', title: string, body: string): string {
  const ar = locale === 'ar';
  return `<!doctype html><html lang="${locale}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="${styles.body}"><main style="${styles.main}" dir="${ar ? 'rtl' : 'ltr'}"><p style="${styles.brand}">${copy[locale].brand}</p>${body}</main></body></html>`;
}

function dayOneBody(plan: SevenDayPlan, links: PlanLinks): { html: string; text: string[] } {
  const c = copy[plan.locale];
  const first = plan.days[0];
  const report = plan.report;
  const reportHtml = report
    ? `<section style="${styles.card}"><h2 style="${styles.h2};margin-top:0">${c.yourFeedback}</h2>`
      + `<p style="${styles.p}"><strong>${escapeHtml(report.headline)}</strong>${report.score === null ? '' : ` · ${c.score} ${report.score}/100`}</p>`
      + (report.strengths.length ? `<p style="${styles.p}"><strong>${c.strengths}</strong></p>${bullets(report.strengths)}` : '')
      + (report.improvements.length ? `<p style="${styles.p}"><strong>${c.improvements}</strong></p>${bullets(report.improvements)}` : '')
      + (report.coachTip ? `<p style="${styles.p}"><strong>${c.coachTip}</strong> ${escapeHtml(report.coachTip)}</p>` : '')
      + '</section>'
    : `<p style="${styles.small}">${c.reportUnavailable}</p>`;
  const reportText = report
    ? [
      c.yourFeedback,
      `${report.headline}${report.score === null ? '' : ` (${c.score} ${report.score}/100)`}`,
      ...(report.strengths.length ? [c.strengths, ...report.strengths.map((item) => `- ${item}`)] : []),
      ...(report.improvements.length ? [c.improvements, ...report.improvements.map((item) => `- ${item}`)] : []),
      ...(report.coachTip ? [`${c.coachTip}: ${report.coachTip}`] : []),
      '',
    ]
    : [c.reportUnavailable, ''];

  const html = `<h1 style="${styles.h1}">${escapeHtml(c.subjectDayOne(plan.roleTitle))}</h1>`
    + `<p style="${styles.p}">${c.intro}</p>`
    + `<h2 style="${styles.h2}">${c.questionYouAnswered}</h2><p style="${styles.p}">${escapeHtml(plan.focusQuestionText)}</p>`
    + reportHtml
    + `<h2 style="${styles.h2}">${c.sampleAnswer}</h2><p style="${styles.small}">${c.sampleNote}</p>${paragraphs(plan.sampleAnswer)}`
    + `<section style="${styles.card}"><h2 style="${styles.h2};margin-top:0">${c.today(1)}</h2>`
    + `<p style="${styles.p}">${escapeHtml(first.questionText)}</p>`
    + (first.hint ? `<p style="${styles.small}">${c.hint}: ${escapeHtml(first.hint)}</p>` : '')
    + (first.tags.length ? `<p style="${styles.small}">${escapeHtml(tagLine(first.tags, plan.locale))}</p>` : '')
    + `<p><a href="${escapeHtml(links.days[0])}" style="${styles.button}">${c.openQuestion}</a></p><p style="${styles.small}">${c.minutes}</p></section>`
    + `<h2 style="${styles.h2}">${c.yourWeek}</h2><ol style="${styles.list}">`
    + plan.days.map((day, index) => `<li style="margin:6px 0"><a href="${escapeHtml(links.days[index])}" style="${styles.link}">${c.dayLabel} ${day.day}</a>: ${escapeHtml(day.questionText)}</li>`).join('')
    + '</ol>'
    + `<p><a href="${escapeHtml(links.whatsapp)}" style="${styles.link}">${c.whatsapp}</a></p><p style="${styles.small}">${c.whatsappNote}</p>`
    + `<p><a href="${escapeHtml(links.view)}" style="${styles.link}">${c.browserCopy}</a></p>`
    + `<p style="${styles.small}">${c.footer}</p>`;

  const text = [
    c.subjectDayOne(plan.roleTitle),
    '',
    c.intro,
    '',
    c.questionYouAnswered,
    plan.focusQuestionText,
    '',
    ...reportText,
    c.sampleAnswer,
    c.sampleNote,
    ...plan.sampleAnswer,
    '',
    c.today(1),
    first.questionText,
    ...(first.hint ? [`${c.hint}: ${first.hint}`] : []),
    links.days[0],
    '',
    c.yourWeek,
    ...plan.days.map((day, index) => `${c.dayLabel} ${day.day}: ${day.questionText}\n${links.days[index]}`),
    '',
    `${c.whatsapp}: ${links.whatsapp}`,
    '',
    `${c.browserCopy}: ${links.view}`,
    '',
    c.footer,
  ];
  return { html, text };
}

function laterDayBody(plan: SevenDayPlan, day: number, links: PlanLinks): { html: string; text: string[] } {
  const c = copy[plan.locale];
  const item = plan.days[day - 1];
  const link = links.days[day - 1];
  const tags = tagLine(item.tags, plan.locale);
  const html = `<h1 style="${styles.h1}">${escapeHtml(c.today(day))}</h1>`
    + `<section style="${styles.card}"><p style="${styles.p};font-size:19px"><strong>${escapeHtml(item.questionText)}</strong></p>`
    + (item.hint ? `<p style="${styles.small}">${c.hint}: ${escapeHtml(item.hint)}</p>` : '')
    + (tags ? `<p style="${styles.small}">${escapeHtml(tags)}</p>` : '')
    + `<p><a href="${escapeHtml(link)}" style="${styles.button}">${c.openQuestion}</a></p><p style="${styles.small}">${c.minutes}</p></section>`
    + `<p><a href="${escapeHtml(links.view)}" style="${styles.link}">${c.browserCopy}</a></p>`
    + `<p style="${styles.small}">${c.footer}</p>`;
  const text = [
    c.today(day),
    '',
    item.questionText,
    ...(item.hint ? [`${c.hint}: ${item.hint}`] : []),
    ...(tags ? [tags] : []),
    link,
    '',
    `${c.browserCopy}: ${links.view}`,
    '',
    c.footer,
  ];
  return { html, text };
}

/** Renders the email for one day of the plan. Day 1 carries the report, the sample answer and the WhatsApp offer. */
export function practicePlanEmail(plan: SevenDayPlan, day: number, links: PlanLinks): RenderedEmail {
  if (!Number.isInteger(day) || day < 1 || day > 7) throw new Error('invalid_plan_day');
  const c = copy[plan.locale];
  const subject = day === 1
    ? c.subjectDayOne(plan.roleTitle)
    : c.subjectDay(day, plan.days[day - 1].questionText.length > 70 ? `${plan.days[day - 1].questionText.slice(0, 69).trimEnd()}…` : plan.days[day - 1].questionText);
  const body = day === 1 ? dayOneBody(plan, links) : laterDayBody(plan, day, links);
  return { subject, html: document(plan.locale, subject, body.html), text: body.text.join('\n') };
}
