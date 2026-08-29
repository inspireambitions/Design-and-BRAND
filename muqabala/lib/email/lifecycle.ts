export type LifecycleEmailType = 'onboarding_2h' | 'career_tools_24h';
export type EmailLocale = 'en' | 'ar';

export type LifecycleEmailContent = {
  subject: string;
  html: string;
  text: string;
};

const ACCOUNT_URL = 'https://trymuqabala.com/account?utm_source=lifecycle_email&utm_medium=email&utm_campaign=onboarding_2h';
const PRACTICE_URL = 'https://trymuqabala.com/practice?utm_source=lifecycle_email&utm_medium=email&utm_campaign=career_tools_24h';
const CV_URL = 'https://cv.inspireambitions.com/?utm_source=muqabala&utm_medium=email&utm_campaign=career_tools_24h';
const RISK_URL = 'https://calculator.inspireambitions.com/?utm_source=muqabala&utm_medium=email&utm_campaign=career_tools_24h';
const PRIVACY_URL = 'https://trymuqabala.com/privacy';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function shell({
  locale,
  preview,
  heading,
  body,
  footer,
}: {
  locale: EmailLocale;
  preview: string;
  heading: string;
  body: string;
  footer: string;
}): string {
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${locale}" dir="${direction}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f5f2ea;color:#14261f;font-family:Arial,sans-serif;direction:${direction};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2ea;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #d8ded9;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:28px 30px 18px;border-bottom:1px solid #e8ece9;">
            <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#47705f;">Muqabala</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#14261f;">${escapeHtml(heading)}</h1>
          </td></tr>
          <tr><td style="padding:24px 30px;font-size:16px;line-height:1.65;color:#263c33;">${body}</td></tr>
          <tr><td style="padding:18px 30px 28px;border-top:1px solid #e8ece9;font-size:14px;line-height:1.6;color:#4f625a;">${footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function primaryLink(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#176b52;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px;">${escapeHtml(label)}</a></p>`;
}

function onboarding(locale: EmailLocale): LifecycleEmailContent {
  if (locale === 'ar') {
    const subject = 'تدريبك في مقابلة جاهز عندما تكون مستعداً';
    const preview = 'تابع مقابلة أو ابدأ تدريباً جديداً.';
    const body = `
      <p style="margin:0 0 16px;">مرحباً،</p>
      <p>شكراً لإنشاء حسابك في مقابلة.</p>
      <p>بنينا مقابلة لمساعدة الباحثين عن عمل على التدريب على أسئلة المقابلات لوظائف الخليج بخصوصية.</p>
      <p>تقاريرك ومقابلاتك غير المكتملة خاصة بحسابك. لا يمكن لأي صاحب عمل رؤيتها إلا إذا اخترت مشاركة تقرير. نحن لا نقيّم وجهك أو لهجتك أو شخصيتك.</p>
      <p><strong>جرّب هذا الآن:</strong> افتح حسابك. تابع مقابلة أو ابدأ تدريباً جديداً.</p>
      ${primaryLink(ACCOUNT_URL, 'ارجع إلى حسابي')}
      <p style="margin-bottom:0;">فريق مقابلة<br><span style="color:#66766f;">أداة من إنسباير أمبيشنز</span></p>`;
    return {
      subject,
      text: `مرحباً،\n\nشكراً لإنشاء حسابك في مقابلة.\n\nبنينا مقابلة لمساعدة الباحثين عن عمل على التدريب على أسئلة المقابلات لوظائف الخليج بخصوصية.\n\nتقاريرك ومقابلاتك غير المكتملة خاصة بحسابك. لا يمكن لأي صاحب عمل رؤيتها إلا إذا اخترت مشاركة تقرير. نحن لا نقيّم وجهك أو لهجتك أو شخصيتك.\n\nجرّب هذا الآن: افتح حسابك. تابع مقابلة أو ابدأ تدريباً جديداً.\n\nارجع إلى حسابي: ${ACCOUNT_URL}\n\nفريق مقابلة\nأداة من إنسباير أمبيشنز`,
      html: shell({ locale, preview, heading: subject, body, footer: 'وصلتك هذه الرسالة لأنك أنشأت حساباً مؤكداً في مقابلة. هذه رسالة خدمة للحساب وليست اشتراكاً في رسائل تسويقية.' }),
    };
  }

  const subject = 'Your Muqabala practice is ready when you are';
  const preview = 'Continue an interview or start a new practice.';
  const body = `
    <p style="margin:0 0 16px;">Hello,</p>
    <p>Thank you for creating your Muqabala account.</p>
    <p>We built Muqabala to help job seekers practise interview questions for Gulf jobs in private.</p>
    <p>Your reports and unfinished interviews are private to your account. No employer can see them unless you choose to share a report. We do not score your face, accent or personality.</p>
    <p><strong>Try this next:</strong> open your account. Continue an interview or start a new one.</p>
    ${primaryLink(ACCOUNT_URL, 'Return to my account')}
    <p style="margin-bottom:0;">The Muqabala Team<br><span style="color:#66766f;">A tool by Inspire Ambitions</span></p>`;
  return {
    subject,
    text: `Hello,\n\nThank you for creating your Muqabala account.\n\nWe built Muqabala to help job seekers practise interview questions for Gulf jobs in private.\n\nYour reports and unfinished interviews are private to your account. No employer can see them unless you choose to share a report. We do not score your face, accent or personality.\n\nTry this next: open your account. Continue an interview or start a new one.\n\nReturn to my account: ${ACCOUNT_URL}\n\nThe Muqabala Team\nA tool by Inspire Ambitions`,
    html: shell({ locale, preview, heading: subject, body, footer: 'You received this account service email because you created a verified Muqabala account. It does not subscribe you to marketing emails.' }),
  };
}

function careerTools(locale: EmailLocale, unsubscribeUrl: string, senderAddress: string, businessAddress: string): LifecycleEmailContent {
  if (locale === 'ar') {
    const subject = 'أداتان لطلبك الوظيفي التالي';
    const preview = 'أنشئ سيرتك الذاتية للخليج واعرف كيف قد يؤثر الذكاء الاصطناعي في مهامك اليومية.';
    const body = `
      <p style="margin:0 0 16px;">مرحباً،</p>
      <p>شكراً لتجربة مقابلة.</p>
      <p>بنينا مقابلة لأن المرشح الجيد قد يحتاج إلى مكان خاص ليتدرب على شرح خبرته تحت الضغط.</p>
      <p>لقد اخترت تلقي نصائح وأدوات مهنية من مقابلة وإنسباير أمبيشنز.</p>
      <p>إليك أداتان يمكنك استخدامهما الآن:</p>
      <ul style="padding-inline-start:22px;">
        <li style="margin-bottom:12px;"><a href="${CV_URL}" style="color:#176b52;font-weight:700;">منشئ السيرة الذاتية للخليج من إنسباير أمبيشنز</a><br>أنشئ سيرتك الذاتية أو حسّنها قبل التقديم.</li>
        <li><a href="${RISK_URL}" style="color:#176b52;font-weight:700;">حاسبة مخاطر الذكاء الاصطناعي على الوظائف</a><br>اعرف كيف قد يؤثر الذكاء الاصطناعي في مهامك اليومية.</li>
      </ul>
      ${primaryLink(PRACTICE_URL, 'تدرّب على إجابة أخرى')}
      <p>أضف ${escapeHtml(senderAddress)} إلى جهات اتصالك حتى تجد تحديثاتنا المفيدة بسهولة.</p>
      <p style="margin-bottom:0;">فريق مقابلة<br><span style="color:#66766f;">أداة من إنسباير أمبيشنز</span></p>`;
    return {
      subject,
      text: `مرحباً،\n\nشكراً لتجربة مقابلة.\n\nبنينا مقابلة لأن المرشح الجيد قد يحتاج إلى مكان خاص ليتدرب على شرح خبرته تحت الضغط.\n\nلقد اخترت تلقي نصائح وأدوات مهنية من مقابلة وإنسباير أمبيشنز.\n\nإليك أداتان يمكنك استخدامهما الآن:\n\nمنشئ السيرة الذاتية للخليج من إنسباير أمبيشنز: ${CV_URL}\nحاسبة مخاطر الذكاء الاصطناعي على الوظائف: ${RISK_URL}\n\nتدرّب على إجابة أخرى: ${PRACTICE_URL}\n\nأضف ${senderAddress} إلى جهات اتصالك حتى تجد تحديثاتنا المفيدة بسهولة.\n\nإلغاء الاشتراك: ${unsubscribeUrl}\nسياسة الخصوصية: ${PRIVACY_URL}\n${businessAddress}\n\nفريق مقابلة\nأداة من إنسباير أمبيشنز`,
      html: shell({ locale, preview, heading: subject, body, footer: `اخترت تلقي هذه التحديثات. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#176b52;font-weight:700;">إلغاء الاشتراك</a> · <a href="${PRIVACY_URL}" style="color:#176b52;">سياسة الخصوصية</a><br>${escapeHtml(businessAddress)}` }),
    };
  }

  const subject = 'Two tools for your next job application';
  const preview = 'Build your Gulf CV and check how AI may affect your daily tasks.';
  const body = `
    <p style="margin:0 0 16px;">Hello,</p>
    <p>Thank you for trying Muqabala.</p>
    <p>We built Muqabala because a good candidate may need a private place to practise explaining their experience under pressure.</p>
    <p>You asked to receive career tips and tools from Muqabala and Inspire Ambitions.</p>
    <p>Here are two tools you can use now:</p>
    <ul style="padding-left:22px;">
      <li style="margin-bottom:12px;"><a href="${CV_URL}" style="color:#176b52;font-weight:700;">Inspire Ambitions Gulf CV Builder</a><br>Create or improve your CV before you apply.</li>
      <li><a href="${RISK_URL}" style="color:#176b52;font-weight:700;">AI Job Risk Calculator</a><br>See how AI may affect the tasks you do each day.</li>
    </ul>
    ${primaryLink(PRACTICE_URL, 'Practise another answer')}
    <p>Add ${escapeHtml(senderAddress)} to your contacts so our useful updates are easier to find.</p>
    <p style="margin-bottom:0;">The Muqabala Team<br><span style="color:#66766f;">A tool by Inspire Ambitions</span></p>`;
  return {
    subject,
    text: `Hello,\n\nThank you for trying Muqabala.\n\nWe built Muqabala because a good candidate may need a private place to practise explaining their experience under pressure.\n\nYou asked to receive career tips and tools from Muqabala and Inspire Ambitions.\n\nHere are two tools you can use now:\n\nInspire Ambitions Gulf CV Builder: ${CV_URL}\nAI Job Risk Calculator: ${RISK_URL}\n\nPractise another answer: ${PRACTICE_URL}\n\nAdd ${senderAddress} to your contacts so our useful updates are easier to find.\n\nUnsubscribe: ${unsubscribeUrl}\nPrivacy: ${PRIVACY_URL}\n${businessAddress}\n\nThe Muqabala Team\nA tool by Inspire Ambitions`,
    html: shell({ locale, preview, heading: subject, body, footer: `You chose to receive these updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#176b52;font-weight:700;">Unsubscribe</a> · <a href="${PRIVACY_URL}" style="color:#176b52;">Privacy</a><br>${escapeHtml(businessAddress)}` }),
  };
}

export function renderLifecycleEmail({
  type,
  locale,
  unsubscribeUrl,
  senderAddress,
  businessAddress,
}: {
  type: LifecycleEmailType;
  locale: EmailLocale;
  unsubscribeUrl?: string;
  senderAddress?: string;
  businessAddress?: string;
}): LifecycleEmailContent {
  if (type === 'onboarding_2h') return onboarding(locale);
  if (!unsubscribeUrl || !senderAddress || !businessAddress) throw new Error('The career tools email requires unsubscribe, sender and business address details.');
  return careerTools(locale, unsubscribeUrl, senderAddress, businessAddress);
}
