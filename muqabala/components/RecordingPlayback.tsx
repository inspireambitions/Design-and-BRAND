'use client';

import { useEffect, useState } from 'react';

/** Local object URLs are revoked when a recording is replaced or the view closes. */
export function RecordingPlayback({ blob, audioOnly = false, label, onPlayed }: {
  blob: Blob; audioOnly?: boolean; label: string; onPlayed?: () => void;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  if (!url) return null;
  return audioOnly
    ? <audio src={url} controls aria-label={label} onPlay={onPlayed} style={{ width: '100%' }} />
    : <video src={url} controls playsInline aria-label={label} style={{ width: '100%' }} />;
}
