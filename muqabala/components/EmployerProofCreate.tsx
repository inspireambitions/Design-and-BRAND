'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MuqabalaMark } from './MarketingSite';
import { useLang } from './LanguageProvider';
import { EmailSignIn } from './EmailSignIn';
import { t as translate, type Lang, type StringKey } from '@/lib/i18n';
import {
  SCREENING_RETENTION_DAYS,
  employerCopy,
  founderLine,
  marketingNav,
} from '@/lib/marketing-content';
import type { CatalogueStats } from '@/lib/catalogue-stats';
import styles from './EmployerProofCreate.module.css';

const MIN_ADVERT_CHARS = 120;
const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_EXPIRY_DAYS = 14;
const EXPIRY_OPTIONS = [1, 3, 7, 14, 21, 30] as const;
const EMPLOYER_HOME = 'https://trymuqabala.com/for-employers';

type LinkDetails = {
  id?: string;
  url: string;
  expiresAt: string;
  maxCandidates: number;
};

type CopyTarget = 'link' | 'email' | 'invite' | 'recommend' | null;
type Channel = 'email' | 'whatsapp';

export type EmployerPageProps = {
  signedIn: boolean;
  stats: CatalogueStats;
  /** True only when a real product capture exists at public/samples/employer-report.png */
  hasReportShot: boolean;
  /** True only when a real product capture exists at public/marketing/candidate-submission.png */
  hasCandidateShot: boolean;
  storageRegion: string | null;
  /** EMPLOYER_VOLUME flag. Off by default; the page is unchanged while off. */
  volume: boolean;
  /** Lets the sample block show a TODO placeholder outside production only. */
  production: boolean;
};

