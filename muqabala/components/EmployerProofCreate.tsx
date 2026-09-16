'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { employerVolumeProps, track } from '@/lib/analytics';
import { Brand } from './Brand';
import { SkipLink } from './SkipLink';
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
import { CopyButton } from './CopyButton';
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
  questionCount?: number;
  location?: string | null;
  timezone?: string;
};

type Channel = 'email' | 'whatsapp';
type QuestionDraft = { id: string; text: string; textAr: string };
type QuestionnaireLanguage = 'en' | 'both';

const ROLE_TIMEZONES = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Kuwait', 'Asia/Muscat', 'Asia/Manila'] as const;
const FALLBACK_QUESTIONS: QuestionDraft[] = [
  { id: 'intro', text: 'What makes your background relevant to this role?', textAr: 'ما الذي يجعل خبرتك مناسبة لهذه الوظيفة؟' },
  { id: 'problem', text: 'Tell us about a real work problem you solved and what changed as a result.', textAr: 'حدثنا عن مشكلة حقيقية في العمل حللتها وما الذي تغيّر نتيجة لذلك.' },
  { id: 'priority', text: 'Describe a time you had competing priorities. How did you decide what to do first?', textAr: 'صف موقفاً كانت لديك فيه أولويات متنافسة. كيف قررت ما الذي ستفعله أولاً؟' },
];

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

  useEffect(() => { track('employer_landing_viewed', employerVolumeProps(volume)); }, [volume]);

  return (
    <div className={[styles.page, 'employer-light-theme'].join(' ')}>
      <SkipLink />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand className={styles.brand} owner={nav.owner} />
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
            <a href={signedIn ? '/employer' : '#create'} className={styles.headerSignIn}>{signedIn ? translate(lang, 'proofOpenDashboard') : (ar ? 'تسجيل الدخول' : 'Sign in')}</a>
          </nav>
        </div>
      </header>

      <main className={styles.main} id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="employer-title">
          <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1 id="employer-title" className={styles.title}>{volume ? c.volumeTitle : c.title}</h1>
          <p className={styles.lede}>{volume ? c.volumeSub : c.sub}</p>
          <div className={styles.heroActions}>
            <a href={volume ? startHref : '#create'} className={styles.primaryButton}>{volume ? c.volumePrimary : c.primaryCta}</a>
            <Link href="/for-employers/sample-report" className={styles.secondaryButton} onClick={() => track('sample_report_opened', employerVolumeProps(volume))}>{volume ? c.volumeSecondary : c.secondaryCta}</Link>
          </div>
          <p className={styles.trustLine}>{volume ? c.volumeTrust : c.trustLine}</p>
          <p className={styles.founderLine}>{founderLine[lang]}</p>
          <dl className={styles.facts}>
            <div><dt>{ar ? 'وظائف مغطاة' : 'Roles covered'}</dt><dd>{formatCount(stats.roles, lang)}</dd></div>
            <div><dt>{ar ? 'أسئلة في البنك' : 'Questions in the bank'}</dt><dd>{formatCount(stats.questions, lang)}</dd></div>
            <div><dt>{ar ? 'لكل مرشح' : 'Per candidate'}</dt><dd>{ar ? 'نحو ٢٥ دقيقة' : 'About 25 minutes'}</dd></div>
          </dl>
          </div>
          <figure className={styles.heroReport}>
            <figcaption>{ar ? 'معاينة تقرير · بيانات خيالية' : 'Report preview · fictional data'}</figcaption>
            <Link href="/for-employers/sample-report" aria-label={ar ? 'افتح نموذج التقرير الكامل' : 'Open the full sample report'}>
              <img src="/samples/employer-report-preview.png" width="1000" height="820" alt={ar ? 'مقتطف من تقرير باللغة الإنجليزية يوضح أدلة الإجابة ومستويات المراجعة' : 'A sample evidence report showing answer evidence and review bands'} />
            </Link>
            <p>{ar ? 'راجع الدليل المسجل. أضف ملاحظاتك. اتخذ القرار بنفسك.' : 'Review the recorded evidence. Add your notes. Make your own decision.'}</p>
          </figure>
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
              <img src="/samples/employer-report-preview.png" width="1000" height="820" alt={ar ? 'تقرير توضيحي باللغة الإنجليزية يستخدم بيانات خيالية' : 'An illustrative evidence report using fictional candidate data'} loading="lazy" />
              <figcaption>{ar ? 'مثال توضيحي ببيانات خيالية. افتح التقرير الكامل لمراجعة الأدلة وأسئلة المتابعة.' : 'Illustrative report with fictional data. Open the full report to review the evidence and follow-up questions.'}</figcaption>
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


    </div>
  );
}

