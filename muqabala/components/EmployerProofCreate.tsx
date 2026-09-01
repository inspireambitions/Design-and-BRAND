'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MuqabalaMark } from './MarketingSite';
import { useLang } from './LanguageProvider';
import { EmailSignIn } from './EmailSignIn';
import styles from './EmployerProofCreate.module.css';

const MIN_ADVERT_CHARS = 120;
const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_EXPIRY_DAYS = 14;
const EXPIRY_OPTIONS = [1, 3, 7, 14, 21, 30] as const;
const EMPLOYER_HOME = 'https://trymuqabala.com/for-employers';

type LinkDetails = {
  url: string;
  expiresAt: string;
  maxCandidates: number;
};

type CopyTarget = 'link' | 'invite' | 'recommend' | null;

export function EmployerProofCreate({ signedIn }: { signedIn: boolean }) {
  const { lang, setLang, t } = useLang();
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

  const companyReady = companyName.trim().length >= 2;
  const titleReady = jobTitle.trim().length >= 2;
  const jobReady = jobText.trim().length >= MIN_ADVERT_CHARS;
  const settingsReady = Number.isInteger(maxCandidates) && maxCandidates >= 1 && maxCandidates <= 1000;
  const canGenerate = companyReady && titleReady && !generating && !creating;
  const canCreate = companyReady && titleReady && jobReady && settingsReady && !generating && !creating;
  const link = linkDetails?.url ?? '';
  const displayCompany = companyName.trim() || t('proofCompanyPlaceholder');
  const displayTitle = jobTitle.trim() || t('proofJobTitlePlaceholder');
  const plannedExpiryDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));

  function resetLinkSettings() {
    setMaxCandidates(DEFAULT_MAX_CANDIDATES);
    setExpiryDays(DEFAULT_EXPIRY_DAYS);
    setLinkDetails(null);
  }

  function withValues(template: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce(
      (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
      template,
    );
  }

  function candidateInvite(url: string) {
    return withValues(t('proofCandidateInvite'), {
      company: displayCompany,
      title: displayTitle,
      link: url,
    });
  }

  function recommendNote() {
    return withValues(t('proofRecommendMessage'), {
      company: displayCompany,
      title: displayTitle,
      home: EMPLOYER_HOME,
    });
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
        body: JSON.stringify({
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
        }),
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

  const previewQuestions = [
    t('proofPreviewQ1'),
    t('proofPreviewQ2'),
    t('proofPreviewQ3'),
  ];

  return (
    <div className={[styles.page, 'employer-light-theme'].join(' ')}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Muqabala home">
            <span className={styles.brandMark} aria-hidden="true">
              <MuqabalaMark />
            </span>
            <span>Muqabala</span>
          </Link>
          <button
            type="button"
            className={styles.language}
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="employer-create-title">
          <p className={styles.eyebrow}>{t('proofHiringKicker')}</p>
          <h1 id="employer-create-title" className={styles.title}>{t('proofCreateTitle')}</h1>
          <p className={styles.lede}>{t('proofCreateBody')}</p>
          <p className={styles.promise}>{t('proofCreatePromise')}</p>

          {signedIn && (
            <div className={styles.dashboardLink}>
              <Link href="/employer">View employer dashboard</Link>
            </div>
          )}

          <ul className={styles.outcomes} aria-label={t('proofCreateStepsLabel')}>
            <li>{t('proofOutcomeTime')}</li>
            <li>{t('proofOutcomeWords')}</li>
            <li>{t('proofOutcomeHuman')}</li>
          </ul>

          <ul className={styles.trust} aria-label={t('proofTrustLabel')}>
            <li>{t('proofTrustPrivate')}</li>
            <li>{t('proofTrustSame')}</li>
            <li>{t('proofTrustWatch')}</li>
            <li>{t('proofTrustClose')}</li>
          </ul>
        </section>

        <div className={styles.studio}>
          <div className={styles.studioPrimary}>
            {!signedIn ? (
              <div className={styles.signInPanel}>
                <h2>Sign in to create private interview links</h2>
                <p>Only your signed-in employer account can open the submitted videos and reports.</p>
                <EmailSignIn compact next="/for-employers" />
              </div>
            ) : (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  void createLink();
                }}
              >
                <p className={styles.formKicker}>{t('proofStepVacancy')}</p>

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

                <details className={styles.workplace}>
                  <summary>
                    <span className={styles.plus} aria-hidden="true">+</span>
                    {t('proofRecruiterLabel')}
                  </summary>
                  <label className={styles.workplaceField}>
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
                      aria-label={t('proofRecruiterLabel')}
                      placeholder={t('proofRecruiterPlaceholder')}
                    />
                  </label>
                </details>

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
            )}
          </div>

          <aside className={styles.folio} aria-labelledby="evidence-preview-title">
            <p className={styles.folioKicker}>{t('proofPreviewKicker')}</p>
            <h2 id="evidence-preview-title">{t('proofPreviewTitle')}</h2>
            <p className={styles.folioRole}>
              <strong>{displayCompany}</strong>
              <span>{displayTitle}</span>
            </p>
            <p className={styles.folioBody}>{t('proofPreviewBody')}</p>
            <ol className={styles.folioQuestions}>
              {previewQuestions.map((question, index) => (
                <li key={question}>
                  <span className={styles.folioIndex}>{index + 1}</span>
                  <span>
                    <strong>{question}</strong>
                    <em>{t('proofPreviewMinutes')}</em>
                  </span>
                </li>
              ))}
            </ol>
            <p className={styles.folioEmpty}>{t('proofPreviewEmpty')}</p>
            <p className={styles.folioStamp}>{t('proofPreviewDecide')}</p>
          </aside>
        </div>

        {link && (
          <section className={styles.linkPanel} aria-labelledby="candidate-link-heading">
            <p className={styles.linkEyebrow}>{t('proofLinkTitle')}</p>
            <h2 id="candidate-link-heading">{t('proofShareKitTitle')}</h2>
            <p className={styles.linkNote}>{t('proofShareKitBody')}</p>
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
            <pre className={styles.invitePreview}>{candidateInvite(link)}</pre>
            <div className={styles.linkActions}>
              <button type="button" onClick={() => void copyText(link, 'link')}>
                {copied === 'link' ? t('proofCopied') : t('proofCopyLink')}
              </button>
              <button type="button" onClick={() => void copyText(candidateInvite(link), 'invite')}>
                {copied === 'invite' ? t('proofCopiedInvite') : t('proofCopyInvite')}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(candidateInvite(link))}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('proofWhatsAppInvite')}
              </a>
              <Link href="/employer">{t('proofOpenDashboard')}</Link>
            </div>

            <div className={styles.recommend}>
              <h3>{t('proofRecommendTitle')}</h3>
              <p>{t('proofRecommendBody')}</p>
              <pre className={styles.invitePreview}>{recommendNote()}</pre>
              <button type="button" onClick={() => void copyText(recommendNote(), 'recommend')}>
                {copied === 'recommend' ? t('proofCopiedRecommend') : t('proofCopyRecommend')}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
