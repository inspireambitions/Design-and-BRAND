function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

type Input = {
  companyName: string;
  roleTitle: string;
  invitationUrl: string;
  expiresAt: string;
};

export function buildScreeningInvitationEmail(input: Input) {
  const company = escapeHtml(input.companyName);
  const role = escapeHtml(input.roleTitle);
  const url = escapeHtml(input.invitationUrl);
  const expiry = new Date(input.expiresAt).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dubai', day: 'numeric', month: 'long', year: 'numeric',
  });
  const subject = `${input.companyName} invited you to a ${input.roleTitle} work sample`.replace(/[\r\n]+/g, ' ').slice(0, 180);
  const text = `${input.companyName} invited you to complete a ${input.roleTitle} video work sample through Muqabala.\n\nIt has three questions and takes about 12 minutes. Your answers are reviewed by the employer. Nothing is automatically rejected.\n\nStart your work sample: ${input.invitationUrl}\n\nThis invitation closes on ${expiry}. If you did not expect this invitation, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f1;color:#10231d;font:16px/1.6 Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #d1dbd5;border-radius:18px;padding:28px"><p style="margin:0 0 20px;color:#087b68;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Muqabala</p><h1 style="margin:0 0 16px;font-size:27px;line-height:1.2">${company} invited you to show how you would handle the job.</h1><p>Complete a <strong>${role}</strong> video work sample with three questions. It takes about 12 minutes.</p><p>Your answers are reviewed by the employer. Nothing is automatically rejected.</p><p><a href="${url}" style="display:inline-block;margin-top:8px;padding:12px 18px;border-radius:10px;background:#087b68;color:#fff;font-weight:700;text-decoration:none">Start work sample</a></p><p style="margin:24px 0 0;color:#65766f;font-size:13px">This invitation closes on ${escapeHtml(expiry)}. If you did not expect it, you can ignore this email.</p></div></div></body></html>`;
  return { subject, text, html };
}