export function EmployerCreateForm({ volume, fixtureMode = false }: { volume: boolean; fixtureMode?: boolean }) {
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [companyName, setCompanyName] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState<(typeof ROLE_TIMEZONES)[number]>('Asia/Dubai');
  const [salary, setSalary] = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [interviewDetails, setInterviewDetails] = useState('');
  const [jobText, setJobText] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>(FALLBACK_QUESTIONS);
  const [questionnaireLanguage, setQuestionnaireLanguage] = useState<QuestionnaireLanguage>('both');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionFallback, setSuggestionFallback] = useState(false);
  const [suggestedFor, setSuggestedFor] = useState('');
  const [maxCandidates, setMaxCandidates] = useState(DEFAULT_MAX_CANDIDATES);
  const [expiryDays, setExpiryDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
  const [error, setError] = useState<'generate' | 'create' | null>(null);
  const [validationError, setValidationError] = useState<'role' | 'questions' | null>(null);
  const [channel, setChannel] = useState<Channel>('email');
  const [sendLang, setSendLang] = useState<Lang>(lang);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const companyRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const locationRef = useRef<HTMLInputElement | null>(null);
  const advertRef = useRef<HTMLTextAreaElement | null>(null);
  const publishKeyRef = useRef<string | null>(null);
  const setupStartedAtRef = useRef<number | null>(null);
  const mounted = useRef(false);
  const questionsDirtyRef = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const companyReady = companyName.trim().length >= 2;
  const titleReady = jobTitle.trim().length >= 2;
  const locationReady = location.trim().length >= 2;
  const jobReady = jobText.trim().length >= MIN_ADVERT_CHARS;
  const questionsReady = questions.length >= 3 && questions.length <= 8
    && questions.every((question) => question.text.trim().length >= 15
      && (questionnaireLanguage === 'en' || question.textAr.trim().length >= 10));
  const settingsReady = Number.isInteger(maxCandidates) && maxCandidates >= 1 && maxCandidates <= 1000;
  const canGenerate = companyReady && titleReady && !generating && !creating;
  const canCreate = companyReady && titleReady && locationReady && questionsReady && settingsReady && !generating && !creating;
  const link = linkDetails?.url ?? '';
  const plannedExpiryIso = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
  const plannedExpiryDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'long', timeStyle: 'short', timeZone: timezone,
  }).format(new Date(plannedExpiryIso));

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

  function markSetupStarted() {
    setupStartedAtRef.current ??= performance.now();
  }

  function resetLinkSettings() {
    setMaxCandidates(DEFAULT_MAX_CANDIDATES);
    setExpiryDays(DEFAULT_EXPIRY_DAYS);
    setLinkDetails(null);
  }

  async function loadQuestionSuggestions(force = false) {
    if (suggesting || (!force && suggestedFor === jobTitle.trim())) return;
    const requestedTitle = jobTitle.trim();
    if (fixtureMode) {
      if (force || !questionsDirtyRef.current) setQuestions(FALLBACK_QUESTIONS);
      setSuggestedFor(requestedTitle);
      return;
    }
    setSuggesting(true);
    setSuggestionFallback(false);
    try {
      const response = await fetch('/api/screening/question-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle: jobTitle.trim() }),
      });
      const body = await response.json().catch(() => ({})) as { questions?: QuestionDraft[] };
      if (!response.ok || !body.questions || body.questions.length < 3) throw new Error('suggestions_unavailable');
      if (force || !questionsDirtyRef.current) setQuestions(body.questions.slice(0, 8));
      setSuggestedFor(requestedTitle);
    } catch {
      setQuestions((current) => current.length >= 3 ? current : FALLBACK_QUESTIONS);
      setSuggestionFallback(true);
    } finally {
      setSuggesting(false);
    }
  }

  async function continueWizard() {
    if (step === 0) {
      if (!companyReady || !titleReady || !locationReady) {
        setValidationError('role');
        const firstExistingRoleField = companyReady ? titleRef.current : companyRef.current;
        const firstMissingRoleField = companyReady && titleReady ? locationRef.current : firstExistingRoleField;
        firstMissingRoleField?.focus();
        return;
      }
      setValidationError(null);
      setStep(1);
      await loadQuestionSuggestions();
      return;
    }
    if (step === 1) {
      if (!questionsReady) {
        setValidationError('questions');
        return;
      }
      setValidationError(null);
      setStep(2);
    }
  }

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    questionsDirtyRef.current = true;
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));
    setValidationError(null);
    setLinkDetails(null);
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    questionsDirtyRef.current = true;
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setLinkDetails(null);
  }

  async function generateJobDescription() {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerated(false);
    setError(null);
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
      requestAnimationFrame(() => advertRef.current?.focus());
    } catch {
      setError('generate');
    } finally {
      setGenerating(false);
    }
  }

  async function createLink() {
    if (!canCreate) return;
    if (fixtureMode) {
      setError('create');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      publishKeyRef.current ??= crypto.randomUUID();
      const pack = await fetch('/api/screening/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          recruiterName: recruiterName.trim() || undefined,
          jobTitle: jobTitle.trim(),
          jobText: jobText.trim() || undefined,
          location: location.trim(),
          timezone,
          publishedFacts: {
            salary: salary.trim() || undefined,
            accommodation: accommodation.trim() || undefined,
            interviewDetails: interviewDetails.trim() || undefined,
          },
          questionnaireLanguage,
          questions,
          publishKey: publishKeyRef.current,
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
      track('role_created', employerVolumeProps(volume, {
        ...(packBody.id ? { role_id: packBody.id } : {}),
        ...(setupStartedAtRef.current === null ? {} : { duration_ms: performance.now() - setupStartedAtRef.current }),
      }));
      setStep(3);
    } catch {
      setError('create');
    } finally {
      setCreating(false);
    }
  }

  const stepLabels = [
    t('proofWizardRole'),
    t('proofWizardQuestions'),
    t('proofWizardPreview'),
    t('proofWizardShare'),
  ];

  return (
    <div className={styles.wizard}>
      <nav className={styles.wizardProgress} aria-label={t('proofWizardLabel')}>
        <ol>
          {stepLabels.map((label, index) => (
            <li key={label} data-state={index < step ? 'complete' : index === step ? 'current' : 'upcoming'} aria-current={index === step ? 'step' : undefined}>
              <span aria-hidden="true">{index < step ? '✓' : index + 1}</span>
              <bdi dir="auto">{label}</bdi>
            </li>
          ))}
        </ol>
        <p aria-live="polite">{withValues(t('proofWizardCurrent'), { current: step + 1, total: stepLabels.length, step: stepLabels[step] })}</p>
      </nav>

      {step < 3 && <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 2) void createLink();
        }}
      >
        {step === 0 && <section className={styles.wizardPanel} aria-labelledby="wizard-role-heading">
          <div className={styles.wizardHeading}>
            <h3 ref={headingRef} id="wizard-role-heading" tabIndex={-1}>{t('proofWizardRoleTitle')}</h3>
            <p>{t('proofWizardRoleBody')}</p>
          </div>
          <label className={styles.field}>
            <span>{t('proofCompanyLabel')}</span>
            <input
              ref={companyRef}
              dir="auto"
              value={companyName}
              onChange={(event) => {
                markSetupStarted();
                setCompanyName(event.target.value);
                setGenerated(false);
                setError(null);
                setValidationError(null);
                setLinkDetails(null);
              }}
              minLength={2}
              maxLength={80}
              autoComplete="organization"
              placeholder={t('proofCompanyPlaceholder')}
              aria-invalid={validationError === 'role' && !companyReady}
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
              ref={titleRef}
              dir="auto"
              value={jobTitle}
              onChange={(event) => {
                markSetupStarted();
                setJobTitle(event.target.value);
                setGenerated(false);
                setSuggestedFor('');
                setError(null);
                setValidationError(null);
                setLinkDetails(null);
              }}
              minLength={2}
              maxLength={120}
              autoComplete="off"
              placeholder={t('proofJobTitlePlaceholder')}
              aria-invalid={validationError === 'role' && !titleReady}
            />
          </label>
          <label className={styles.field}>
            <span>{t('proofLocationLabel')}</span>
            <input
              ref={locationRef}
              dir="auto"
              value={location}
              onChange={(event) => { markSetupStarted(); setLocation(event.target.value); setValidationError(null); setLinkDetails(null); }}
              minLength={2}
              maxLength={160}
              autoComplete="address-level2"
              placeholder={t('proofLocationPlaceholder')}
              aria-invalid={validationError === 'role' && !locationReady}
            />
          </label>
          <label className={styles.field}>
            <span>{t('proofTimezoneLabel')}</span>
            <select value={timezone} onChange={(event) => { setTimezone(event.target.value as (typeof ROLE_TIMEZONES)[number]); setLinkDetails(null); }}>
              {ROLE_TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
          <details className={styles.optionalFacts}>
            <summary>{t('proofOptionalFacts')}</summary>
            <label className={styles.field}><span>{t('proofSalaryLabel')}</span><textarea dir="auto" maxLength={500} rows={2} value={salary} onChange={(event) => { setSalary(event.target.value); setLinkDetails(null); }} /></label>
            <label className={styles.field}><span>{t('proofAccommodationLabel')}</span><textarea dir="auto" maxLength={500} rows={2} value={accommodation} onChange={(event) => { setAccommodation(event.target.value); setLinkDetails(null); }} /></label>
            <label className={styles.field}><span>{t('proofInterviewDetailsLabel')}</span><textarea dir="auto" maxLength={1000} rows={3} value={interviewDetails} onChange={(event) => { setInterviewDetails(event.target.value); setLinkDetails(null); }} /></label>
          </details>
          {validationError === 'role' && <p className={styles.warning} role="alert">{t('proofWizardRoleError')}</p>}
          <div className={styles.wizardActions}>
            <button type="button" className={styles.submit} onClick={() => void continueWizard()}>{t('proofWizardContinue')}</button>
          </div>
        </section>}

        {step === 1 && <section className={styles.wizardPanel} aria-labelledby="wizard-questions-heading">
          <div className={styles.wizardHeading}>
            <h3 ref={headingRef} id="wizard-questions-heading" tabIndex={-1}>{t('proofWizardQuestionsTitle')}</h3>
            <p>{t('proofWizardQuestionsBody')}</p>
          </div>
          <div className={styles.questionHeading}>
            <div><strong>{t('proofQuestionSuggestions')}</strong><p>{t('proofQuestionTemplateNote')}</p></div>
            <button type="button" className={styles.generate} disabled={suggesting} onClick={() => { questionsDirtyRef.current = false; void loadQuestionSuggestions(true); }}>
              {suggesting ? t('proofQuestionsLoading') : t('proofQuestionSuggestions')}
            </button>
          </div>
          <fieldset className={styles.linkSettings}>
            <legend>{ar ? 'لغة أسئلة المرشح' : 'Candidate question language'}</legend>
            <label><input type="radio" name="questionnaire-language" checked={questionnaireLanguage === 'both'} onChange={() => { setQuestionnaireLanguage('both'); setLinkDetails(null); }} /> {ar ? 'الإنجليزية والعربية' : 'English and Arabic'}</label>
            <label><input type="radio" name="questionnaire-language" checked={questionnaireLanguage === 'en'} onChange={() => { setQuestionnaireLanguage('en'); setLinkDetails(null); }} /> {ar ? 'الإنجليزية فقط' : 'English only'}</label>
          </fieldset>
          {suggestionFallback && <p className={styles.status} role="status">{t('proofQuestionsFallback')}</p>}
          <ol className={styles.questionEditor} aria-label={t('proofQuestionSuggestions')}>
            {questions.map((question, index) => (
              <li key={`${question.id}-${index}`}>
                <div className={styles.questionToolbar}>
                  <strong>{index + 1}</strong>
                  <button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>{t('proofQuestionMoveUp')}</button>
                  <button type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>{t('proofQuestionMoveDown')}</button>
                  <button type="button" disabled={questions.length <= 3} onClick={() => { questionsDirtyRef.current = true; setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index)); }}>{t('proofQuestionRemove')}</button>
                </div>
                <label className={styles.field}><span>{t('proofQuestionEnglish')}</span><textarea dir="ltr" rows={2} maxLength={500} value={question.text} onChange={(event) => updateQuestion(index, { text: event.target.value })} /></label>
                {questionnaireLanguage === 'both' && <label className={styles.field}><span>{t('proofQuestionArabic')}</span><textarea dir="rtl" rows={2} maxLength={500} value={question.textAr} onChange={(event) => updateQuestion(index, { textAr: event.target.value })} /></label>}
              </li>
            ))}
          </ol>
          {questions.length < 8 && <button type="button" className={styles.generate} onClick={() => { questionsDirtyRef.current = true; setQuestions((current) => [...current, { id: `custom-${crypto.randomUUID()}`, text: '', textAr: '' }]); }}>{t('proofQuestionAdd')}</button>}
          <p className={styles.status} aria-live="polite">{withValues(t('proofQuestionsCount'), { count: questions.length })}</p>
          <details className={styles.optionalFacts}>
            <summary>{t('proofAdvertLabel')} · {t('proofOptionalLabel')}</summary>
            <label className={styles.field}>
              <span>{t('proofAdvertLabel')}</span>
              <textarea ref={advertRef} dir="auto" value={jobText} onChange={(event) => { setJobText(event.target.value); setError(null); setLinkDetails(null); }} maxLength={12_000} rows={6} placeholder={t('proofAdvertPlaceholder')} />
            </label>
            <button type="button" className={styles.generate} disabled={!canGenerate} onClick={() => void generateJobDescription()}>{generating ? t('proofGeneratingAdvert') : t('proofGenerateAdvert')}</button>
            <div className={styles.status} aria-live="polite"><p>{jobReady ? (generated ? t('proofAdvertGenerated') : t('proofReadyToCreate')) : t('proofAddDescriptionNext')}</p></div>
          </details>
          {validationError === 'questions' && <p className={styles.warning} role="alert">{t('proofWizardQuestionsError')}</p>}
          {error === 'generate' && <p className={styles.warning} role="alert">{t('proofGenerateFailed')}</p>}
          <div className={styles.wizardActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => { setValidationError(null); setStep(0); }}>{t('proofWizardBack')}</button>
            <button type="button" className={styles.submit} onClick={() => void continueWizard()}>{t('proofWizardContinue')}</button>
          </div>
        </section>}

        {step === 2 && <section className={styles.wizardPanel} aria-labelledby="wizard-preview-heading">
          <div className={styles.wizardHeading}>
            <h3 ref={headingRef} id="wizard-preview-heading" tabIndex={-1}>{t('proofWizardPreviewTitle')}</h3>
            <p>{t('proofWizardPreviewBody')}</p>
          </div>
          <dl className={styles.previewSummary}>
            <div><dt>{t('proofWizardRoleSummary')}</dt><dd><bdi dir="auto">{jobTitle}</bdi> · <bdi dir="auto">{companyName}</bdi></dd></div>
            <div><dt>{t('proofLocationSummary')}</dt><dd dir="auto">{location}</dd></div>
            <div><dt>{t('proofTimezoneSummary')}</dt><dd>{timezone}</dd></div>
            <div><dt>{t('proofWizardSourceSummary')}</dt><dd>{withValues(t('proofQuestionsCount'), { count: questions.length })}</dd></div>
            <div><dt>{t('proofWizardLimitSummary')}</dt><dd>{maxCandidates}</dd></div>
            <div><dt>{t('proofWizardExpirySummary')}</dt><dd suppressHydrationWarning>{plannedExpiryDate}</dd></div>
            <div><dt>{ar ? 'لغة الأسئلة' : 'Question language'}</dt><dd>{questionnaireLanguage === 'en' ? 'English' : (ar ? 'الإنجليزية والعربية' : 'English and Arabic')}</dd></div>
          </dl>
          <div className={styles.candidatePreview} id="role-facts">
            <p className={styles.eyebrow}>{companyName}</p>
            <h4 dir="auto">{jobTitle}</h4>
            <p dir="auto">{location}</p>
            <p>{withValues(t('proofQuestionsCount'), { count: questions.length })}</p>
            <ol>{questions.map((question) => <li key={question.id} dir={lang === 'ar' && questionnaireLanguage === 'both' ? 'rtl' : 'ltr'}>{lang === 'ar' && questionnaireLanguage === 'both' ? question.textAr : question.text}</li>)}</ol>
            {salary.trim() && <p dir="auto"><strong>{t('proofSalaryLabel')}:</strong> {salary.trim()}</p>}
            {accommodation.trim() && <p dir="auto"><strong>{t('proofAccommodationLabel')}:</strong> {accommodation.trim()}</p>}
            {interviewDetails.trim() && <p dir="auto"><strong>{t('proofInterviewDetailsLabel')}:</strong> {interviewDetails.trim()}</p>}
            <small>{t('proofWizardExpirySummary')}: {plannedExpiryDate} · {timezone}</small>
          </div>
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
          <p className={styles.assurance}>{t('proofRecruiterValue')}</p>
          {error === 'create' && <p className={styles.warning} role="alert">{t('proofCreateFailed')}</p>}
          <div className={styles.wizardActions}>
            <button type="button" className={styles.secondaryButton} disabled={creating} onClick={() => setStep(1)}>{t('proofWizardBack')}</button>
            <button type="submit" className={styles.submit} disabled={!canCreate}>{creating ? t('proofCreating') : t('proofPublishConfirm')}</button>
          </div>
        </section>}
      </form>}

      {link && step === 3 && (
        <section className={styles.linkPanel} aria-labelledby="candidate-link-heading">
          <p className={styles.eyebrow}>{t('proofSendKicker')}</p>
          <h3 ref={headingRef} id="candidate-link-heading" tabIndex={-1}>{t('proofWizardShareTitle')}</h3>
          <p className={styles.linkNote}>{t('proofWizardShareBody')}</p>
          <p className={styles.roleReady}><bdi dir="auto">{jobTitle}</bdi> · <bdi dir="auto">{companyName}</bdi></p>
          <p className={styles.linkText}>{link}</p>
          <p className={styles.linkNote}>
            {linkDetails && withValues(t('proofLinkReady'), {
              count: linkDetails.maxCandidates,
              date: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: linkDetails.timezone || timezone,
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
                <CopyButton className={styles.secondaryButton} value={`${emailSubject}\n\n${emailBody}`} label={t('proofCopyEmail')} successLabel={t('proofCopiedEmail')} />
                <CopyButton className={styles.secondaryButton} value={link} label={t('proofCopyLink')} successLabel={t('proofCopied')} />
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
                <CopyButton className={styles.secondaryButton} value={whatsAppBody} label={t('proofCopyInvite')} successLabel={t('proofCopiedInvite')} />
                <CopyButton className={styles.secondaryButton} value={link} label={t('proofCopyLink')} successLabel={t('proofCopied')} />
              </div>
              <p className={styles.linkNote}>{t('proofWhatsAppNote')}</p>
            </>
          )}

          <div className={styles.shareNextActions}>
            {volume && linkDetails?.id && <Link href={`/employer/roles/${linkDetails.id}/candidates/add`} className={styles.primaryButton}>{t('proofStepShare')}</Link>}
            <Link href="/employer" className={styles.textLink}>{t('proofOpenDashboard')}</Link>
          </div>

          <div className={styles.recommend}>
            <h3>{t('proofRecommendTitle')}</h3>
            <p>{t('proofRecommendBody')}</p>
            <pre className={styles.invitePreview}>{recommendNote}</pre>
            <CopyButton className={styles.secondaryButton} value={recommendNote} label={t('proofCopyRecommend')} successLabel={t('proofCopiedRecommend')} />
          </div>
        </section>
      )}
    </div>
  );
}
