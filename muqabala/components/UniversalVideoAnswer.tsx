'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startAudioCaptureFromStream, type AudioCapture } from '@/lib/audio-capture';
import { startVideoAnswerRecording, type VideoAnswerRecorder } from '@/lib/media';
import { useLang } from './LanguageProvider';

const RECORDING_LIMIT_SECONDS = 120;

type CapturePhase = 'idle' | 'ready' | 'recording' | 'transcribing' | 'review';

type Props = {
  disabled?: boolean;
  onTranscript: (transcript: string) => void;
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function UniversalVideoAnswer({ disabled = false, onTranscript }: Props) {
  const { t } = useLang();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_LIMIT_SECONDS);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<VideoAnswerRecorder | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const stoppingRef = useRef(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  }, []);

  const releasePlayback = useCallback(() => {
    setPlaybackUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  useEffect(() => {
    setSupported(
      window.isSecureContext
      && typeof navigator.mediaDevices?.getUserMedia === 'function'
      && typeof MediaRecorder !== 'undefined',
    );
    return () => {
      videoRecorderRef.current?.discard();
      audioCaptureRef.current?.discard();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  useEffect(() => {
    if (!previewRef.current || !streamRef.current || (phase !== 'ready' && phase !== 'recording')) return;
    previewRef.current.srcObject = streamRef.current;
    void previewRef.current.play().catch(() => {});
  }, [phase]);

  const enableCamera = async () => {
    setError('');
    releasePlayback();
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      const cameraReady = stream.getVideoTracks().some((track) => track.readyState === 'live');
      const microphoneReady = stream.getAudioTracks().some((track) => track.readyState === 'live');
      if (!cameraReady || !microphoneReady) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('device_not_ready');
      }
      streamRef.current = stream;
      setSecondsLeft(RECORDING_LIMIT_SECONDS);
      setPhase('ready');
    } catch {
      stopStream();
      setError(t('brainVideoPermissionError'));
      setPhase('idle');
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    setError('');
    releasePlayback();
    const videoRecorder = startVideoAnswerRecording(stream);
    if (!videoRecorder) {
      setError(t('brainVideoUnsupported'));
      return;
    }
    videoRecorderRef.current = videoRecorder;
    audioCaptureRef.current = startAudioCaptureFromStream(stream);
    setSecondsLeft(RECORDING_LIMIT_SECONDS);
    setPhase('recording');
  };

  const transcribe = useCallback(async (audio: Blob): Promise<string> => {
    const form = new FormData();
    form.append('audio', audio, 'answer');
    form.append('lang', 'en');
    const response = await fetch('/api/transcribe', { method: 'POST', body: form });
    if (!response.ok) throw new Error('transcription_failed');
    const body = await response.json() as { transcript?: string };
    return body.transcript?.trim() ?? '';
  }, []);

  const stopRecording = useCallback(async () => {
    if (stoppingRef.current || phase !== 'recording') return;
    stoppingRef.current = true;
    setPhase('transcribing');
    const videoRecorder = videoRecorderRef.current;
    const audioCapture = audioCaptureRef.current;
    videoRecorderRef.current = null;
    audioCaptureRef.current = null;
    try {
      const [video, audio] = await Promise.all([
        videoRecorder?.stop() ?? Promise.resolve(null),
        audioCapture?.stop() ?? Promise.resolve(null),
      ]);
      stopStream();
      if (!video) throw new Error('empty_recording');
      const url = URL.createObjectURL(video.blob);
      setPlaybackUrl(url);
      if (!audio) {
        setError(t('brainVideoTranscriptError'));
        setPhase('review');
        return;
      }
      try {
        const transcript = await transcribe(audio);
        if (!transcript) throw new Error('empty_transcript');
        onTranscript(transcript);
      } catch {
        setError(t('brainVideoTranscriptError'));
      }
      setPhase('review');
    } catch {
      videoRecorder?.discard();
      audioCapture?.discard();
      stopStream();
      setError(t('brainVideoCaptureError'));
      setPhase('idle');
    } finally {
      stoppingRef.current = false;
    }
  }, [onTranscript, phase, stopStream, t, transcribe]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => void stopRecording(), 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, stopRecording]);

  const reset = () => {
    videoRecorderRef.current?.discard();
    audioCaptureRef.current?.discard();
    videoRecorderRef.current = null;
    audioCaptureRef.current = null;
    stopStream();
    releasePlayback();
    setError('');
    setSecondsLeft(RECORDING_LIMIT_SECONDS);
    setPhase('idle');
  };

  if (supported === false) {
    return <p className="notice tiny">{t('brainVideoUnsupported')}</p>;
  }

  return <section className="brain-video-capture stack-sm" aria-labelledby="brain-video-title">
    <div className="row-between brain-video-heading">
      <div>
        <p className="eyebrow">{t('brainVideoOptional')}</p>
        <h3 id="brain-video-title">{t('brainVideoTitle')}</h3>
      </div>
      {phase === 'recording' && <span className="brain-recording-live" role="status">{t('brainVideoRecording')} · {formatTime(secondsLeft)}</span>}
    </div>

    <p className="tiny">{t('brainVideoPrivacy')}</p>

    {(phase === 'ready' || phase === 'recording') && <div className="brain-video-frame">
      <video ref={previewRef} muted playsInline autoPlay aria-label={t('brainVideoPreview')} />
    </div>}

    {(phase === 'transcribing' || phase === 'review') && playbackUrl && <div className="brain-video-frame">
      <video src={playbackUrl} controls playsInline aria-label={t('brainVideoPlayback')} />
    </div>}

    {error && <p className="notice notice-warn tiny" role="alert">{error}</p>}
    {phase === 'transcribing' && <p className="notice tiny" role="status">{t('brainVideoTranscribing')}</p>}
    {phase === 'review' && <p className="notice tiny" role="status">{t('brainVideoReview')}</p>}

    <div className="row brain-video-actions">
      {phase === 'idle' && <button type="button" className="btn btn-ghost" disabled={disabled || supported === null} onClick={() => void enableCamera()}>
        {t('brainVideoEnable')}
      </button>}
      {phase === 'ready' && <button type="button" className="btn btn-primary" disabled={disabled} onClick={startRecording}>
        {t('brainVideoStart')}
      </button>}
      {phase === 'recording' && <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => void stopRecording()}>
        {t('brainVideoStop')}
      </button>}
      {(phase === 'ready' || phase === 'review') && <button type="button" className="btn btn-ghost" disabled={disabled} onClick={reset}>
        {phase === 'review' ? t('brainVideoRecordAgain') : t('brainVideoCancel')}
      </button>}
    </div>
  </section>;
}
