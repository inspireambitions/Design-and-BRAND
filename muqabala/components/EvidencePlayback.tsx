'use client';

import { useRef, useState } from 'react';
import { Play, X } from '@phosphor-icons/react';
import { signEmployerVideo } from '@/app/employer/actions';
import { formatPlaybackTime } from '@/lib/evaluation-report';
import styles from './EvidencePlayback.module.css';

type Props = {
  interviewId: string;
  evidenceId: string;
  questionNumber: number;
  timestampSeconds: number;
};

export function EvidencePlayback({ interviewId, evidenceId, questionNumber, timestampSeconds }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function playEvidence() {
    if (url && video.current) {
      video.current.currentTime = timestampSeconds;
      await video.current.play().catch(() => null);
      return;
    }
    setBusy(true);
    setError('');
    const result = await signEmployerVideo(interviewId, questionNumber - 1);
    setBusy(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setUrl(result.url);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.ticket}
        onClick={() => void playEvidence()}
        disabled={busy}
        aria-label={`Play question ${questionNumber} from ${formatPlaybackTime(timestampSeconds)}, evidence ${evidenceId}`}
      >
        <Play weight="fill" aria-hidden="true" />
        <strong>Q{questionNumber} {formatPlaybackTime(timestampSeconds)}</strong>
        <code>{evidenceId}</code>
      </button>
      {url && (
        <div className={styles.player}>
          <video
            ref={video}
            controls
            autoPlay
            playsInline
            preload="metadata"
            src={url}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = timestampSeconds;
              void event.currentTarget.play().catch(() => null);
            }}
          >Your browser cannot play this video.</video>
          <button type="button" onClick={() => setUrl(null)} aria-label="Close recording"><X aria-hidden="true" /></button>
        </div>
      )}
      {error && <small className={styles.error} role="alert">{error}</small>}
    </div>
  );
}
