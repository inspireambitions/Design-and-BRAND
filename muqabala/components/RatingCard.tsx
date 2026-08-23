'use client';

import { useState } from 'react';
import type { Attempt, AttemptRating } from '@/lib/scoring';
import { rateAttempt } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { useLang } from './LanguageProvider';

/** Same number as the coaching card: set once in Vercel, never in code. */
const TEAM_NUMBER = (process.env.NEXT_PUBLIC_COACHING_WHATSAPP ?? '').replace(/[^\d]/g, '');

/**
 * Asked once, after the interview is finished. Two questions only:
 * whether the practice was useful, and whether the candidate feels readier
 * than when they started. The second one is the product's actual promise.
 */
export function RatingCard({ attempt }: { attempt: Attempt }) {
  const { t, lang } = useLang();
  const [stars, setStars] = useState(0);
  const [confidence, setConfidence] = useState<AttemptRating['confidence'] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [consentState, setConsentState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [suggestion, setSuggestion] = useState('');
  const [suggestionState, setSuggestionState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const sendToTeam = async (rating: AttemptRating, publicConsent = false, writtenSuggestion?: string) => {
    const isSuggestion = Boolean(writtenSuggestion?.trim());
    if (isSuggestion) setSuggestionState('sending');
    else if (publicConsent) setConsentState('sending');
    else setSendState('sending');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.id,
          roleId: attempt.roleId,
          stars: rating.stars,
          confidence: rating.confidence,
          overallScore: attempt.overallScore,
          questionsAnswered: attempt.answers.length,
          language: lang,
          publicConsent,
          suggestion: writtenSuggestion?.trim() || undefined,
        }),
      });
      if (isSuggestion) setSuggestionState(response.ok ? 'sent' : 'failed');
      else if (publicConsent) setConsentState(response.ok ? 'sent' : 'failed');
      else setSendState(response.ok ? 'sent' : 'failed');
    } catch {
      if (isSuggestion) setSuggestionState('failed');
      else if (publicConsent) setConsentState('failed');
      else setSendState('failed');
    }
  };

  const submit = (nextStars: number, nextConfidence: AttemptRating['confidence']) => {
    const rating: AttemptRating = { stars: nextStars, confidence: nextConfidence };
    rateAttempt(attempt.id, rating);
    track('rating_submitted', {
      role_id: attempt.roleId,
      stars: rating.stars,
      confidence: rating.confidence,
      overall_score: attempt.overallScore ?? undefined,
    });
    setSaved(true);
    void sendToTeam(rating);
  };

  const chooseStars = (value: number) => {
    setStars(value);
    if (confidence) submit(value, confidence);
  };

  const chooseConfidence = (value: AttemptRating['confidence']) => {
    setConfidence(value);
    if (stars > 0) submit(stars, value);
  };

  const summary = [
    `Muqabala test result`,
    `Role: ${attempt.roleTitle}`,
    attempt.overallScore === null ? 'Score: not scored' : `Score: ${attempt.overallScore}/100`,
    `Questions answered: ${attempt.answers.length}`,
    stars > 0 ? `Usefulness: ${stars}/5` : null,
    confidence ? `Feels: ${confidence} ready` : null,
    `Language: ${lang === 'ar' ? 'Arabic' : 'English'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const share = async () => {
    const shareData = { title: 'Muqabala test result', text: summary };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* dismissed — fall through to the WhatsApp link */
      }
    }
    if (typeof window !== 'undefined') {
      // With a configured number the message opens addressed to the team;
      // without one, WhatsApp's own contact picker is the honest fallback.
      const target = TEAM_NUMBER ? `https://wa.me/${TEAM_NUMBER}` : 'https://wa.me/';
      window.open(`${target}?text=${encodeURIComponent(summary)}`, '_blank', 'noopener');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      /* clipboard blocked — the share button still works */
    }
  };

  const allowAnonymousSharing = () => {
    if (!confidence || stars < 1 || consentState === 'sending' || consentState === 'sent') return;
    void sendToTeam({ stars, confidence }, true);
  };

  const sendSuggestion = () => {
    if (!confidence || stars < 1 || !suggestion.trim() || suggestionState === 'sending') return;
    void sendToTeam({ stars, confidence }, false, suggestion);
  };

  return (
    <div className="card stack">
      <div>
        <p className="eyebrow" style={{ marginBottom: '0.35rem' }}>
          {t('rateTitle')}
        </p>
        <p className="muted">{t('rateBody')}</p>
        <p className="tiny" style={{ marginTop: '0.45rem' }}>{t('ratePrivacy')}</p>
      </div>

      <div className="stack-sm">
        <span className="rate-label">{t('rateUseful')}</span>
        <div className="star-row" role="group" aria-label={t('rateUseful')}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`star ${stars >= value ? 'on' : ''}`}
              aria-label={`${value} / 5`}
              aria-pressed={stars === value}
              onClick={() => chooseStars(value)}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <span className="rate-label">{t('rateConfidence')}</span>
        <div className="row rating-choice-row" style={{ gap: '0.4rem' }}>
          {(
            [
              ['more', t('rateMore')],
              ['same', t('rateSame')],
              ['less', t('rateLess')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="filter-btn"
              aria-pressed={confidence === value}
              onClick={() => chooseConfidence(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <div className="stack-sm">
          <p
            className={`notice tiny${sendState === 'failed' ? ' notice-warn' : ''}`}
            style={{ margin: 0 }}
            role="status"
            aria-live="polite"
          >
            {sendState === 'sending'
              ? t('rateSending')
              : sendState === 'sent'
                ? t('rateSent')
                : sendState === 'failed'
                  ? t('rateSendFailed')
                  : t('rateThanks')}
          </p>
          <div className="row rating-actions">
            <button type="button" className="btn btn-quiet" onClick={share}>
              {t('rateSend')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={copy}>
              {copied ? t('rateCopied') : t('copy')}
            </button>
          </div>
          <p className="tiny">{t('rateSendHint')}</p>
          <div className="stack-sm rating-suggestion">
            <label className="rate-label" htmlFor="rating-suggestion">
              {t('rateSuggestionLabel')}
            </label>
            <textarea
              id="rating-suggestion"
              className="answer-box answer-box-compact"
              value={suggestion}
              maxLength={600}
              disabled={suggestionState === 'sent'}
              placeholder={t('rateSuggestionPlaceholder')}
              onChange={(event) => {
                setSuggestion(event.target.value);
                if (suggestionState === 'failed') setSuggestionState('idle');
              }}
            />
            <p className="tiny">{t('rateSuggestionPrivacy')}</p>
            <div className="row">
              <button
                type="button"
                className="btn btn-quiet"
                disabled={!suggestion.trim() || suggestionState === 'sending' || suggestionState === 'sent'}
                onClick={sendSuggestion}
              >
                {suggestionState === 'sending'
                  ? t('rateSuggestionSending')
                  : suggestionState === 'sent'
                    ? t('rateSuggestionSent')
                    : t('rateSuggestionButton')}
              </button>
              <span className="tiny">{suggestion.length}/600</span>
            </div>
            {suggestionState === 'failed' && (
              <p className="tiny notice notice-warn" role="status">{t('rateSuggestionFailed')}</p>
            )}
          </div>
          {sendState === 'sent' && (
            <div className="notice stack-sm" style={{ marginTop: '0.45rem' }}>
              <strong>{t('ratePublicTitle')}</strong>
              <p className="tiny" style={{ margin: 0 }}>{t('ratePublicBody')}</p>
              {consentState === 'sent' ? (
                <p className="tiny" style={{ margin: 0 }} role="status">{t('ratePublicThanks')}</p>
              ) : (
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={consentState === 'sending'}
                  onClick={allowAnonymousSharing}
                >
                  {consentState === 'sending' ? t('ratePublicSending') : t('ratePublicButton')}
                </button>
              )}
              {consentState === 'failed' && (
                <p className="tiny" style={{ margin: 0 }} role="status">{t('ratePublicFailed')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
