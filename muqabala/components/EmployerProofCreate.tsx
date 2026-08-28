'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from './LanguageProvider';
import styles from './EmployerProofCreate.module.css';

const MIN_ADVERT_CHARS = 120;

export function EmployerProofCreate() {
  const { lang, setLang, t } = useLang();
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [tooShort, setTooShort] = useState(false);

  async function createLink() {
    if (creating || companyName.trim().length < 2 || jobTitle.trim().length < 2) return;
    if (jobText.trim().length < MIN_ADVERT_CHARS) {
      setTooShort(true);
      setError(false);
      return;
    }

    setCreating(true);
    setError(false);
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
        setError(true);
        return;
      }

      const pack = await fetch('/api/screening/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          jobTitle: jobTitle || generatedBody.role?.title,
          interviewToken: generatedBody.token,
        }),
      });
      const packBody = await pack.json().catch(() => ({})) as { url?: string };
      if (!pack.ok || !packBody.url) {
        setError(true);
        return;
      }

      setLink(packBody.url);
    } catch {
      setError(true);
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

          <ul className={styles.outcomes} aria-label={t('proofCreateStepsLabel')}>
            <li>{t('proofOutcomeTime')}</li>
            <li>{t('proofOutcomeWords')}</li>
            <li>{t('proofOutcomeHuman')}</li>
          </ul>

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
                  setLink('');
                }}
                minLength={2}
                maxLength={80}
                required
                autoComplete="organization"
                placeholder={t('proofCompanyPlaceholder')}
              />
            </label>

            <label className={styles.field}>
              <span>{t('proofJobTitleLabel')}</span>
              <input
                dir="auto"
                value={jobTitle}
                onChange={(event) => {
                  setJobTitle(event.target.value);
                  setLink('');
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
                  setLink('');
                  if (tooShort && event.target.value.trim().length >= MIN_ADVERT_CHARS) setTooShort(false);
                }}
                minLength={MIN_ADVERT_CHARS}
                maxLength={12_000}
                rows={5}
                required
                placeholder={t('proofAdvertPlaceholder')}
              />
            </label>

            <button type="submit" className={styles.submit} disabled={creating}>
              {creating ? t('proofCreating') : t('proofCreateAction')}
            </button>

            <p className={styles.assurance}>{t('proofPracticeStaysPrivate')}</p>

            <div className={styles.messages} aria-live="polite">
              {tooShort && <p className={styles.warning}>{t('proofAdvertTooShort')}</p>}
              {error && <p className={styles.warning}>{t('proofCreateFailed')}</p>}
            </div>
          </form>

          {link && (
            <section className={styles.linkPanel} aria-labelledby="candidate-link-heading">
              <p className={styles.linkEyebrow}>{t('proofLinkTitle')}</p>
              <h2 id="candidate-link-heading">{t('proofStepShare')}</h2>
              <p className={styles.linkText}>{link}</p>
              <p className={styles.linkNote}>{t('proofLinkReady')}</p>
              <div className={styles.linkActions}>
                <button type="button" onClick={() => void copyLink()}>
                  {copied ? t('proofCopied') : t('proofCopyLink')}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">
                  {t('proofWhatsApp')}
                </a>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
