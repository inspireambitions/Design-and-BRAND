/**
 * Invite copy sent to candidates. English first, Arabic below a rule. Plain
 * text always included. The WhatsApp variant stays under 300 characters.
 */

export type InviteMessageInput = {
  employerName: string;
  roleTitle: string;
  link: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

export function inviteSubject(input: InviteMessageInput): string {
  return `${input.employerName}: adaptive interview for the ${input.roleTitle} role`;
}

export function inviteText(input: InviteMessageInput): string {
  return [
    `${input.employerName} invites you to complete an adaptive video interview for the ${input.roleTitle} role.`,
    '',
    'Allow about 25 minutes. Verify your email, then record up to eight main answers. Your video stays on your device until you choose to submit.',
    '',
    `Answer now: ${input.link}`,
    '',
    '----------',
    '',
    `تدعوك ${input.employerName} لإكمال مقابلة فيديو لوظيفة ${input.roleTitle}.`,
    '',
    'نحو ٢٥ دقيقة. أكد بريدك ثم سجّل ثماني إجابات. يبقى الفيديو على جهازك حتى تختار الإرسال.',
    '',
    `أجب الآن: ${input.link}`,
  ].join('\n');
}

export function inviteHtml(input: InviteMessageInput): string {
  const employer = escapeHtml(input.employerName);
  const role = escapeHtml(input.roleTitle);
  const link = escapeHtml(input.link);
  const button = (label: string) =>
    `<p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#0b7a6b;color:#ffffff;font-weight:700;text-decoration:none">${label}</a></p>`;
  return `<!doctype html><html><body style="margin:0;background:#f3f5f1;color:#16241f;font:16px/1.6 Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border:1px solid #d1dbd5;border-radius:18px;padding:28px">
<p style="margin:0 0 20px;color:#07564b;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Muqabala</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${employer} invites you to an adaptive interview</h1>
<p style="margin:0 0 12px">Role: <strong>${role}</strong></p>
<p style="margin:0 0 12px">Allow about 25 minutes. Verify your email, then record up to eight main answers. Your video stays on your device until you choose to submit.</p>
${button('Answer now')}
<hr style="border:0;border-top:1px solid #d1dbd5;margin:28px 0">
<div dir="rtl" style="text-align:right">
<h2 style="margin:0 0 16px;font-size:22px;line-height:1.3">تدعوك ${employer} إلى مقابلة فيديو</h2>
<p style="margin:0 0 12px">الوظيفة: <strong>${role}</strong></p>
<p style="margin:0 0 12px">نحو ٢٥ دقيقة. أكد بريدك ثم سجّل ثماني إجابات. يبقى الفيديو على جهازك حتى تختار الإرسال.</p>
${button('أجب الآن')}
</div>
<p style="margin:24px 0 0;color:#65766f;font-size:13px">If the button does not open, copy this link: ${link}</p>
</div></div></body></html>`;
}

/** Under 300 characters including the link. */
export function inviteWhatsApp(input: InviteMessageInput): string {
  const base = `${input.employerName}: adaptive video interview for the ${input.roleTitle} role. Allow 25 minutes. Verify your email, record your answers, then submit. Start: ${input.link}`;
  if (base.length <= 300) return base;
  const room = 300 - `${input.employerName}: adaptive interview. 25 minutes. Verify your email. Start: ${input.link}`.length;
  const role = room > 12 ? ` (${input.roleTitle.slice(0, room - 3)})` : '';
  return `${input.employerName}: adaptive interview${role}. 25 minutes. Verify your email. Start: ${input.link}`.slice(0, 300);
}
