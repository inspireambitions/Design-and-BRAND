'use client';

import Link from 'next/link';
import { infoPages, marketingNav } from '@/lib/marketing-content';
import { useLang } from './LanguageProvider';
import { MarketingFooter, MarketingHeader } from './MarketingSite';

const email = 'hello@trymuqabala.com';

export function ContactPageContent() {
  const { lang } = useLang();
  const content = infoPages.contact[lang];
  const arabic = lang === 'ar';

  return (
    <div className="marketing-site contact-page" lang={lang} dir={arabic ? 'rtl' : 'ltr'}>
      <MarketingHeader />
      <main>
        <section className="info-hero contact-hero marketing-wrap">
          <p className="marketing-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p className="marketing-lede">{content.intro}</p>
        </section>

        <section className="contact-main marketing-wrap" aria-labelledby="contact-email-title">
          <div className="contact-email-panel">
            <p className="marketing-eyebrow">{arabic ? 'البريد الإلكتروني' : 'Email Muqabala'}</p>
            <h2 id="contact-email-title">{arabic ? 'راسل فريق مقابلة مباشرة.' : 'Reach the Muqabala team directly.'}</h2>
            <p>{arabic ? 'للاستفسارات والدعم والملاحظات والتدريب والشراكات.' : 'For enquiries, support, feedback, coaching and partnerships.'}</p>
            <a
              className="contact-email-link"
              href={`mailto:${email}`}
              aria-label={arabic ? `راسل مقابلة على ${email}` : `Email Muqabala at ${email}`}
            >
              <bdi dir="ltr">{email}</bdi>
            </a>
          </div>

          <div className="contact-guidance" aria-label={arabic ? 'معلومات تساعدنا على الرد' : 'Information that helps us respond'}>
            {content.sections.map((section, index) => (
              <article className="contact-guidance-row" key={section.title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="info-cta contact-practice-cta marketing-wrap">
          <div>
            <p className="marketing-eyebrow">{arabic ? 'تدريب خاص' : 'Private practice'}</p>
            <h2>{arabic ? 'تدرّب عندما تكون جاهزاً.' : 'Practise when you are ready.'}</h2>
          </div>
          <Link href="/practice" className="marketing-button">{marketingNav[lang].practice}</Link>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
