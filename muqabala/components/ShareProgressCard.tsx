'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import type { Lang } from '@/lib/i18n';
import { useLang } from './LanguageProvider';
import type { Attempt } from '@/lib/scoring';
import { useReadiness } from './ReadinessScore';

type CardState = 'working' | 'ready' | 'failed';

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

/**
 * Family names next/font registered on the document, if the browser has them
 * loaded. Anything not loaded is left out so the card falls back to system
 * fonts rather than drawing with an invisible face.
 */
async function loadedFonts(lang: Lang): Promise<{ display?: string; arabic?: string }> {
  const styles = getComputedStyle(document.documentElement);
  const arabic = styles.getPropertyValue('--font-plex-arabic').trim();
  const display = styles.getPropertyValue('--font-bricolage').trim();
  const fonts = document.fonts;
  const usable = async (family: string, sample: string): Promise<boolean> => {
    if (!family || !fonts) return false;
    try {
      await fonts.load(`700 66px ${family}`, sample);
      return fonts.check(`700 66px ${family}`, sample);
    } catch {
      return false;
    }
  };
  const [hasArabic, hasDisplay] = await Promise.all([
    usable(arabic, 'مقابلة'),
    lang === 'en' ? usable(display, 'Muqabala') : Promise.resolve(false),
  ]);
  return { arabic: hasArabic ? arabic : undefined, display: hasDisplay ? display : undefined };
}

/**
 * The shareable readiness card for one role. Draws the image whenever the
 * readiness number changes, then offers Share (native sheet with the file
 * where supported) and Save image. The drawing code is loaded on demand so it
 * never sits in the practice bundle.
 */
export function ShareProgressCard({ roleId, extraAttempts }: { roleId: string; extraAttempts?: Attempt[] }) {
  const { t, lang } = useLang();
  const snapshot = useReadiness(roleId, extraAttempts);
  const [state, setState] = useState<CardState>('working');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileNameRef = useRef(`muqabala-readiness-${roleId}.png`);

  const score = snapshot?.score;
  const practised = snapshot?.questionsPractised;
  const total = snapshot?.questionsTotal;
  const roleTitle = snapshot?.roleTitle;

  useEffect(() => {
    if (score === undefined || practised === undefined || total === undefined || roleTitle === undefined) return;
    let cancelled = false;
    setState('working');
    setNotice(null);

    (async () => {
      const { renderShareCard, shareCardFileName } = await import('@/lib/share-card');
      const canvas = document.createElement('canvas');
      const fonts = await loadedFonts(lang);
      renderShareCard(canvas, {
        roleTitle,
        score,
        questionsPractised: practised,
        questionsTotal: total,
        lang,
        fonts,
        labels: {
          wordmark: t('shareCardWordmark'),
          readiness: t('shareCardReadiness'),
          questions: t('shareCardQuestions'),
          site: t('shareCardSite'),
        },
      });
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (cancelled) return;
      if (!png) throw new Error('share card: toBlob returned null');
      fileNameRef.current = shareCardFileName(roleId);
      setBlob(png);
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(png);
      });
      setState('ready');
      track('share_card_created', { role_id: roleId, lang });
    })().catch(() => {
      if (!cancelled) setState('failed');
    });

    return () => {
      cancelled = true;
    };
  }, [roleId, score, practised, total, roleTitle, lang, t]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  if (!snapshot || snapshot.questionsPractised === 0) return null;

  const save = () => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileNameRef.current;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNotice(t('shareCardSaved'));
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileNameRef.current, { type: 'image/png' });
    const canShareFiles =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });
    if (!canShareFiles) {
      save();
      return;
    }
    try {
      await navigator.share({
        files: [file],
        title: t('shareCardTitle'),
        text: fill(t('shareCardShareText'), { role: snapshot.roleTitle, score: snapshot.score }),
      });
    } catch (error) {
      // The candidate closing the sheet is not a failure; anything else falls back to saving.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      save();
    }
  };

  const shareAria = fill(t('shareCardShareAria'), { role: snapshot.roleTitle });
  const saveAria = fill(t('shareCardSaveAria'), { role: snapshot.roleTitle });
  const previewAlt = fill(t('shareCardPreviewAlt'), { role: snapshot.roleTitle, score: snapshot.score });

  return (
    <section className="share-card" aria-labelledby={`share-card-title-${roleId}`}>
      <div className="share-card-preview">
        {url && state === 'ready' ? (
          <img src={url} alt={previewAlt} width={1080} height={1350} />
        ) : (
          <span className="muted tiny" aria-hidden="true">
            {state === 'failed' ? '' : t('shareCardGenerating')}
          </span>
        )}
      </div>
      <div className="share-card-body">
        <h3 id={`share-card-title-${roleId}`}>{t('shareCardTitle')}</h3>
        <p className="muted tiny">{t('shareCardBody')}</p>
        <div className="share-card-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={share}
            disabled={state !== 'ready'}
            aria-label={shareAria}
          >
            {t('shareCardShare')}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={save}
            disabled={state !== 'ready'}
            aria-label={saveAria}
          >
            {t('shareCardSave')}
          </button>
        </div>
        <p className="tiny share-card-status" role="status" aria-live="polite">
          {state === 'failed' ? t('shareCardFailed') : state === 'working' ? t('shareCardGenerating') : notice ?? ''}
        </p>
      </div>
    </section>
  );
}