function withValues(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatCount(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB').format(value);
}

export function EmployerProofCreate({
  signedIn,
  stats,
  hasReportShot,
  hasCandidateShot,
  storageRegion,
  volume,
  production,
}: EmployerPageProps) {
  const { lang, setLang } = useLang();
  const c = employerCopy[lang];
  const nav = marketingNav[lang];
  const ar = lang === 'ar';
  const startHref = signedIn ? '#create' : `/sign-in?next=${encodeURIComponent('/for-employers#create')}`;

  return (
    <div className={[styles.page, 'employer-light-theme'].join(' ')}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Muqabala home">
            <span className={styles.brandMark} aria-hidden="true"><MuqabalaMark /></span>
            <span>Muqabala</span>
            <small className={styles.brandOwner}>{nav.owner}</small>
          </Link>
          <nav className={styles.headerNav} aria-label={ar ? 'التنقل' : 'Navigation'}>
            <Link href="/">{nav.candidates}</Link>
            <button
              type="button"
              className={styles.language}
              onClick={() => setLang(ar ? 'en' : 'ar')}
              aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {ar ? 'English' : 'العربية'}
            </button>
            <a href="#create" className={styles.headerSignIn}>{signedIn ? translate(lang, 'proofOpenDashboard') : (ar ? 'تسجيل الدخول' : 'Sign in')}</a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="employer-title">
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1 id="employer-title" className={styles.title}>{volume ? c.volumeTitle : c.title}</h1>
          <p className={styles.lede}>{volume ? c.volumeSub : c.sub}</p>
          <div className={styles.heroActions}>
            <a href={volume ? startHref : '#create'} className={styles.primaryButton}>{volume ? c.volumePrimary : c.primaryCta}</a>
            <a href="#sample-report" className={styles.secondaryButton}>{volume ? c.volumeSecondary : c.secondaryCta}</a>
          </div>
          <p className={styles.trustLine}>{volume ? c.volumeTrust : c.trustLine}</p>
          <p className={styles.founderLine}>{founderLine[lang]}</p>
          <dl className={styles.facts}>
            <div><dt>{ar ? 'وظائف مغطاة' : 'Roles covered'}</dt><dd>{formatCount(stats.roles, lang)}</dd></div>
            <div><dt>{ar ? 'أسئلة في البنك' : 'Questions in the bank'}</dt><dd>{formatCount(stats.questions, lang)}</dd></div>
            <div><dt>{ar ? 'لكل مرشح' : 'Per candidate'}</dt><dd>{ar ? '١٢ دقيقة' : '12 minutes'}</dd></div>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="how-title">
          <p className={styles.eyebrow}>{c.howEyebrow}</p>
          <h2 id="how-title" className={styles.sectionTitle}>{c.howTitle}</h2>
          <ol className={styles.steps}>
            {[
              [c.how1Title, c.how1Body],
              [c.how2Title, c.how2Body],
              [c.how3Title, c.how3Body],
            ].map(([title, body], index) => (
              <li key={title}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} id="sample-report" aria-labelledby="report-title">
          <p className={styles.eyebrow}>{c.reportEyebrow}</p>
          <h2 id="report-title" className={styles.sectionTitle}>{volume ? c.volumeSampleTitle : c.reportTitle}</h2>
          <p className={styles.sectionBody}>{c.reportBody}</p>
          {hasReportShot ? (
            <figure className={styles.shot}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/samples/employer-report.png" alt={ar ? 'تقرير عينة عمل مكتمل مع إخفاء بيانات المرشح' : 'A completed work sample report with candidate details blurred'} loading="lazy" />
              <figcaption>{c.reportCaption}</figcaption>
            </figure>
          ) : volume && !production ? (
            <div className={styles.shotPlaceholder} role="note">
              TODO: replace with real screenshot at public/samples/employer-report.png. This note is hidden in production.
            </div>
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="candidate-title">
          <p className={styles.eyebrow}>{c.candidateEyebrow}</p>
          <h2 id="candidate-title" className={styles.sectionTitle}>{c.candidateTitle}</h2>
          <ul className={styles.twoLines}>
            <li>{c.candidate1}</li>
            <li>{c.candidate2}</li>
          </ul>
          {hasCandidateShot && (
            <figure className={styles.shot}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marketing/candidate-submission.png" alt={ar ? 'شاشة تسجيل إجابة المرشح' : 'The candidate submission screen with a timed video answer'} loading="lazy" />
            </figure>
          )}
        </section>

        <section className={[styles.section, styles.fair].join(' ')} aria-labelledby="fair-title">
          <p className={styles.eyebrow}>{c.fairEyebrow}</p>
          <h2 id="fair-title" className={styles.sectionTitle}>{c.fairTitle}</h2>
          <ul className={styles.fairList}>
            <li>{c.fair1}</li>
            <li>{c.fair2}</li>
            <li>{c.fair3}</li>
            <li>{c.fair4}</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="data-title">
          <p className={styles.eyebrow}>{c.dataEyebrow}</p>
          <h2 id="data-title" className={styles.sectionTitle}>{c.dataTitle}</h2>
          <dl className={styles.dataList}>
            <div>
              <dt>{ar ? 'التخزين' : 'Storage'}</dt>
              <dd>
                {c.dataStorage}
                {storageRegion && <> {withValues(c.dataRegion, { region: storageRegion })}</>}
              </dd>
            </div>
            <div>
              <dt>{ar ? 'مدة الاحتفاظ' : 'Retention'}</dt>
              <dd>{withValues(c.dataRetention, { days: formatCount(SCREENING_RETENTION_DAYS, lang) })}</dd>
            </div>
            <div>
              <dt>{ar ? 'الموافقة' : 'Consent'}</dt>
              <dd>{c.dataConsent}</dd>
            </div>
            <div>
              <dt>{ar ? 'الإطار القانوني' : 'Legal alignment'}</dt>
              <dd>{c.dataPdpl} {c.dataGdpr}</dd>
            </div>
          </dl>
          <Link href="/privacy" className={styles.textLink}>{c.dataLink}</Link>
        </section>

        <section className={[styles.section, styles.pricing].join(' ')} aria-labelledby="pricing-title">
          <p className={styles.eyebrow}>{c.pricingEyebrow}</p>
          <h2 id="pricing-title" className={styles.sectionTitle}>{c.pricingTitle}</h2>
          <p className={styles.sectionBody}>{c.pricingBody}</p>
        </section>

        <section className={styles.section} id="create" aria-labelledby="create-title">
          <p className={styles.eyebrow}>{c.createEyebrow}</p>
          <h2 id="create-title" className={styles.sectionTitle}>{c.createTitle}</h2>
          {signedIn ? (
            <EmployerCreateForm volume={volume} />
          ) : (
            <div className={styles.signInPanel}>
              <p>{c.createBody}</p>
              <EmailSignIn compact next="/for-employers" />
            </div>
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <p className={styles.footerBrand}>Muqabala</p>
            <p>{c.footerLine}</p>
            <p className={styles.footerOwner}>Muqabala by Inspire Ambitions</p>
          </div>
          <nav className={styles.footerLinks} aria-label={ar ? 'روابط' : 'Footer'}>
            <Link href="/">{c.footerCandidates}</Link>
            <Link href="/privacy">{c.footerPrivacy}</Link>
            <Link href="/terms">{c.footerTerms}</Link>
            <Link href="/contact">{c.footerContact}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function EmployerCreateForm({ volume }: { volume: boolean }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [maxCandidates, setMaxCandidates] = useState(DEFAULT_MAX_CANDIDATES);
  const [expiryDays, setExpiryDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [error, setError] = useState<'generate' | 'create' | null>(null);
  const [tooShort, setTooShort] = useState(false);
  const [channel, setChannel] = useState<Channel>('email');
  const [sendLang, setSendLang] = useState<Lang>(lang);

  const companyReady = companyName.trim().length >= 2;
  const titleReady = jobTitle.trim().length >= 2;
  const jobReady = jobText.trim().length >= MIN_ADVERT_CHARS;
  const settingsReady = Number.isInteger(maxCandidates) && maxCandidates >= 1 && maxCandidates <= 1000;
  const canGenerate = companyReady && titleReady && !generating && !creating;
  const canCreate = companyReady && titleReady && jobReady && settingsReady && !generating && !creating;
  const link = linkDetails?.url ?? '';
  const plannedExpiryDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));

  const send = (key: StringKey) => translate(sendLang, key);
  const sendCompany = companyName.trim() || send('proofCompanyPlaceholder');
  const sendTitle = jobTitle.trim() || send('proofJobTitlePlaceholder');
  const signature = [recruiterName.trim(), sendCompany].filter(Boolean).join('\n');
  const emailSubject = withValues(send('proofEmailSubject'), { company: sendCompany, title: sendTitle });
  const emailBody = withValues(send('proofEmailBody'), { company: sendCompany, title: sendTitle, link, signature });
  const whatsAppBody = withValues(send('proofCandidateInvite'), { company: sendCompany, title: sendTitle, link });
  const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const recommendNote = withValues(t('proofRecommendMessage'), {
    company: companyName.trim() || t('proofCompanyPlaceholder'),
    title: jobTitle.trim() || t('proofJobTitlePlaceholder'),
    home: EMPLOYER_HOME,
  });

  function resetLinkSettings() {
    setMaxCandidates(DEFAULT_MAX_CANDIDATES);
    setExpiryDays(DEFAULT_EXPIRY_DAYS);
    setLinkDetails(null);
  }

  async function generateJobDescription() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerated(false);
    setError(null);
    setTooShort(false);
    setLinkDetails(null);
    try {
      const response = await fetch('/api/screening/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim(), jobTitle: jobTitle.trim() }),
      });
      const body = await response.json().catch(() => ({})) as { jobDescription?: string };
      if (!response.ok || !body.jobDescription) {
        setError('generate');
        return;
      }
      setJobText(body.jobDescription);
      setGenerated(true);
    } catch {
      setError('generate');
    } finally {
      setGenerating(false);
    }
  }

  async function createLink() {
    if (!canCreate) return;
    if (jobText.trim().length < MIN_ADVERT_CHARS) {
      setTooShort(true);
      setError(null);
      return;
    }
    setCreating(true);
    setError(null);
    setTooShort(false);
    setCopied(null);
    try {
      const generated = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobText }),
      });
      const generatedBody = await generated.json().catch(() => ({})) as {
        tailored?: boolean;
        token?: string;
        role?: { title?: string };
      };
      if (!generated.ok || !generatedBody.tailored || !generatedBody.token) {
        setError('create');
        return;
      }
      const pack = await fetch('/api/screening/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          recruiterName: recruiterName.trim() || undefined,
          jobTitle: jobTitle || generatedBody.role?.title,
          interviewToken: generatedBody.token,
          maxCandidates,
          expiryDays,
        }),
      });
      const packBody = await pack.json().catch(() => ({})) as Partial<LinkDetails>;
      if (!pack.ok || !packBody.url || !packBody.expiresAt || !packBody.maxCandidates) {
        setError('create');
        return;
      }
      setLinkDetails(packBody as LinkDetails);
      // Volume flow: the role's three questions are confirmed, so go straight to Add candidates.
      if (volume && packBody.id) router.push(`/employer/roles/${packBody.id}/candidates/add`);
    } catch {
      setError('create');
    } finally {
      setCreating(false);
    }
  }

  async function copyText(value: string, target: Exclude<CopyTarget, null>) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
    } catch {
      setCopied(null);
    }
  }

  return (
    <>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void createLink();
        }}
      >
        <label className={styles.field}>
          <span>{t('proofCompanyLabel')}</span>
          <input
            dir="auto"
            value={companyName}
            onChange={(event) => {
              setCompanyName(event.target.value);
              setGenerated(false);
              setError(null);
              setLinkDetails(null);
            }}
            minLength={2}
            maxLength={80}
            required
            autoComplete="organization"
            placeholder={t('proofCompanyPlaceholder')}
          />
        </label>

        <label className={styles.field}>
          <span>{t('proofRecruiterLabel')}</span>
          <input
            dir="auto"
            value={recruiterName}
            onChange={(event) => {
              setRecruiterName(event.target.value);
              setError(null);
              setLinkDetails(null);
            }}
            maxLength={80}
            autoComplete="name"
            placeholder={t('proofRecruiterPlaceholder')}
          />
        </label>

        <label className={styles.field}>
          <span>{t('proofJobTitleLabel')}</span>
          <input
            dir="auto"
            value={jobTitle}
            onChange={(event) => {
              setJobTitle(event.target.value);
              setGenerated(false);
              setError(null);
              setLinkDetails(null);
            }}
            minLength={2}
            maxLength={120}
            required
            autoComplete="off"
            placeholder={t('proofJobTitlePlaceholder')}
          />
        </label>

        <label className={styles.field}>
          <span>{t('proofAdvertLabel')}</span>
          <textarea
            dir="auto"
            value={jobText}
            onChange={(event) => {
              setJobText(event.target.value);
              setError(null);
              setLinkDetails(null);
              if (tooShort && event.target.value.trim().length >= MIN_ADVERT_CHARS) setTooShort(false);
            }}
            minLength={MIN_ADVERT_CHARS}
            maxLength={12_000}
            rows={5}
            required
            placeholder={t('proofAdvertPlaceholder')}
            aria-describedby="job-description-status"
          />
        </label>

        <fieldset className={styles.linkSettings} aria-labelledby="link-settings-label">
          <div className={styles.linkSettingsHead}>
            <span id="link-settings-label">{t('proofLinkSettingsLabel')}</span>
            <button className={styles.linkSettingsReset} type="button" onClick={resetLinkSettings}>
              {t('proofLinkSettingsReset')}
            </button>
          </div>
          <div className={styles.linkSettingsGrid}>
            <label className={styles.linkSetting}>
              <span>{t('proofLinkPlacesLabel')}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                value={maxCandidates}
                onChange={(event) => {
                  setMaxCandidates(Number(event.target.value));
                  setLinkDetails(null);
                }}
                onBlur={() => setMaxCandidates((value) => Math.min(1000, Math.max(1, Math.round(value || DEFAULT_MAX_CANDIDATES))))}
              />
            </label>
            <label className={styles.linkSetting}>
              <span>{t('proofLinkOpenForLabel')}</span>
              <select
                value={expiryDays}
                onChange={(event) => {
                  setExpiryDays(Number(event.target.value));
                  setLinkDetails(null);
                }}
              >
                {EXPIRY_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 1 ? t('proofLinkDayOption') : withValues(t('proofLinkDaysOption'), { days })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>{t('proofLinkSettingsHelp')}</p>
        </fieldset>

        <div className={styles.actions} aria-label={t('proofCreateStepsLabel')}>
          <button
            type="button"
            className={styles.generate}
            disabled={!canGenerate}
            onClick={() => void generateJobDescription()}
          >
            <span className={styles.actionNumber} aria-hidden="true">1</span>
            <span>{generating ? t('proofGeneratingAdvert') : t('proofGenerateAdvert')}</span>
          </button>
          <button type="submit" className={styles.submit} disabled={!canCreate}>
            <span className={styles.actionNumber} aria-hidden="true">2</span>
            <span>{creating ? t('proofCreating') : t('proofCreateAction')}</span>
          </button>
        </div>

        <p className={styles.linkSummary} suppressHydrationWarning>
          {t('proofLinkSettingsSummaryStart')} <strong>{maxCandidates}</strong>{' '}
          {t('proofLinkSettingsSummaryMiddle')} <strong>{plannedExpiryDate}</strong>{t('proofLinkSettingsSummaryEnd')}
        </p>

        <div id="job-description-status" className={styles.status} aria-live="polite">
          {!companyReady || !titleReady ? (
            <p>{t('proofAddBasicsFirst')}</p>
          ) : !jobReady ? (
            <p>{t('proofAddDescriptionNext')}</p>
          ) : (
            <p>{generated ? t('proofAdvertGenerated') : t('proofReadyToCreate')}</p>
          )}
        </div>

        <p className={styles.assurance}>{t('proofRecruiterValue')}</p>

        <div className={styles.messages} aria-live="polite">
          {tooShort && <p className={styles.warning}>{t('proofAdvertTooShort')}</p>}
          {error === 'generate' && <p className={styles.warning}>{t('proofGenerateFailed')}</p>}
          {error === 'create' && <p className={styles.warning}>{t('proofCreateFailed')}</p>}
        </div>
      </form>

      {link && (
        <section className={styles.linkPanel} aria-labelledby="candidate-link-heading">
          <p className={styles.eyebrow}>{t('proofSendKicker')}</p>
          <h3 id="candidate-link-heading">{t('proofStepShare')}</h3>
          <p className={styles.linkText}>{link}</p>
          <p className={styles.linkNote}>
            {linkDetails && withValues(t('proofLinkReady'), {
              count: linkDetails.maxCandidates,
              date: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date(linkDetails.expiresAt)),
            })}
          </p>

          <div className={styles.channelRow}>
            <div className={styles.channels} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={channel === 'email'}
                className={channel === 'email' ? styles.channelOn : styles.channelOff}
                onClick={() => setChannel('email')}
              >
                {t('proofChannelEmail')}
                <span className={styles.recommendedTag}>{t('proofRecommendedTag')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={channel === 'whatsapp'}
                className={channel === 'whatsapp' ? styles.channelOn : styles.channelOff}
                onClick={() => setChannel('whatsapp')}
              >
                {t('proofChannelWhatsApp')}
              </button>
            </div>
            <div className={styles.sendLang}>
              <span>{t('proofSendIn')}</span>
              <button type="button" className={sendLang === 'en' ? styles.langOn : styles.langOff} onClick={() => setSendLang('en')}>English</button>
              <button type="button" className={sendLang === 'ar' ? styles.langOn : styles.langOff} onClick={() => setSendLang('ar')}>العربية</button>
            </div>
          </div>

          {channel === 'email' ? (
            <>
              <p className={styles.fieldLabel}>{t('proofSubjectLabel')}</p>
              <p className={styles.subject} dir={sendLang === 'ar' ? 'rtl' : 'ltr'}>{emailSubject}</p>
              <p className={styles.fieldLabel}>{t('proofMessageLabel')}</p>
              <pre className={styles.invitePreview} dir={sendLang === 'ar' ? 'rtl' : 'ltr'}>{emailBody}</pre>
              <div className={styles.linkActions}>
                <a href={mailto} className={styles.primaryButton}>{t('proofOpenEmail')}</a>
                <button type="button" className={styles.secondaryButton} onClick={() => void copyText(`${emailSubject}\n\n${emailBody}`, 'email')}>
                  {copied === 'email' ? t('proofCopiedEmail') : t('proofCopyEmail')}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => void copyText(link, 'link')}>
                  {copied === 'link' ? t('proofCopied') : t('proofCopyLink')}
                </button>
              </div>
              <p className={styles.linkNote}>{t('proofBccNote')}</p>
              <p className={styles.linkNote}>{t('proofFromNote')}</p>
            </>
          ) : (
            <>
              <p className={styles.fieldLabel}>{t('proofMessageLabel')}</p>
              <pre className={styles.invitePreview} dir={sendLang === 'ar' ? 'rtl' : 'ltr'}>{whatsAppBody}</pre>
              <div className={styles.linkActions}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsAppBody)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryButton}
                >
                  {t('proofWhatsAppInvite')}
                </a>
                <button type="button" className={styles.secondaryButton} onClick={() => void copyText(whatsAppBody, 'invite')}>
                  {copied === 'invite' ? t('proofCopiedInvite') : t('proofCopyInvite')}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => void copyText(link, 'link')}>
                  {copied === 'link' ? t('proofCopied') : t('proofCopyLink')}
                </button>
              </div>
              <p className={styles.linkNote}>{t('proofWhatsAppNote')}</p>
            </>
          )}

          <Link href="/employer" className={styles.textLink}>{t('proofOpenDashboard')}</Link>

          <div className={styles.recommend}>
            <h3>{t('proofRecommendTitle')}</h3>
            <p>{t('proofRecommendBody')}</p>
            <pre className={styles.invitePreview}>{recommendNote}</pre>
            <button type="button" className={styles.secondaryButton} onClick={() => void copyText(recommendNote, 'recommend')}>
              {copied === 'recommend' ? t('proofCopiedRecommend') : t('proofCopyRecommend')}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
