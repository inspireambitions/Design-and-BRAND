export interface RoadmapEmailData {
  from: string; // current role
  to: string; // target role
  months: number;
  hoursPerWeek: number;
  matchBand: string;
  difficulty: number;
  difficultyLabel: string;
  steps: { title: string; duration: string }[];
  siteUrl: string;
}

// Inline styles only — every serious email client strips <style> blocks and
// none of them support custom fonts, so this deliberately falls back to
// the system stack the parent site uses rather than a webfont.
export function roadmapEmailHtml(d: RoadmapEmailData): string {
  const steps = d.steps
    .map(
      (s, i) => `
      <tr>
        <td style="padding:0 0 14px 0;vertical-align:top;width:32px;">
          <div style="width:26px;height:26px;border-radius:13px;background:#0B2239;color:#7CC0EE;font:600 12px/26px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;">${i + 1}</div>
        </td>
        <td style="padding:0 0 14px 0;vertical-align:top;">
          <div style="font:600 16px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0B2239;">${escapeHtml(s.title)}</div>
          <div style="font:400 13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#1A7DC4;padding-top:2px;">${escapeHtml(s.duration)}</div>
        </td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F8F9FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid rgba(11,34,57,0.10);">

    <tr><td style="background:#0B2239;padding:32px;">
      <div style="font:600 13px/1 'Helvetica Neue',Arial,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#7CC0EE;">Inspire Ambitions</div>
      <div style="font:400 12px/1 'Helvetica Neue',Arial,sans-serif;color:rgba(255,255,255,0.55);padding-top:6px;">Career Change Roadmap</div>
      <div style="font:600 26px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#FFFFFF;padding-top:14px;">
        ${escapeHtml(d.from)} <span style="color:#7CC0EE;">&rarr;</span> ${escapeHtml(d.to)}
      </div>
      <div style="font:400 15px/1.5 'Helvetica Neue',Arial,sans-serif;color:rgba(255,255,255,0.72);padding-top:8px;">
        ${d.months} months at ${d.hoursPerWeek} hrs/week &middot; ${escapeHtml(d.difficultyLabel)} planning route
      </div>
    </td></tr>

    <tr><td style="padding:32px;">
      <div style="font:600 18px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0B2239;padding-bottom:6px;">Your path, in ${d.steps.length} steps</div>
      <div style="font:400 15px/1.6 'Helvetica Neue',Arial,sans-serif;color:#3D4A5C;padding-bottom:20px;">
        Keep this email. The full roadmap &mdash; training checks, proof-of-skill tasks, local
        pay research, interview practice and the rest &mdash; is in your browser at the link below.
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}</table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="padding-top:14px;">
        <tr><td style="background:#1A7DC4;border-radius:999px;">
          <a href="${escapeAttr(d.siteUrl)}/report" style="display:inline-block;padding:14px 28px;font:600 15px/1 'Helvetica Neue',Arial,sans-serif;color:#FFFFFF;text-decoration:none;">Open my full roadmap &rarr;</a>
        </td></tr>
      </table>

      <div style="font:400 13px/1.6 'Helvetica Neue',Arial,sans-serif;color:#6B7A8F;padding-top:22px;border-top:1px solid rgba(11,34,57,0.10);margin-top:26px;">
        Your roadmap is stored in the browser you created it in, so open that link on the same
        device. This is career guidance, not a test, licence, visa assessment, salary promise or job guarantee.
      </div>
    </td></tr>

  </table>
  <div style="font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#6B7A8F;padding-top:18px;max-width:560px;">
    You got this because you asked Inspire Ambitions for a career change roadmap. We don&rsquo;t send anything else unless you ask.
  </div>
</td></tr>
</table>
</body></html>`;
}

export function roadmapEmailText(d: RoadmapEmailData): string {
  const steps = d.steps.map((s, i) => `${i + 1}. ${s.title} (${s.duration})`).join("\n");
  return `INSPIRE AMBITIONS · CAREER CHANGE ROADMAP
${d.from} -> ${d.to}

${d.months} months at ${d.hoursPerWeek} hrs/week
Planning difficulty: ${d.difficultyLabel}

YOUR PATH, IN ${d.steps.length} STEPS
${steps}

Open your full roadmap: ${d.siteUrl}/report

Your roadmap is stored in the browser you created it in, so open that link on
the same device. This is career guidance, not a test, licence, visa assessment,
salary promise or job guarantee.

You got this because you asked Inspire Ambitions for a career change roadmap.
We don't send anything else unless you ask.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
