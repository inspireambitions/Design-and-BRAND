'use client';

import Link from 'next/link';
import { homeCopy, marketingNav, type MarketingPageContent, type MarketingRole } from '@/lib/marketing-content';
import { useLang } from './LanguageProvider';

export function MarketingHeader() {
  const { lang, setLang } = useLang();
  const nav = marketingNav[lang];

  return (
    <header className="marketing-header">
      <div className="marketing-wrap marketing-nav">
        <Link href="/" className="marketing-brand" aria-label="Muqabala home">
          <span className="marketing-brand-mark" aria-hidden="true">م</span>
          <span>Muqabala</span>
        </Link>
        <nav className="marketing-links" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          <Link href="/how-it-works">{nav.how}</Link>
          <Link href="/interview-roles">{nav.roles}</Link>
          <Link href="/how-feedback-works">{nav.feedback}</Link>
          <Link href="/about">{nav.about}</Link>
        </nav>
        <div className="marketing-actions">
          <button
            type="button"
            className="marketing-language"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
          <Link href="/practice" className="marketing-button marketing-button-small">
            {nav.practice}
          </Link>
          <details className="marketing-mobile-menu">
            <summary>{lang === 'ar' ? 'القائمة' : 'Menu'}</summary>
            <div>
              <Link href="/how-it-works">{nav.how}</Link>
              <Link href="/interview-roles">{nav.roles}</Link>
              <Link href="/how-feedback-works">{nav.feedback}</Link>
              <Link href="/about">{nav.about}</Link>
              <Link href="/guides">{nav.blog}</Link>
              <Link href="/faq">{nav.faq}</Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
export function MarketingFooter() {
  const { lang } = useLang();
  const nav = marketingNav[lang];
  return (
    <footer className="marketing-footer">
      <div className="marketing-wrap marketing-footer-grid">
        <div>
          <div className="marketing-brand marketing-brand-footer">
            <span className="marketing-brand-mark" aria-hidden="true">م</span>
            <span>Muqabala</span>
          </div>
          <p>{lang === 'ar' ? 'تدريب خاص لمقابلات العمل في الخليج.' : 'Private practice for Gulf job interviews.'}</p>
          <p className="marketing-footer-owner">Muqabala by Inspire Ambitions</p>
        </div>
        <div className="marketing-footer-links">
          <Link href="/practice">{nav.practice}</Link>
          <Link href="/how-it-works">{nav.how}</Link>
          <Link href="/interview-roles">{nav.roles}</Link>
          <Link href="/how-feedback-works">{nav.feedback}</Link>
          <Link href="/faq">{nav.faq}</Link>
        </div>
        <div className="marketing-footer-links">
          <Link href="/about">{nav.about}</Link>
          <Link href="/guides">{nav.blog}</Link>
          <Link href="/for-employers">{lang === 'ar' ? 'لفرق التوظيف' : 'Hiring teams'}</Link>
          <Link href="/contact">{lang === 'ar' ? 'تواصل' : 'Contact'}</Link>
          <Link href="/privacy">{lang === 'ar' ? 'الخصوصية' : 'Privacy'}</Link>
          <Link href="/terms">{lang === 'ar' ? 'الشروط' : 'Terms'}</Link>
          <Link href="/accessibility">{lang === 'ar' ? 'إمكانية الوصول' : 'Accessibility'}</Link>
        </div>
      </div>
    </footer>
  );
}
function EvidenceDemo() {
  const { lang } = useLang();
  const c = homeCopy[lang];
  return (
    <div className="evidence-demo" aria-label={lang === 'ar' ? 'مثال على الملاحظات' : 'Example feedback'}>
      <div className="evidence-question">
        <span>{c.questionLabel}</span>
        <strong>{c.question}</strong>
      </div>
      <div className="evidence-answer">
        <span>{c.answerLabel}</span>
        <p>{c.answerBefore}<mark>{c.answerEvidence}</mark>{c.answerAfter}</p>
      </div>
      <div className="evidence-thread" aria-hidden="true" />
      <div className="evidence-result">
        <span>{c.evidenceLabel}</span>
        <strong>{c.evidenceTitle}</strong>
        <p>{c.evidenceBody}</p>
      </div>
      <div className="evidence-improve">
        <span>{c.improveLabel}</span>
        <p>{c.improveBody}</p>
      </div>
    </div>
  );
}

export function MarketingHome({ roles }: { roles: MarketingRole[] }) {
  const { lang } = useLang();
  const c = homeCopy[lang];
  const popular = roles;
  const never = [c.never1, c.never2, c.never3, c.never4, c.never5, c.never6];

  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main>
        <section className="marketing-hero marketing-wrap">
          <div className="marketing-hero-copy">
            <p className="marketing-eyebrow">{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <p className="marketing-lede">{c.intro}</p>
            <div className="marketing-cta-row">
              <Link href="/practice" className="marketing-button">{c.primary}</Link>
              <Link href="/how-feedback-works" className="marketing-text-link">{c.secondary}</Link>
            </div>
            <p className="marketing-trust-line">{c.trust}</p>
          </div>
          <EvidenceDemo />
        </section>

        <section className="marketing-job-band">
          <div className="marketing-wrap marketing-job-inner">
            <div>
              <h2>{c.jobTitle}</h2>
              <p>{c.jobBody}</p>
            </div>
            <Link href="/practice#job-ad" className="marketing-button marketing-button-light">{c.jobCta}</Link>
          </div>
        </section>

        <section className="marketing-section marketing-wrap">
          <div className="marketing-section-heading">
            <h2>{c.stepsTitle}</h2>
          </div>
          <div className="marketing-steps">
            {[
              [c.step1Title, c.step1Body],
              [c.step2Title, c.step2Body],
              [c.step3Title, c.step3Body],
            ].map(([title, body], index) => (
              <article className="marketing-step" key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-proof">
          <div className="marketing-wrap marketing-proof-grid">
            <div className="marketing-proof-copy">
              <p className="marketing-eyebrow">{c.methodEyebrow}</p>
              <h2>{c.proofTitle}</h2>
              <p>{c.proofBody}</p>
              <Link href="/how-feedback-works" className="marketing-text-link">{c.secondary}</Link>
            </div>
            <EvidenceDemo />
          </div>
        </section>

        <section className="marketing-section marketing-wrap marketing-never">
          <div>
            <p className="marketing-eyebrow">{c.trustEyebrow}</p>
            <h2>{c.neverTitle}</h2>
          </div>
          <ul>
            {never.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="marketing-section marketing-control">
          <div className="marketing-wrap marketing-control-grid">
            <div>
              <h2>{c.privacyTitle}</h2>
              <p className="marketing-lede-small">{c.privacyBody}</p>
            </div>
            <div className="marketing-control-detail">
              <p>{c.privacyDetail}</p>
              <Link href="/privacy" className="marketing-text-link">{lang === 'ar' ? 'اقرأ سياسة الخصوصية' : 'Read the privacy explanation'}</Link>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-wrap">
          <div className="marketing-section-heading marketing-section-heading-row">
            <div>
              <h2>{c.rolesTitle}</h2>
              <p>{c.rolesBody}</p>
            </div>
            <Link href="/interview-roles" className="marketing-text-link">{c.allRoles}</Link>
          </div>
          <div className="marketing-role-grid">
            {popular.map((role) => (
              <Link className="marketing-role" key={role.id} href={`/practice/${role.id}`}>
                <span>{lang === 'ar' ? role.industryAr : role.industry}</span>
                <strong>{lang === 'ar' ? role.titleAr : role.title}</strong>
                <small>{role.questionCount} {lang === 'ar' ? 'أسئلة' : 'questions'}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="marketing-final">
          <div className="marketing-wrap">
            <h2>{c.finalTitle}</h2>
            <p>{c.finalBody}</p>
            <Link href="/practice" className="marketing-button marketing-button-light">{c.primary}</Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <Link href="/practice" className="marketing-mobile-cta">{c.primary}</Link>
    </div>
  );
}

export function MarketingInfoPage({ content }: { content: Record<'en' | 'ar', MarketingPageContent> }) {
  const { lang } = useLang();
  const c = content[lang];
  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main>
        <section className="info-hero marketing-wrap">
          <p className="marketing-eyebrow">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className="marketing-lede">{c.intro}</p>
        </section>
        <section className="info-sections marketing-wrap">
          {c.sections.map((section) => (
            <article className="info-section" key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.href && section.linkLabel && (
                <a href={section.href} className="marketing-text-link" target="_blank" rel="noreferrer">
                  {section.linkLabel}
                </a>
              )}
              {section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
            </article>
          ))}
        </section>
        <section className="info-cta marketing-wrap">
          <h2>{lang === 'ar' ? 'تدرّب عندما تكون جاهزاً.' : 'Practise when you are ready.'}</h2>
          <Link href="/practice" className="marketing-button">{marketingNav[lang].practice}</Link>
        </section>
      </main>
      <MarketingFooter />
      <Link href="/practice" className="marketing-mobile-cta">{marketingNav[lang].practice}</Link>
    </div>
  );
}

export function InterviewRolesPage({ roles }: { roles: MarketingRole[] }) {
  const { lang } = useLang();
  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main>
        <section className="info-hero marketing-wrap">
          <p className="marketing-eyebrow">{lang === 'ar' ? 'دليل المقابلات' : 'Interview directory'}</p>
          <h1>{lang === 'ar' ? 'تدرّب للوظيفة التي تريدها.' : 'Practise for the job you want.'}</h1>
          <p className="marketing-lede">{lang === 'ar' ? 'اختر وظيفة خليجية أو استخدم إعلانك لإنشاء مقابلة مخصصة.' : 'Choose a Gulf role or use your job advert to create a tailored interview.'}</p>
          <Link href="/practice#job-ad" className="marketing-button">{lang === 'ar' ? 'استخدم إعلان الوظيفة' : 'Use my job advert'}</Link>
        </section>
        <section className="marketing-wrap marketing-role-directory">
          {roles.map((role) => (
            <Link className="marketing-role" key={role.id} href={`/practice/${role.id}`}>
              <span>{lang === 'ar' ? role.industryAr : role.industry}</span>
              <strong>{lang === 'ar' ? role.titleAr : role.title}</strong>
              <small>{lang === 'ar' ? role.blurbAr : role.blurb}</small>
            </Link>
          ))}
        </section>
      </main>
      <MarketingFooter />
      <Link href="/practice" className="marketing-mobile-cta">{marketingNav[lang].practice}</Link>
    </div>
  );
}

