'use client';

import { useState } from 'react';
import { Play } from '@phosphor-icons/react';
import { signEmployerVideo } from '@/app/employer/actions';
import styles from '@/app/employer/EmployerDashboard.module.css';
import { useLang } from './LanguageProvider';

type Props = {
  interviewId: string;
  questionIndex: number;
  durationSeconds: number | null;
  label: string;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * A placeholder stands in for the recording until the employer taps play.
 * Only then is a signed URL requested and a <video> element mounted, so the
 * transcript and AI notes never wait on media bytes.
 */
export function EmployerReportVideo({ interviewId, questionIndex, durationSeconds, label }: Props) {
  const { t } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openRecording() {
    setLoading(true);
    setError('');
    try {
      const result = await signEmployerVideo(interviewId, questionIndex);
      if ('url' in result) setUrl(result.url);
      else setError(result.error);
    } catch {
      setError(t('employerVideoRetry'));
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <video className={styles.video} controls autoPlay playsInline preload="metadata" src={url}
        onError={() => { setUrl(null); setError(t('employerVideoRetry')); }}>
        Your browser cannot play this video.
      </video>
    );
  }

  const duration = formatDuration(durationSeconds);
  return (
    <div className={styles.videoPlaceholder}>
      <button type="button" className={styles.videoPlay} onClick={() => void openRecording()} disabled={loading} aria-label={`Play recording for ${label}`}>
        <Play aria-hidden="true" weight="fill" />
        <span>{loading ? 'Opening recording…' : `Play recording${duration ? ` · ${duration}` : ''}`}</span>
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
