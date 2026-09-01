'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from './LanguageProvider';
import { EmailSignIn } from './EmailSignIn';
import styles from './EmployerProofCreate.module.css';

const MIN_ADVERT_CHARS = 120;
const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_EXPIRY_DAYS = 14;
const EXPIRY_OPTIONS = [1, 3, 7, 14, 21, 30] as const;

type LinkDetails = {
  id: string;
  url: string;
  expiresAt: string;
  maxCandidates: number;
};

type InviteStatus = 'idle' | 'sent' | 'error';

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
  const [showLinkSettings, setShowLinkSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('idle');
  const [sharing, setSharing] = useState(false);
  const [closingLink, setClosingLink] = useState(false);
  const [linkClosed, setLinkClosed] = useState(false);
  const [closeError, setCloseError] = useState(false);
  const [error, setError] = useState<'generate' | 'create' | null>(null);
  const [tooShort, setTooShort] = useState(false);

  const companyReady = companyName.trim().length >= 2;
  const titleReady = jobTitle.trim().length >= 2;
  const jobReady = jobText.trim().length >= MIN_ADVERT_CHARS;
  const settingsReady = Number.isInteger(maxCandidates) && maxCandidates >= 1 && maxCandidates <= 1000;
  const canGenerate = companyReady && titleReady && !generating && !creating;
  const canCreate = companyReady && titleReady && jobReady && settingsReady && !generating && !creating;
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail.trim());
  const link = linkDetails?.url ?? '';
  function resetLinkSettings() {
    setMaxCandidates(DEFAULT_MAX_CANDIDATES);
    setExpiryDays(DEFAULT_EXPIRY_DAYS);
    setLinkDetails(null);
  }

  function withValues(template: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce(
      (copy, [key, value]) => copy.replace(`{${key}}`, String(value)),
      template,
    );
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
    setCopied(false);

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
      if (!pack.ok || !packBody.id || !packBody.url || !packBody.expiresAt || !packBody.maxCandidates) {
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

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function shareLink() {
    if (!link) return;
    if (!navigator.share) {
      await copyLink();
      return;
    }
    setSharing(true);
    try {
      await navigator.share({
        title: `${companyName.trim()}: ${jobTitle.trim()}`,
        text: t('proofShareMessage'),
        url: link,
      });
    } catch {
      // Closing the native share sheet is not an error that needs a message.
    } finally {
      setSharing(false);
    }
  }

  async function sendInvitation() {
    if (!linkDetails || !emailReady || sendingInvite || linkClosed) return;
    setSendingInvite(true);
    setInviteStatus('idle');

    try {
      const response = await fetch(`/api/screening/packs/${encodeURIComponent(linkDetails.id)}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: candidateEmail.trim() }),
      });
      if (!response.ok) {
        setInviteStatus('error');
        return;
      }
      setInviteStatus('sent');
    } catch {
      setInviteStatus('error');
    } finally {
      setSendingInvite(false);
    }
  }

  async function closeLink() {
    if (!linkDetails || closingLink || linkClosed) return;
    if (!window.confirm(t('proofCloseLinkConfirm'))) return;

    setClosingLink(true);
    setCloseError(false);
    try {
      const response = await fetch(`/api/screening/packs/${encodeURIComponent(linkDetails.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      if (!response.ok) {
        setCloseError(true);
        return;
      }
      setLinkClosed(true);
      setInviteStatus('idle');
    } catch {
      setCloseError(true);
    } finally {
      setClosingLink(false);
    }
  }

  return (
    <div className={[styles.page, 'employer-light-theme'].join(' ')}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Muqabala home">
            <span className={styles.brandMark} aria-hidden="true">م</span>
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
        <section aria-labelledby="employer-create-title">
          <p className={styles.eyebrow}>{t('proofHiringKicker')}</p>
          <h1 id="employer-create-title" className={styles.title}>{t('proofCreateTitle')}</h1>
          <p className={styles.lede}>{t('proofCreateBody')}</p>

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
          <p className={styles.assurance}>{t('proofRecruiterValue')}</p>

          {!signedIn ? (
            <div className={styles.signInPanel}>
              <h2>Sign in to create private interview links</h2>
              <p>Only your signed-in employer account can open the submitted videos and reports.</p>
              <EmailSignIn compact next="/for-employers" />
            </div>
          ) : !linkDetails ? <form
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
                  setGenerated(false);
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

            <section className={styles.linkSettings} aria-labelledby="link-settings-label">
              <div className={styles.linkSettingsHead}>
                <div>
                  <span id="link-settings-label">{t('proofLinkSettingsLabel')}</span>
                  <p suppressHydrationWarning>
                    {withValues(t('proofLinkSettingsCompact'), {
                      count: maxCandidates,
                      duration: expiryDays === 1
                        ? t('proofLinkDayOption')
                        : withValues(t('proofLinkDaysOption'), { days: expiryDays }),
                    })}
                  </p>
                </div>
                <button
                  className={styles.linkSettingsChange}
                  type="button"
                  aria-expanded={showLinkSettings}
                  aria-controls="link-settings-fields"
                  onClick={() => setShowLinkSettings((shown) => !shown)}
                >
                  {showLinkSettings ? t('proofLinkSettingsDone') : t('proofLinkSettingsChange')}
                </button>
              </div>
              {showLinkSettings && (
                <fieldset id="link-settings-fields" className={styles.linkSettingsFields}>
                  <legend className={styles.srOnly}>{t('proofLinkSettingsLabel')}</legend>
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
                  <div className={styles.linkSettingsFoot}>
                    <span>{t('proofLinkSettingsHelp')}</span>
                    <button className={styles.linkSettingsReset} type="button" onClick={resetLinkSettings}>
                      {t('proofLinkSettingsReset')}
                    </button>
                  </div>
                </fieldset>
              )}
            </section>

            <div className={styles.actions} aria-label={t('proofCreateStepsLabel')}>
              <button
                type="button"
                className={`${styles.generate} ${jobReady ? styles.generateSecondary : styles.generatePrimary}`}
                disabled={!canGenerate}
                onClick={() => void generateJobDescription()}
              >
                <span>{generating
                  ? t('proofGeneratingAdvert')
                  : jobReady
                    ? t('proofRegenerateAdvert')
                    : t('proofGenerateAdvert')}</span>
              </button>
              <button type="submit" className={styles.submit} disabled={!canCreate}>
                <span>{creating ? t('proofCreating') : t('proofCreateAction')}</span>
              </button>
            </div>

            <div id="job-description-status" className={styles.status} aria-live="polite">
              {generated && <p>{t('proofAdvertGenerated')}</p>}
            </div>

            <div className={styles.messages} aria-live="polite">
              {tooShort && <p className={styles.warning}>{t('proofAdvertTooShort')}</p>}
              {error === 'generate' && <p className={styles.warning}>{t('proofGenerateFailed')}</p>}
              {error === 'create' && <p className={styles.warning}>{t('proofCreateFailed')}</p>}
            </div>
          </form> : null}

          {linkDetails && (
            <section className={styles.invitePanel} aria-labelledby="candidate-invite-heading">
              <div className={styles.inviteHead}>
                <div>
                  <h2 id="candidate-invite-heading">{t('proofInviteTitle')}</h2>
                </div>
                <p className={linkClosed ? styles.closedStatus : styles.readyStatus}>
                  {linkClosed ? t('proofLinkClosed') : t('proofLinkActive')}
                </p>
              </div>

              <p className={styles.inviteSummary}>
                <strong>{companyName.trim()}</strong>
                <span aria-hidden="true"> · </span>
                <span>{jobTitle.trim()}</span>
              </p>
              <p className={styles.linkNote} suppressHydrationWarning>
                {withValues(t('proofLinkReady'), {
                  count: linkDetails.maxCandidates,
                  date: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(linkDetails.expiresAt)),
                })}
              </p>

              {!linkClosed && (
                <form
                  className={styles.inviteForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendInvitation();
                  }}
                >
                  <label className={styles.inviteField}>
                    <span>{t('proofCandidateEmailLabel')}</span>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={254}
                      required
                      value={candidateEmail}
                      onChange={(event) => {
                        setCandidateEmail(event.target.value);
                        setInviteStatus('idle');
                      }}
                      placeholder={t('proofCandidateEmailPlaceholder')}
                      aria-describedby="candidate-invite-help candidate-invite-status"
                    />
                  </label>
                  <p id="candidate-invite-help" className={styles.inviteHelp}>{t('proofInviteHelp')}</p>
                  <button
                    type="submit"
                    className={styles.sendInvite}
                    disabled={!emailReady || sendingInvite}
                  >
                    {sendingInvite ? t('proofSendingInvite') : t('proofSendInvite')}
                  </button>
                  <div id="candidate-invite-status" className={styles.inviteStatus} aria-live="polite">
                    {inviteStatus === 'sent' && (
                      <p className={styles.inviteSuccess}>
                        {withValues(t('proofInviteSent'), { email: candidateEmail.trim() })}
                      </p>
                    )}
                    {inviteStatus === 'error' && <p className={styles.inviteError}>{t('proofInviteFailed')}</p>}
                  </div>
                </form>
              )}

              <nav className={styles.secondaryActions} aria-label={t('proofOtherInviteWays')}>
                <button type="button" onClick={() => void copyLink()} disabled={linkClosed}>
                  {copied ? t('proofCopied') : t('proofCopyOpenLink')}
                </button>
                <button type="button" onClick={() => void shareLink()} disabled={sharing || linkClosed}>
                  {sharing ? t('proofSharing') : t('proofShareAnotherWay')}
                </button>
                <Link href="/employer">{t('proofViewCandidates')}</Link>
              </nav>

              <button
                type="button"
                className={styles.closeLink}
                onClick={() => void closeLink()}
                disabled={closingLink || linkClosed}
              >
                {closingLink ? t('proofClosingLink') : linkClosed ? t('proofLinkClosed') : t('proofCloseLink')}
              </button>
              {closeError && <p className={styles.closeError} role="alert">{t('proofCloseFailed')}</p>}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
