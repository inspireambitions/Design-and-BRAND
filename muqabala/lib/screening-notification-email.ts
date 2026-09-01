function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

type Input = {
  kind: 'candidate' | 'employer';
  companyName: string;
  roleTitle: string;
  submittedAt: string;
  reference: string;
  dashboardUrl?: string;
};

export function buildScreeningNotificationEmail(input: Input) {
  const company = escapeHtml(input.companyName);
  const role = escapeHtml(input.roleTitle);
  const reference = escapeHtml(input.reference);
  const submitted = new Date(input.submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' });
  const shell = (body: string) => `<!doctype html><html><body style="margin:0;background:#f3f5f1;color:#10231d;font:16px/1.6 Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #d1dbd5;border-radius:18px;padding:28px"><p style="margin:0 0 20px;color:#087b68;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Muqabala</p>${body}<p style="margin:24px 0 0;color:#65766f;font-size:13px">Reference: ${reference}<br>Submitted: ${escapeHtml(submitted)} UAE time</p></div></div></body></html>`;

  if (input.kind === 'candidate') {
    const subject = `Your ${input.roleTitle} interview was submitted`;
    const text = `Your interview for ${input.roleTitle} at ${input.companyName} was submitted successfully.\n\nThe employer will review your responses and contact you directly if you are shortlisted.\n\nReference: ${input.reference}\nSubmitted: ${submitted} UAE time`;
    return {
      subject,
      text,
      html: shell(`<h1 style="margin:0 0 16px;font-size:27px;line-height:1.2">Your interview was submitted successfully.</h1><p>Your interview for <strong>${role}</strong> at <strong>${company}</strong> has been sent.</p><p>The employer will review your responses and contact you directly if you are shortlisted.</p>`),
    };
  }

  const dashboardUrl = escapeHtml(input.dashboardUrl ?? 'https://trymuqabala.com/employer');
  const subject = `New ${input.roleTitle} interview ready to review`;
  const text = `A ${input.roleTitle} interview for ${input.companyName} has been submitted and is ready to review.\n\nOpen the Muqabala employer dashboard: ${input.dashboardUrl}\n\nReference: ${input.reference}\nSubmitted: ${submitted} UAE time`;
  return {
    subject,
    text,
    html: shell(`<h1 style="margin:0 0 16px;font-size:27px;line-height:1.2">A new interview is ready to review.</h1><p>A <strong>${role}</strong> interview for <strong>${company}</strong> has been submitted.</p><p><a href="${dashboardUrl}" style="display:inline-block;margin-top:8px;padding:12px 18px;border-radius:10px;background:#087b68;color:#fff;font-weight:700;text-decoration:none">Review in Muqabala</a></p><p style="color:#65766f;font-size:13px">Sign in with your registered employer email. Videos and interview evidence are never attached to email.</p>`),
  };
}
