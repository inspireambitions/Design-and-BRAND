import type { InviteMessageInput } from './invite-message';

export type ReminderKind = 'reminder_1' | 'reminder_2' | 'completion';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

const OPENERS: Record<ReminderKind, { en: string; ar: string }> = {
  reminder_1: {
    en: 'A reminder: your video interview is still open.',
    ar: 'تذكير: مقابلة الفيديو لا تزال مفتوحة.',
  },
  reminder_2: {
    en: 'Last reminder: the link closes soon.',
    ar: 'التذكير الأخير: يُغلق الرابط قريباً.',
  },
  completion: {
    en: 'You started your answers. Finish when you are ready.',
    ar: 'بدأت إجاباتك. أكملها عندما تكون مستعداً.',
  },
};

export function reminderSubject(kind: ReminderKind, input: InviteMessageInput): string {
  const lead = kind === 'completion' ? 'Finish your answers' : kind === 'reminder_2' ? 'Last reminder' : 'Reminder';
  return `${lead}: ${input.employerName}, ${input.roleTitle} role`;
}

export function reminderText(kind: ReminderKind, input: InviteMessageInput): string {
  const opener = OPENERS[kind];
  return [
    opener.en,
    '',
    `${input.employerName} asked you to complete an adaptive video interview for the ${input.roleTitle} role. Allow about 25 minutes. Verify your email to continue.`,
    '',
    `Answer now: ${input.link}`,
    '',
    '----------',
    '',
    opener.ar,
    '',
    `طلبت ${input.employerName} منك إكمال مقابلة فيديو لوظيفة ${input.roleTitle}. نحو ٢٥ دقيقة. أكد بريدك للمتابعة.`,
    '',
    `أجب الآن: ${input.link}`,
  ].join('\n');
}

export function reminderHtml(kind: ReminderKind, input: InviteMessageInput): string {
  const opener = OPENERS[kind];
  const employer = escapeHtml(input.employerName);
  const role = escapeHtml(input.roleTitle);
  const link = escapeHtml(input.link);
  const button = (label: string) =>
    `<p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#0b7a6b;color:#ffffff;font-weight:700;text-decoration:none">${label}</a></p>`;
  return `<!doctype html><html><body style="margin:0;background:#f3f5f1;color:#16241f;font:16px/1.6 Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border:1px solid #d1dbd5;border-radius:18px;padding:28px">
<p style="margin:0 0 20px;color:#07564b;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Muqabala</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${escapeHtml(opener.en)}</h1>
<p style="margin:0 0 12px">${employer} asked you to complete an adaptive video interview for the <strong>${role}</strong> role. Allow about 25 minutes. Verify your email to continue.</p>
${button('Answer now')}
<hr style="border:0;border-top:1px solid #d1dbd5;margin:28px 0">
<div dir="rtl" style="text-align:right">
<h2 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(opener.ar)}</h2>
<p style="margin:0 0 12px">طلبت ${employer} منك إكمال مقابلة فيديو لوظيفة <strong>${role}</strong>. نحو ٢٥ دقيقة. أكد بريدك للمتابعة.</p>
${button('أجب الآن')}
</div>
</div></div></body></html>`;
}
