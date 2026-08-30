'use client';

import { useLang } from './LanguageProvider';
import styles from './EmployerVideoInterview.module.css';

type Reason = 'expired' | 'full' | 'unavailable';

const COPY = {
  en: {
    label: 'Employer interview',
    expiredTitle: 'This interview link has expired.',
    expiredBody: 'The hiring team set an end date for this interview. Contact them if you still need to take part.',
    fullTitle: 'This interview link has reached its candidate limit.',
    fullBody: 'No more candidate places are available. Contact the hiring team that sent you the link.',
    unavailableTitle: 'This interview link is not available.',
    unavailableBody: 'Check the link you received or contact the hiring team that invited you.',
    home: 'Go to Muqabala',
  },
  ar: {
    label: 'مقابلة من جهة العمل',
    expiredTitle: 'انتهت صلاحية رابط المقابلة.',
    expiredBody: 'حددت جهة التوظيف موعداً لانتهاء هذه المقابلة. تواصل معها إذا كنت لا تزال بحاجة إلى المشاركة.',
    fullTitle: 'وصل رابط المقابلة إلى الحد الأقصى للمرشحين.',
    fullBody: 'لا توجد أماكن إضافية للمرشحين. تواصل مع جهة التوظيف التي أرسلت لك الرابط.',
    unavailableTitle: 'رابط المقابلة غير متاح.',
    unavailableBody: 'تحقق من الرابط الذي استلمته أو تواصل مع جهة التوظيف التي دعتك.',
    home: 'الذهاب إلى مقابلة',
  },
} as const;

export function EmployerLinkUnavailable({ reason }: { reason: Reason }) {
  const { lang, setLang, dir } = useLang();
  const c = COPY[lang];
  const title = reason === 'expired' ? c.expiredTitle : reason === 'full' ? c.fullTitle : c.unavailableTitle;
  const body = reason === 'expired' ? c.expiredBody : reason === 'full' ? c.fullBody : c.unavailableBody;

  return (
    <main className={styles.page} dir={dir}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Muqabala home">
          <span className={styles.mark} aria-hidden="true">م</span>
          <span>Muqabala</span>
        </a>
        <button type="button" className={styles.language} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </header>
      <div className={styles.shell}>
        <section className={styles.card} aria-labelledby="link-unavailable-title">
          <p className={styles.eyebrow}>{c.label}</p>
          <h1 id="link-unavailable-title">{title}</h1>
          <p className={styles.lede}>{body}</p>
          <a className={styles.primary} href="/">{c.home}</a>
        </section>
      </div>
    </main>
  );
}
