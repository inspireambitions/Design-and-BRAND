'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { saveHeroDraft } from '@/lib/hero-draft';
import { advertUsable, looksLikeUrl } from '@/lib/landing/advert-text';
import { browserStores, shouldAskForEmail } from '@/lib/landing/email-consent';
import { useLang } from '../LanguageProvider';
import { InterviewPackAsk } from './InterviewPackAsk';

/**
 * The primary start path on /practice. The pasted advert is handed to
 * /practice/custom through the sessionStorage draft, which builds the
 * interview as soon as it mounts. Before that handoff the candidate is asked,
 * once, where to send their interview pack.
 */
export function AdvertPasteBox() {
  const { t } = useLang();
  const router = useRouter();
  const [jobText, setJobText] = useState('');
  const [askingForEmail, setAskingForEmail] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const headingId = useId();
  const statusId = useId();

  const trimmed = jobText.trim();
  const pastedLink = looksLikeUrl(trimmed);
  const usable = advertUsable(trimmed);

  const handOver = () => {
    setLeaving(true);
    router.prefetch('/practice/custom');
    saveHeroDraft({ jobTitle: '', jobText: trimmed });
    router.push('/practice/custom');
  };

  const continueToInterview = () => {
    if (!usable || leaving) return;
    if (shouldAskForEmail(browserStores())) {
      setAskingForEmail(true);
      return;
    }
    handOver();
  };

  if (askingForEmail) {
    return (
      <section className="landing-advert" aria-labelledby={headingId}>
        <h2 id={headingId} className="sr-only">{t('landingPasteHeading')}</h2>
        <InterviewPackAsk onContinue={handOver} />
      </section>
    );
  }

  return (
    <section className="landing-advert" aria-labelledby={headingId}>
      <form
        className="card stack landing-advert-card"
        onSubmit={(event) => {
          event.preventDefault();
          continueToInterview();
        }}
      >
        <div className="stack-sm">
          <h2 id={headingId} className="landing-advert-heading">{t('landingPasteHeading')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            <a href="#popular-roles" className="landing-advert-subline">{t('landingPasteSubline')}</a>
          </p>
        </div>

        <label className="stack-sm" htmlFor="landing-job-ad">
          <span className="eyebrow" style={{ marginBottom: 0, color: 'var(--gold)' }}>
            {t('landingPasteLabel')}
          </span>
          <textarea
            id="landing-job-ad"
            className="answer-box landing-advert-box"
            value={jobText}
            placeholder={t('landingPastePlaceholder')}
            aria-describedby={statusId}
            onChange={(event) => setJobText(event.target.value)}
          />
        </label>

        <p id={statusId} className={pastedLink ? 'notice notice-warn tiny' : 'tiny'} style={{ margin: 0 }}>
          {pastedLink
            ? t('jdLinkNotSupported')
            : trimmed.length > 0 && !usable
              ? t('jdTooShort')
              : usable
                ? t('jdReady')
                : t('landingPasteHint')}
        </p>

        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={!usable || leaving}>
            {leaving ? t('jdBuilding') : t('landingPasteContinue')}
          </button>
        </div>
      </form>
    </section>
  );
}
