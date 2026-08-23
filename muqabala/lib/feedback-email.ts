import type { RatingFeedback } from './rating-feedback';

const SITE_URL = 'https://trymuqabala.com';

function readinessLabel(value: RatingFeedback['confidence']): string {
  if (value === 'more') return 'More ready';
  if (value === 'less') return 'Less ready';
  return 'About the same';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}

export function buildFeedbackEmail(input: {
  rating: RatingFeedback;
  roleLabel: string;
  receivedAt: string;
  shareUrls?: { square: string; wide: string };
}) {
  const { rating, receivedAt } = input;
  const roleLabel = escapeHtml(input.roleLabel);
  const confidence = readinessLabel(rating.confidence);
  const score = rating.overallScore === null ? 'Not scored' : `${rating.overallScore}/100`;
  const language = rating.language === 'ar' ? 'Arabic' : 'English';
  const stars = `${'★'.repeat(rating.stars)}${'☆'.repeat(5 - rating.stars)}`;
  const publicStatus = rating.publicConsent
    ? 'Approved for anonymous sharing'
    : 'Private feedback. Do not publish';
  const statusColour = rating.publicConsent ? '#46c7ae' : '#f2b84b';
  const subject = rating.publicConsent
    ? `Approved social proof · ${rating.stars}/5 · ${confidence}`
    : `New Muqabala rating · ${rating.stars}/5 · ${confidence}`;
  const socialStatement = `A Muqabala candidate completed ${rating.questionsAnswered} interview questions and felt ${confidence.toLowerCase()} for the real interview.`;

  const lines = [
    `Usefulness: ${rating.stars}/5`,
    `Readiness: ${confidence}`,
    `Role: ${input.roleLabel}`,
    `Overall score: ${score}`,
    `Questions answered: ${rating.questionsAnswered}`,
    `Language: ${language}`,
    `Public sharing: ${rating.publicConsent ? 'Approved anonymously' : 'Not approved'}`,
    `Received: ${receivedAt}`,
  ];

  const downloadButtons = input.shareUrls
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;border-collapse:separate;border-spacing:8px 0;"><tr>
        <td><a href="${escapeHtml(input.shareUrls.square)}" style="display:inline-block;padding:12px 15px;border-radius:999px;background:#10261e;color:#f5f1e7;font:700 13px/1 Arial,sans-serif;text-decoration:none;">Square image</a></td>
        <td><a href="${escapeHtml(input.shareUrls.wide)}" style="display:inline-block;padding:12px 15px;border-radius:999px;background:#287f70;color:#ffffff;font:700 13px/1 Arial,sans-serif;text-decoration:none;">Wide image</a></td>
      </tr></table>`
    : '';
  const shareHelp = input.shareUrls
    ? 'Square fits Instagram, LinkedIn and general social posts. Wide fits X and newsletters.'
    : 'Screenshot the card above for social media or the website.';

  const shareCard = rating.publicConsent
    ? `<tr><td style="padding:0 28px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f5f1e7;border-radius:18px;color:#10261e;">
          <tr><td style="padding:26px 26px 18px;">
            <div style="font:700 11px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#287f70;">Share-ready proof</div>
            <div style="margin-top:22px;font:700 34px/1 Georgia,serif;color:#10261e;">${rating.stars}/5</div>
            <div style="margin-top:8px;font:700 22px/1 Arial,sans-serif;letter-spacing:2px;color:#d69a28;">${stars}</div>
            <div style="margin-top:22px;font:700 25px/1.25 Georgia,serif;color:#10261e;">${escapeHtml(socialStatement)}</div>
            <div style="margin-top:22px;padding-top:16px;border-top:1px solid #cbd8d1;font:700 12px/1.4 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#287f70;">Muqabala · Practise until you feel ready</div>
            ${downloadButtons}
          </td></tr>
        </table>
        <p style="margin:10px 4px 0;font:12px/1.5 Arial,sans-serif;color:#8ca59c;">This candidate approved anonymous sharing. ${shareHelp}</p>
      </td></tr>`
    : '';

  const html = `<!doctype html>
<html><body style="margin:0;background:#07150f;color:#f5f7f2;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#07150f;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:collapse;background:#10261e;border:1px solid #28453a;border-radius:24px;overflow:hidden;">
        <tr><td style="padding:28px 28px 20px;border-bottom:1px solid #28453a;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font:700 20px/1 Arial,sans-serif;color:#f5f7f2;">Muqabala</td>
            <td align="right"><span style="display:inline-block;padding:7px 10px;border:1px solid ${statusColour};border-radius:999px;font:700 10px/1 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${statusColour};">${publicStatus}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:30px 28px 8px;">
          <div style="font:700 11px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#46c7ae;">Candidate signal</div>
          <div style="margin-top:16px;font:700 54px/1 Georgia,serif;color:#f5f7f2;">${rating.stars}<span style="font-size:25px;color:#8ca59c;">/5</span></div>
          <div style="margin-top:8px;font:700 23px/1 Arial,sans-serif;letter-spacing:3px;color:#f2b84b;">${stars}</div>
          <div style="margin-top:22px;font:700 27px/1.25 Georgia,serif;color:#f5f7f2;">${escapeHtml(confidence)} for the real interview.</div>
        </td></tr>
        <tr><td style="padding:22px 28px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td width="50%" style="padding:16px;background:#18342a;border-bottom:1px solid #28453a;font:12px/1.5 Arial,sans-serif;color:#8ca59c;">ROLE<br><strong style="font-size:16px;color:#f5f7f2;">${roleLabel}</strong></td>
              <td width="50%" style="padding:16px;background:#18342a;border-left:1px solid #28453a;border-bottom:1px solid #28453a;font:12px/1.5 Arial,sans-serif;color:#8ca59c;">QUESTIONS<br><strong style="font-size:16px;color:#f5f7f2;">${rating.questionsAnswered}</strong></td>
            </tr>
            <tr>
              <td width="50%" style="padding:16px;background:#18342a;font:12px/1.5 Arial,sans-serif;color:#8ca59c;">INTERVIEW SCORE<br><strong style="font-size:16px;color:#f5f7f2;">${score}</strong></td>
              <td width="50%" style="padding:16px;background:#18342a;border-left:1px solid #28453a;font:12px/1.5 Arial,sans-serif;color:#8ca59c;">LANGUAGE<br><strong style="font-size:16px;color:#f5f7f2;">${language}</strong></td>
            </tr>
          </table>
        </td></tr>
        ${shareCard}
        <tr><td align="center" style="padding:4px 28px 30px;">
          <a href="${SITE_URL}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#46c7ae;color:#07150f;font:700 14px/1 Arial,sans-serif;text-decoration:none;">Open Muqabala</a>
          <p style="margin:20px 0 0;font:12px/1.6 Arial,sans-serif;color:#8ca59c;">No name, email address, answer text, audio or video was collected with this rating.<br>Received ${escapeHtml(receivedAt)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    'MUQABALA CANDIDATE RATING',
    publicStatus,
    '',
    ...lines,
    ...(rating.publicConsent ? ['', 'SHARE-READY PROOF', socialStatement, `Rated ${rating.stars}/5.`] : []),
    '',
    'No name, email address, answer text, audio or video was collected with this rating.',
  ].join('\n');

  return { html, subject, text };
}
