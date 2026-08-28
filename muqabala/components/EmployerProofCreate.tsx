'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from './LanguageProvider';
import { MarketingFooter, MarketingHeader } from './MarketingSite';

const MIN_ADVERT_CHARS = 120;

export function EmployerProofCreate() {
  const { t } = useLang();
  const [companyName, setCompanyName] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<'generate' | 'create' | null>(null);
  const [tooShort, setTooShort] = useState(false);

  const companyReady = companyName.trim().length >= 2;
  const titleReady = jobTitle.trim().length >= 2;
  const jobReady = jobText.trim().length >= MIN_ADVERT_CHARS;

  async function generateJobDescription() {
    if (generating || creating || !companyReady || !titleReady) return;
    setGenerating(true);
    setGenerated(false);
    setError(null);
    setTooShort(false);
    setLink('');
    try {
      const response = await fetch('/api/screening/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, jobTitle }),
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
    if (creating || generating || !companyReady || !titleReady) return;
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
      if (generated.status === 429) {
        setError('create');
        return;
      }
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
          companyName,
          recruiterName,
          jobTitle: jobTitle || generatedBody.role?.title,
          interviewToken: generatedBody.token,
        }),
      });
      const packBody = await pack.json().catch(() => ({})) as { url?: string };
      if (!pack.ok || !packBody.url) {
        setError('create');
        return;
      }
      setLink(packBody.url);
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
              <span className="eyebrow">{t('proofCompanyLabel')}</span>
              <input
                className="answer-box"
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value);
                  setLink('');
                }}
                maxLength={80}
                required
                autoComplete="organization"
                placeholder={t('proofCompanyPlaceholder')}
              />
            </label>
            <label className="stack-sm">
              <span className="eyebrow">{t('proofRecruiterLabel')}</span>
              <input
                className="answer-box"
                value={recruiterName}
                onChange={(event) => {
                  setRecruiterName(event.target.value);
                  setLink('');
                }}
                maxLength={80}
                autoComplete="name"
                placeholder={t('proofRecruiterPlaceholder')}
              />
            </label>
            <label className="stack-sm">
              <span className="eyebrow">{t('proofJobTitleLabel')}</span>
              <input
                className="answer-box"
                value={jobTitle}
                onChange={(event) => {
                  setJobTitle(event.target.value);
                  setGenerated(false);
                  setLink('');
                }}
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
                  setGenerated(false);
                  setLink('');
                  if (tooShort && event.target.value.trim().length >= MIN_ADVERT_CHARS) setTooShort(false);
                }}
                rows={10}
                required
                placeholder={t('proofAdvertPlaceholder')}
              />
              <span className="tiny">{t('proofAdvertHelp')}</span>
            </label>
            <div className="proof-create-actions">
              <button
                type="button"
                className="btn btn-quiet"
                disabled={generating || creating || !companyReady || !titleReady}
                onClick={() => void generateJobDescription()}
              >
                {generating ? t('proofGeneratingAdvert') : t('proofGenerateAdvert')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating || generating || !companyReady || !titleReady || !jobReady}
              >
                {creating ? t('proofCreating') : t('proofCreateAction')}
              </button>
            </div>
            <div aria-live="polite">
              {generated && <p className="notice notice-ok">{t('proofAdvertGenerated')}</p>}
            </div>
            {tooShort && <p className="notice notice-warn">{t('proofAdvertTooShort')}</p>}
            {error === 'generate' && <p className="notice notice-warn">{t('proofGenerateFailed')}</p>}
            {error === 'create' && <p className="notice notice-warn">{t('proofCreateFailed')}</p>}
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
