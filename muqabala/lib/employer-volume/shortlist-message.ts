import type { Coverage } from './coverage';

/** Plain-text ticks for the text part: "✓ ✓ ✗ ✓". Mirrors coverageMarks in coverage.ts, kept local so Node can import this module without a bundler. */
function coverageMarks(coverage: Coverage): string {
  return coverage.items.map((item) => (item.covered ? '\u2713' : '\u2717')).join(' ');
}

export type ShortlistRow = {
  displayName: string;
  coverage: Coverage;
  firstAnswer: string;
  openUrl: string;
};

export type ShortlistInput = {
  roleTitle: string;
  employerName: string;
  invited: number;
  answered: number;
  fullCoverage: number;
  rows: ShortlistRow[];
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

export const FIRST_ANSWER_CHARS = 90;

export function firstAnswerSnippet(transcript: string | null | undefined): string {
  const clean = (transcript ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'No transcript yet.';
  return clean.length > FIRST_ANSWER_CHARS ? `${clean.slice(0, FIRST_ANSWER_CHARS).trimEnd()}...` : clean;
}

export function shortlistSubject(input: ShortlistInput): string {
  return `${input.roleTitle}: ${input.answered} answered, ${input.fullCoverage} to review`;
}

export function shortlistText(input: ShortlistInput): string {
  const lines = [
    `${input.employerName}: ${input.roleTitle}`,
    `${input.invited} invited. ${input.answered} answered. ${input.fullCoverage} with full rubric coverage.`,
    '',
  ];
  for (const row of input.rows) {
    lines.push(`${row.displayName}  ${coverageMarks(row.coverage)}`);
    lines.push(`  "${row.firstAnswer}"`);
    lines.push(`  Open: ${row.openUrl}`);
    lines.push('');
  }
  lines.push('You decide. Nothing is rejected automatically. Ticks show which rubric items the candidate gave evidence for; they are not a score.');
  return lines.join('\n');
}

export function shortlistHtml(input: ShortlistInput): string {
  const rows = input.rows.map((row) => `
<tr>
  <td style="padding:12px 0;border-top:1px solid #e3e8e4;vertical-align:top">
    <div style="font-weight:700">${escapeHtml(row.displayName)}</div>
    <div style="margin:4px 0;font-size:15px;letter-spacing:.15em">${row.coverage.items.map((item) => item.covered
      ? '<span style="color:#087662" aria-label="covered">&#10003;</span>'
      : '<span style="color:#a33f2c" aria-label="not covered">&#10007;</span>').join(' ')}</div>
    <div style="color:#536860;font-size:14px">&ldquo;${escapeHtml(row.firstAnswer)}&rdquo;</div>
  </td>
  <td style="padding:12px 0 12px 16px;border-top:1px solid #e3e8e4;vertical-align:top;white-space:nowrap">
    <a href="${escapeHtml(row.openUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0b7a6b;color:#fff;font-weight:700;text-decoration:none">Open</a>
  </td>
</tr>`).join('');

  return `<!doctype html><html><body style="margin:0;background:#f3f5f1;color:#16241f;font:16px/1.6 Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border:1px solid #d1dbd5;border-radius:18px;padding:28px">
<p style="margin:0 0 16px;color:#07564b;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Muqabala shortlist</p>
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3">${escapeHtml(input.roleTitle)}</h1>
<p style="margin:0 0 20px;color:#536860">${input.invited} invited. ${input.answered} answered. ${input.fullCoverage} with full rubric coverage.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows}</table>
<p style="margin:24px 0 0;color:#65766f;font-size:13px">You decide. Nothing is rejected automatically. Ticks show which rubric items the candidate gave evidence for; they are not a score. Each Open link signs you in and lands on that candidate.</p>
</div></div></body></html>`;
}

/**
 * Up to ten rows: coverage count descending, then earliest submission. When
 * fewer than three have full coverage, the list is filled by coverage count,
 * which the same ordering already achieves.
 */
export function pickShortlistRows<T extends { coverage: Coverage; submittedAt: string }>(candidates: T[]): T[] {
  return [...candidates]
    .sort((a, b) => (b.coverage.covered - a.coverage.covered) || (new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()))
    .slice(0, 10);
}
