import type { SevenDayPlan } from './schema';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

export function practicePlanEmail(
  locale: 'en' | 'ar',
  plan: SevenDayPlan,
  viewUrl: string,
): { subject: string; html: string; text: string } {
  const ar = locale === 'ar';
  const subject = ar ? 'خطة تدريب المقابلة لمدة 7 أيام' : 'Your 7-day interview practice plan';
  const dayLabel = ar ? 'اليوم' : 'Day';
  const minutes = ar ? 'دقيقة' : 'minutes';
  const why = ar ? 'لماذا يهم هذا' : 'Why this matters';
  const check = ar ? 'علامة النجاح' : 'Success check';
  const rows = plan.days.map((day) => `
    <section style="border-top:1px solid #d8dedb;padding:20px 0">
      <h2 style="margin:0 0 8px;color:#0E3B36;font-size:20px">${dayLabel} ${day.day}: ${escapeHtml(day.focus)}</h2>
      <p style="margin:6px 0"><strong>${why}:</strong> ${escapeHtml(day.whyThisMatters)}</p>
      <p style="margin:6px 0">${escapeHtml(day.exercise)}</p>
      <p style="margin:6px 0;color:#52615b">${day.estimatedMinutes} ${minutes}</p>
      <p style="margin:6px 0"><strong>${check}:</strong> ${escapeHtml(day.successCheck)}</p>
    </section>`).join('');
  const html = `<!doctype html><html lang="${locale}" dir="${ar ? 'rtl' : 'ltr'}"><body style="margin:0;background:#FAF8F3;color:#17211E;font-family:Arial,sans-serif;line-height:1.55"><main style="max-width:640px;margin:auto;padding:32px 20px"><p style="font-weight:700;color:#147D6C">Muqabala</p><h1 style="color:#0E3B36">${escapeHtml(subject)}</h1><p>${escapeHtml(plan.summary)}</p>${rows}<p><a href="${escapeHtml(viewUrl)}" style="color:#0E3B36;font-weight:700">${ar ? 'افتح نسخة خاصة في المتصفح' : 'Open a private browser copy'}</a></p><p style="font-size:13px;color:#52615b">${ar ? 'أُرسل هذا البريد لتنفيذ طلبك فقط. لم تتم إضافتك إلى قائمة تسويقية.' : 'This email was sent only to fulfil your request. You were not added to a marketing list.'}</p></main></body></html>`;
  const text = [
    subject,
    '',
    plan.summary,
    '',
    ...plan.days.flatMap((day) => [
      `${dayLabel} ${day.day}: ${day.focus}`,
      `${why}: ${day.whyThisMatters}`,
      day.exercise,
      `${day.estimatedMinutes} ${minutes}`,
      `${check}: ${day.successCheck}`,
      '',
    ]),
    ar ? 'نسخة خاصة في المتصفح:' : 'Private browser copy:',
    viewUrl,
  ].join('\n');
  return { subject, html, text };
}
