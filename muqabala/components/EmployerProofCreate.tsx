'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from './LanguageProvider';
import { MarketingFooter, MarketingHeader } from './MarketingSite';

const MIN_ADVERT_CHARS = 120;

export function EmployerProofCreate() {
  const { t } = useLang();
  const [workplace, setWorkplace] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [tooShort, setTooShort] = useState(false);

  async function createLink() {
    if (busy) return;
    if (jobText.trim().length < MIN_ADVERT_CHARS) {
      setTooShort(true);
      setError(false);
      return;
    }
    setBusy(true);
    setError(false);
    setTooShort(false);
    setCopied(false);
    try {
      const generated = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobText }),
      });
      if (generated.status === 429) {
        setError(true);
        return;
      }
      const generatedBody = await generated.json().catch(() => ({})) as { token?: string; role?: { title?: string } };
      const pack = await fetch('/api/screening/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workplace,
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
      setBusy(false);
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
    <>
      <MarketingHeader />
      <main className="marketing-main">
        <section className="marketing-wrap" style={{ padding: '3rem 0 4rem', maxWidth: '40rem' }}>
          <p className="marketing-eyebrow">{t('proofHiringKicker')}</p>
          <h1 style={{ fontSize: '2rem', lineHeight: 1.2 }}>{t('proofCreateTitle')}</h1>
          <p className="marketing-lede" style={{ marginTop: '0.75rem' }}>{t('proofCreateBody')}</p>
          <p className="tiny" style={{ marginTop: '0.75rem' }}>
            {t('proofPracticeStaysPrivate')}
          </p>

          <form
            className="stack"
            style={{ marginTop: '2rem' }}
            onSubmit={(event) => {
              event.preventDefault();
              void createLink();
            }}
          >
            <label className="stack-sm">
              <span className="eyebrow">{t('proofWorkplaceLabel')}</span>
              <input
                className="answer-box"
                value={workplace}
                onChange={(event) => setWorkplace(event.target.value)}
                maxLength={80}
                placeholder={t('proofWorkplacePlaceholder')}
              />
            </label>
            <label className="stack-sm">
              <span className="eyebrow">{t('proofJobTitleLabel')}</span>
              <input
                className="answer-box"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                maxLength={120}
                required
                placeholder={t('proofJobTitlePlaceholder')}
              />
            </label>
            <label className="stack-sm">
              <span className="eyebrow">{t('proofAdvertLabel')}</span>
              <textarea
                className="answer-box"
                value={jobText}
                onChange={(event) => {
                  setJobText(event.target.value);
                  if (tooShort && event.target.value.trim().length >= MIN_ADVERT_CHARS) setTooShort(false);
                }}
                rows={10}
                required
                placeholder={t('proofAdvertPlaceholder')}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy || jobTitle.trim().length < 2}>
              {busy ? t('proofCreating') : t('proofCreateAction')}
            </button>
            {tooShort && <p className="notice notice-warn">{t('proofAdvertTooShort')}</p>}
            {error && <p className="notice notice-warn">{t('proofCreateFailed')}</p>}
          </form>

          {link && (
            <div className="card stack" style={{ marginTop: '1.5rem' }}>
              <p className="eyebrow">{t('proofLinkTitle')}</p>
              <p className="tiny" style={{ overflowWrap: 'anywhere' }}>{link}</p>
              <p className="tiny">{t('proofLinkReady')}</p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => void copyLink()}>
                  {copied ? t('proofCopied') : t('proofCopyLink')}
                </button>
                <a className="btn btn-quiet" href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">
                  {t('proofWhatsApp')}
                </a>
              </div>
            </div>
          )}

          <p className="tiny" style={{ marginTop: '2rem' }}>
            {t('proofCandidatesUseCoach')}{' '}
            <Link href="/practice">{t('startPractice')}</Link>
          </p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
