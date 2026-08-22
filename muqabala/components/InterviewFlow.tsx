'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/roles';
import type { AnswerFeedback, Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import { saveAttempt } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { startRecording, startLevelMeter, type AnswerRecorder, type LevelMeter } from '@/lib/media';
import {
  isSpeechSupported,
  isOnDeviceRecognitionAvailable,
  startDictation,
  type SpeechSession,
} from '@/lib/speech';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { FeedbackCard } from './FeedbackCard';
import { ScoreRing } from './ScoreRing';
import { RatingCard } from './RatingCard';

type Stage = 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';
export type InterviewMode = 'guided' | 'mock';

type CompletedAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

type ScoringError = {
  creditsExhausted: boolean;
  answerTooLong: boolean;
};

class ScoringRequestError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly retryAfterSeconds: number,
    readonly creditsExhausted: boolean,
    readonly answerTooLong: boolean,
  ) {
    super('Scoring request failed');
  }
}

function estimateMinutes(role: Role): number {
  const seconds = role.questions.reduce((s, q) => s + q.prepSeconds + q.answerSeconds, 0);
  return Math.max(5, Math.round(seconds / 60));
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}


/** The whole interview as plain text — copyable, sendable, readable anywhere. */
function buildReportText(
  roleTitle: string,
  overall: number | null,
  answers: CompletedAnswer[],
  labels: { report: string; score: string; question: string; yourAnswer: string; worked: string; improve: string },
): string {
  const lines: string[] = [`${labels.report} — ${roleTitle}`];
  if (overall !== null) lines.push(`${labels.score}: ${overall}/100`);
  lines.push('');
  answers.forEach((a, i) => {
    lines.push(`${labels.question} ${i + 1}: ${a.questionText}`);
    if (a.feedback.status === 'scored') lines.push(`${labels.score}: ${a.feedback.score}/100`);
    lines.push(`${labels.yourAnswer}: ${a.transcript || '—'}`);
    if (a.feedback.strengths.length) lines.push(`${labels.worked}: ${a.feedback.strengths.join(' | ')}`);
    if (a.feedback.improvements.length) lines.push(`${labels.improve}: ${a.feedback.improvements.join(' | ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function InterviewFlow({
  role,
  customTitle,
  tailored = false,
  interviewToken,
  fellBack = false,
  mode = 'guided',
}: {
  role: Role;
  /** Job title typed by the candidate when practising a role not in the catalogue. */
  customTitle?: string;
  /** True when the questions were generated from a pasted job advert. */
  tailored?: boolean;
  /** Signed rubric that lets the server score a generated interview. */
  interviewToken?: string;
  /** True when an advert was pasted but tailoring did not succeed. */
  fellBack?: boolean;
  /** Guided shows feedback after each answer. Mock saves it until the final report. */
  mode?: InterviewMode;
}) {
  const { lang, t } = useLang();

  const [stage, setStage] = useState<Stage>('check');
  const [index, setIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);

  /**
   * 'idle' means we have not asked yet — which must never be reported to the
   * candidate as "blocked". Only a real refusal is 'denied'.
   */
  const [cameraState, setCameraState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const [onDeviceSpeech, setOnDeviceSpeech] = useState(false);
  const [voiceDeclined, setVoiceDeclined] = useState(false);
  const [limitedExperience, setLimitedExperience] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [deviceFallback, setDeviceFallback] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [scoringError, setScoringError] = useState<ScoringError | null>(null);
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  const [answers, setAnswers] = useState<CompletedAnswer[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dictationRef = useRef<SpeechSession | null>(null);
  const recorderRef = useRef<AnswerRecorder | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const playbackRef = useRef<HTMLVideoElement | null>(null);
  const savedRef = useRef(false);
  const scoringInFlightRef = useRef(false);
  const finalizingRef = useRef(false);
  const advancingRef = useRef(false);
  const scoringSessionRef = useRef<string | null>(null);
  const automaticRetriesRef = useRef(0);
  const [savedAttempt, setSavedAttempt] = useState<Attempt | null>(null);

  const useVoice = speechOk && !voiceDeclined;
  const question = role.questions[index];
  const isLast = index === role.questions.length - 1;
  const questionText = lang === 'ar' ? question.textAr : question.text;
  const hintText = lang === 'ar' ? question.hintAr : question.hint;

  useEffect(() => {
    const supported = isSpeechSupported();
    setSpeechOk(supported);
    if (!supported) return;
    let cancelled = false;
    isOnDeviceRecognitionAvailable(lang === 'ar' ? 'ar-AE' : 'en-US').then((local) => {
      if (!cancelled) setOnDeviceSpeech(local);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const stopDictation = useCallback(() => {
    const captured = dictationRef.current?.stop();
    dictationRef.current = null;
    if (captured) {
      setTranscript(
        [captured.finalText.trim(), captured.interimText.trim()].filter(Boolean).join(' '),
      );
    }
    setInterim('');
  }, []);

  const switchToTyping = useCallback(async () => {
    stopDictation();
    setVoiceDeclined(true);
    meterRef.current?.stop();
    meterRef.current = null;
    setMicLevel(0);

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      const unusedUrl = await recorder.stop();
      if (unusedUrl) URL.revokeObjectURL(unusedUrl);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState('idle');
  }, [stopDictation]);

  // Release camera and microphone when the component unmounts.
  useEffect(() => {
    return () => {
      dictationRef.current?.stop();
      meterRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Object URLs are session-only; free the previous one whenever it is replaced.
  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  const enableCamera = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraState('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      return true;
    } catch {
      // Refused, dismissed, or no camera on the device. Practice continues by
      // typing — the camera is a rehearsal aid, never a requirement.
      setCameraState('denied');
      return false;
    } finally {
      setRequestingCamera(false);
    }
  }, []);

  // Re-attach the stream whenever the video element remounts between stages.
  useEffect(() => {
    if (cameraState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraState, stage]);

  const beginRecording = useCallback(() => {
    setInterrupted(false);
    setTranscript('');
    setInterim('');
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    setSecondsLeft(question.answerSeconds);
    setStage('record');

    if (useVoice) {
      const speechSession = startDictation(
        lang === 'ar' ? 'ar-AE' : 'en-US',
        (finalText, interimText) => {
          setTranscript(finalText);
          setInterim(interimText);
        },
        () => {
          setSpeechOk(false);
          setDeviceFallback(true);
          void switchToTyping();
        },
      );
      if (!speechSession) {
        setSpeechOk(false);
        setDeviceFallback(true);
        void switchToTyping();
        return;
      }
      dictationRef.current = speechSession;
      if (streamRef.current) {
        recorderRef.current = startRecording(streamRef.current);
        meterRef.current = startLevelMeter(streamRef.current, setMicLevel);
      }
    }
  }, [lang, playbackUrl, question.answerSeconds, switchToTyping, useVoice]);

  const finishAnswer = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);
    try {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      setMicLevel(0);
      setStage('review');

      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        const url = await recorder.stop();
        if (url) setPlaybackUrl(url);
      }
    } finally {
      finalizingRef.current = false;
      setIsFinalizing(false);
    }
  }, [stopDictation]);

  // Phone calls and app switches can stop browser media without a useful
  // error. Move the candidate to review while their transcript is still in
  // memory, then explain what happened when they return.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden' || stage !== 'record' || !useVoice) return;
      setInterrupted(true);
      void finishAnswer();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [finishAnswer, stage, useVoice]);

  const startPrep = useCallback(() => {
    setSecondsLeft(question.prepSeconds);
    setStage('prep');
  }, [question.prepSeconds]);

  // Countdown for both the prep and recording stages.
  useEffect(() => {
    if (stage !== 'prep' && stage !== 'record') return;
    if (secondsLeft <= 0) {
      if (stage === 'prep') beginRecording();
      else if (useVoice) finishAnswer();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [stage, secondsLeft, beginRecording, finishAnswer, useVoice]);

  const submitForScoring = useCallback(async () => {
    if (scoringInFlightRef.current) return;
    scoringInFlightRef.current = true;
    setIsScoring(true);
    setScoringError(null);
    setRetrySeconds(null);
    if (!scoringSessionRef.current) {
      scoringSessionRef.current =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Scoring-Session': scoringSessionRef.current,
        },
        body: JSON.stringify({
          roleId: role.id,
          questionId: question.id,
          transcript,
          lang,
          roleTitle: customTitle,
          interviewToken,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string; retryable?: boolean; retryAfterSeconds?: number };
        } | null;
        const headerDelay = Number(response.headers.get('Retry-After'));
        const requestedDelay = body?.error?.retryAfterSeconds ?? headerDelay;
        const delay = Number.isFinite(requestedDelay)
          ? Math.max(2, Math.min(120, Math.ceil(requestedDelay)))
          : 20;
        throw new ScoringRequestError(
          body?.error?.retryable ??
            (response.status === 409 || response.status === 429 || response.status >= 500),
          delay,
          body?.error?.code === 'credits_exhausted' || response.status === 402,
          body?.error?.code === 'answer_too_long' || response.status === 413,
        );
      }
      const data = (await response.json()) as { feedback: AnswerFeedback };
      setFeedback(data.feedback);
      setStage('feedback');
      scoringSessionRef.current = null;
      automaticRetriesRef.current = 0;
    } catch (error) {
      const requestError =
        error instanceof ScoringRequestError
          ? error
          : new ScoringRequestError(true, 20, false, false);
      setScoringError({
        creditsExhausted: requestError.creditsExhausted,
        answerTooLong: requestError.answerTooLong,
      });
      if (requestError.retryable && automaticRetriesRef.current < 2) {
        automaticRetriesRef.current += 1;
        setRetrySeconds(requestError.retryAfterSeconds);
      }
    } finally {
      window.clearTimeout(timeoutId);
      scoringInFlightRef.current = false;
      setIsScoring(false);
    }
  }, [customTitle, interviewToken, lang, question.id, role.id, transcript]);

  useEffect(() => {
    if (retrySeconds === null) return;
    if (retrySeconds <= 0) {
      setRetrySeconds(null);
      void submitForScoring();
      return;
    }
    const id = window.setTimeout(() => setRetrySeconds((seconds) =>
      seconds === null ? null : seconds - 1,
    ), 1000);
    return () => window.clearTimeout(id);
  }, [retrySeconds, submitForScoring]);

  const retryQuestion = useCallback(() => {
    setAttemptCount((c) => c + 1);
    setFeedback(null);
    setScoringError(null);
    setInterrupted(false);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setTranscript('');
    setInterim('');
    startPrep();
  }, [startPrep]);

  const completeCurrentAnswer = useCallback((answerFeedback: AnswerFeedback) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const completed: CompletedAnswer = {
      questionId: question.id,
      questionText,
      transcript,
      feedback: answerFeedback,
    };
    const nextAnswers = [...answers, completed];
    setAnswers(nextAnswers);
    // Release this answer's recording now, including on the final question.
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    setFeedback(null);
    setScoringError(null);
    setInterrupted(false);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setTranscript('');
    setInterim('');
    setAttemptCount(1);

    if (isLast) {
      setStage('done');
    } else {
      setIndex((i) => i + 1);
      setSecondsLeft(role.questions[index + 1].prepSeconds);
      setStage('prep');
    }
    window.setTimeout(() => {
      advancingRef.current = false;
    }, 0);
  }, [answers, index, isLast, playbackUrl, question.id, questionText, role.questions, transcript]);

  const advance = useCallback(() => {
    if (feedback) completeCurrentAnswer(feedback);
  }, [completeCurrentAnswer, feedback]);

  const continueWithoutFeedback = useCallback(() => {
    setRetrySeconds(null);
    setScoringError(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    completeCurrentAnswer({
      questionId: question.id,
      score: 0,
      status: 'unscored',
      headline: t('feedbackSkippedTitle'),
      competencies: [],
      strengths: [],
      improvements: [t('feedbackSkippedBody')],
      coachTip: '',
      source: 'none',
    });
  }, [completeCurrentAnswer, question.id, t]);

  // A mock interview keeps moving. Scoring still happens after each answer so
  // the existing no-false-score and retry contracts stay intact, but the
  // candidate sees all feedback together only after the final question.
  useEffect(() => {
    if (mode === 'mock' && stage === 'feedback' && feedback) {
      completeCurrentAnswer(feedback);
    }
  }, [completeCurrentAnswer, feedback, mode, stage]);

  // Persist the finished interview once, when results are shown.
  useEffect(() => {
    if (stage !== 'done' || savedRef.current || answers.length === 0) return;
    savedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const attempt: Attempt = {
      id: `${role.id}-${Date.now()}`,
      roleId: role.id,
      roleTitle: role.title,
      startedAt: new Date().toISOString(),
      overallScore: overallFromAnswers(answers),
      answers,
    };
    saveAttempt(attempt);
    setSavedAttempt(attempt);
    track('interview_completed', {
      role_id: role.id,
      lang,
      overall_score: attempt.overallScore ?? undefined,
      questions_answered: attempt.answers.length,
      scoring_source: attempt.answers[0]?.feedback.source ?? 'unknown',
    });
  }, [answers, role.id, role.title, stage]);

  const beginWithVoice = useCallback(async () => {
    track('interview_started', { role_id: role.id, lang, input_mode: 'voice' });
    setVoiceDeclined(false);
    const cameraReady = await enableCamera();
    if (!cameraReady) {
      setDeviceFallback(true);
      await switchToTyping();
    }
    startPrep();
  }, [enableCamera, lang, role.id, startPrep, switchToTyping]);

  const beginWithTyping = useCallback(async () => {
    track('interview_started', { role_id: role.id, lang, input_mode: 'typing' });
    await switchToTyping();
    startPrep();
  }, [lang, role.id, startPrep, switchToTyping]);

  const wordCount = `${transcript} ${interim}`.trim().split(/\s+/).filter(Boolean).length;
  // Speech recognition is unreliable inside iOS in-app browsers: it reports as
  // supported, starts without error, and simply never returns words. If a
  // candidate has been speaking for a while with nothing transcribed, stop
  // letting them wonder and offer typing.
  const elapsed = question.answerSeconds - secondsLeft;
  const silentTranscript = stage === 'record' && elapsed > 12 && wordCount === 0;
  const coachingMessage = `Hi Kim, I completed interview practice for ${role.title}. I would like to ask about private coaching.`;
  const coachingBase = process.env.NEXT_PUBLIC_COACHING_WHATSAPP_URL;
  const coachingHref = coachingBase
    ? `${coachingBase}${coachingBase.includes('?') ? '&' : '?'}text=${encodeURIComponent(coachingMessage)}`
    : 'https://inspireambitions.com/contact/';

  return (
    <div className="shell shell-narrow">
      <TopBar showProgressLink={false} />

      <div className="rail" aria-hidden="true">
        {role.questions.map((q, i) => (
          <span
            key={q.id}
            className={`rail-step ${i < index ? 'done' : i === index ? 'current' : ''}`}
          />
        ))}
      </div>
      <p className="tiny" style={{ marginBottom: '1.4rem' }}>
        {lang === 'ar' ? role.titleAr : role.title} · {t('question')} {index + 1} {t('of')}{' '}
        {role.questions.length}
      </p>

      {/* ---------- device check ---------- */}
      {stage === 'check' && (
        <div className="stack">
          <div>
            <p className="eyebrow">{t('beforeStart')}</p>
            <h1 style={{ fontSize: '1.75rem' }}>
              {lang === 'ar' ? role.titleAr : role.title}
            </h1>
            {role.id === 'custom' && (
              <span className={`chip ${tailored ? 'chip-gold' : ''}`} style={{ marginTop: '0.5rem' }}>
                {tailored ? t('tailoredBadge') : t('genericBadge')}
              </span>
            )}
            {fellBack && !tailored && (
              <p className="notice notice-warn tiny" style={{ marginTop: '0.5rem' }}>
                {t('genericWhy')}
              </p>
            )}
          </div>

          <div className="card stack">
            <div>
              <p className="eyebrow">{t('chooseAnswerMode')}</p>
              <div className="privacy-facts">
                <span className="privacy-fact">{t('privacyFactVideo')}</span>
                <span className="privacy-fact">{t('privacyFactText')}</span>
                <span className="privacy-fact">{t('privacyFactHistory')}</span>
              </div>
            </div>

            <div className="mode-grid">
              {speechOk && (
                <button
                  type="button"
                  className="mode-choice"
                  disabled={requestingCamera}
                  onClick={() => void beginWithVoice()}
                >
                  <strong>{requestingCamera ? t('cameraStarting') : t('voiceModeTitle')}</strong>
                  <span className="tiny">{t('voiceModeBody')}</span>
                  <span className="tiny">
                    {onDeviceSpeech ? t('speechOnDevice') : t('speechCloudShort')}
                  </span>
                </button>
              )}
              <button type="button" className="mode-choice" onClick={() => void beginWithTyping()}>
                <strong>{t('typingModeCta')}</strong>
                <span className="tiny">{t('typingModeBody')}</span>
              </button>
            </div>

            <label className="experience-toggle">
              <input
                type="checkbox"
                checked={limitedExperience}
                onChange={(event) => setLimitedExperience(event.target.checked)}
              />
              <span>
                <strong>{t('limitedExperienceLabel')}</strong>
                <span className="tiny" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {t('limitedExperienceBody')}
                </span>
              </span>
            </label>

            <details className="privacy-details">
              <summary>{t('privacyDetails')}</summary>
              <p className="tiny">{t('beforeStartBody')}</p>
            </details>

            <p className="notice tiny">{t('scoringPolicy')}</p>

            <div className="row-between">
              <p className="tiny">
                {role.questions.length} {t('expect1')} · ~
                {estimateMinutes(role) + (mode === 'mock' ? role.questions.length : 0)} {t('expectTime')}
              </p>
              <Link href="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                {t('back')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ---------- preparation ---------- */}
      {stage === 'prep' && (
        <div className="stack">
          {deviceFallback && (
            <div className="notice notice-warn" role="status">
              <strong>{t('deviceFallbackTitle')}</strong>
              <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('deviceFallbackBody')}</p>
            </div>
          )}
          <div className="card stack">
            <p className="eyebrow">
              {t('question')} {index + 1}
            </p>
            <h2 style={{ fontSize: '1.35rem' }}>{questionText}</h2>
            <div className="coach-tip">
              <strong>{t('tip')}</strong>
              {hintText}
            </div>
            {limitedExperience && (
              <div className="notice tiny">
                <strong>{t('limitedExperienceLabel')}</strong>
                <p style={{ marginTop: '0.35rem' }}>{t('limitedExperienceTip')}</p>
              </div>
            )}
          </div>

          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <p className="eyebrow" style={{ marginBottom: 0 }}>
              {t('prepTime')}
            </p>
            <div className={`timer-big ${secondsLeft <= 5 ? 'low' : ''}`}>
              {formatClock(secondsLeft)}
            </div>
            <p className="muted">{useVoice ? t('prepBody') : t('prepBodyType')}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={beginRecording}>
                {t('startAnswer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- recording ---------- */}
      {stage === 'record' && (
        <div className="stack">
          {deviceFallback && !useVoice && (
            <div className="notice notice-warn" role="status">
              <strong>{t('deviceFallbackTitle')}</strong>
              <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('deviceFallbackBody')}</p>
            </div>
          )}
          <div className="card stack">
            <p className="eyebrow">
              {t('question')} {index + 1}
            </p>
            <h2 style={{ fontSize: '1.25rem' }}>{questionText}</h2>
          </div>

          <div className="card stack">
            {useVoice && (
              <>
                {cameraState === 'granted' ? (
                  <div className="video-frame">
                    <video ref={videoRef} muted playsInline />
                    <span className="video-badge">
                      <span className="rec-dot" aria-hidden="true" />
                      {t('recording')} · {formatClock(secondsLeft)}
                    </span>
                  </div>
                ) : (
                  <div className="notice notice-warn tiny">
                    {t('voiceWithoutCamera')}
                  </div>
                )}

                <div className="meter" aria-hidden="true">
                  <div
                    className={`meter-fill ${secondsLeft <= 15 ? 'crit' : 'gold'}`}
                    style={{ width: `${(secondsLeft / question.answerSeconds) * 100}%` }}
                  />
                </div>

                {/* Proof the microphone is live. Reassurance only — never recorded or scored. */}
                <div className="mic-row">
                  <span className="mic-label">{t('micLive')}</span>
                  <span className="mic-bars" aria-hidden="true">
                    {[0.08, 0.2, 0.34, 0.5, 0.68].map((threshold) => (
                      <span key={threshold} className={`mic-bar ${micLevel > threshold ? 'on' : ''}`} />
                    ))}
                  </span>
                  <span className="tiny">{micLevel > 0.08 ? t('micHearing') : t('micQuiet')}</span>
                </div>
              </>
            )}

            {useVoice && silentTranscript && (
              <div className="notice notice-warn tiny">
                {t('speechNotWorking')}
                <div className="row" style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      void switchToTyping();
                    }}
                  >
                    {t('speechTypeInstead')}
                  </button>
                </div>
              </div>
            )}

            <div>
              <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
                {t('yourAnswer')}
              </p>
              {useVoice ? (
                <div className="transcript" aria-live="polite">
                  {transcript}
                  {interim && <span className="transcript-interim"> {interim}</span>}
                  {!transcript && !interim && (
                    <span className="transcript-interim">{t('typeHint')}</span>
                  )}
                </div>
              ) : (
                <textarea
                  className="answer-box"
                  placeholder={t('typeAnswer')}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              )}
              <p className="tiny" style={{ marginTop: '0.4rem' }}>
                {wordCount} {t('words')}
              </p>
            </div>

            <div className="flow-actions">
              <button
                type="button"
                className="btn btn-record"
                onClick={finishAnswer}
                disabled={isFinalizing}
              >
                {useVoice ? t('stopAndScore') : t('reviewTypedAnswer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- review before scoring ---------- */}
      {stage === 'review' && (
        <div className="stack">
          <div className="card stack">
            <p className="eyebrow">{t('yourAnswer')}</p>
            <h2 style={{ fontSize: '1.2rem' }}>{questionText}</h2>

            {playbackUrl && (
              <div className="stack-sm">
                <span className="rate-label">{t('watchBack')}</span>
                <video
                  ref={playbackRef}
                  className="playback"
                  src={playbackUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
                <p className="tiny">{t('watchBackHint')}</p>
              </div>
            )}

            {interrupted && (
              <div className="notice notice-warn" role="status">
                <strong>{t('interruptionTitle')}</strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('interruptionBody')}</p>
              </div>
            )}

            <textarea
              className="answer-box"
              placeholder={t('typeAnswer')}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setScoringError(null);
                setRetrySeconds(null);
                scoringSessionRef.current = null;
                automaticRetriesRef.current = 0;
              }}
            />
            <p className="tiny">{t('typeHint')}</p>
            {scoringError && (
              <div className="notice notice-warn" role="status" aria-live="polite">
                <strong>
                  {scoringError.answerTooLong
                    ? t('scoreAnswerTooLongTitle')
                    : t('scoreUnavailableTitle')}
                </strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>
                  {scoringError.answerTooLong
                    ? t('scoreAnswerTooLongBody')
                    : scoringError.creditsExhausted
                    ? t('scoreCreditsBody')
                    : t('scoreUnavailableBody')}
                </p>
                {retrySeconds !== null && (
                  <p className="tiny" style={{ marginTop: '0.35rem' }}>
                    {t('scoreRetryingIn')} {retrySeconds} {t('secondsShort')}.
                  </p>
                )}
              </div>
            )}
            {transcript.trim().length === 0 && (
              <p className="tiny" role="status">{t('answerRequired')}</p>
            )}
            <div className="row flow-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitForScoring}
                disabled={isScoring || transcript.trim().length === 0}
              >
              {isScoring
                  ? t('scoring')
                  : scoringError
                    ? t('retryNow')
                    : mode === 'mock'
                      ? t('saveAndContinue')
                      : t('getFeedback')}
              </button>
              <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
                {t('tryAgain')}
              </button>
              {scoringError && (
                <button type="button" className="btn btn-ghost" onClick={continueWithoutFeedback}>
                  {t('continueWithoutFeedback')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- feedback ---------- */}
      {mode === 'guided' && stage === 'feedback' && feedback && (
        <div className="stack">
          <FeedbackCard feedback={feedback} attempt={attemptCount} />
          <div className="row flow-actions">
            <button type="button" className="btn btn-primary" onClick={advance}>
              {isLast ? t('finishInterview') : t('nextQuestion')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
              {t('tryAgain')}
            </button>
          </div>
        </div>
      )}

      {/* ---------- results ---------- */}
      {stage === 'done' && (
        <div className="stack-lg">
          <div className="card stack">
            <p className="eyebrow">{t('interviewComplete')}</p>
            {overallFromAnswers(answers) !== null ? (
              <div className="score-head">
                <ScoreRing value={overallFromAnswers(answers) ?? 0} />
                <div>
                  <h2 style={{ fontSize: '1.4rem' }}>
                    {t('overallScore')}: {overallFromAnswers(answers)}/100
                  </h2>
                  <p className="muted" style={{ marginTop: '0.3rem' }}>
                    {t('resultsBody')}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: '1.3rem' }}>{t('noScoreTitle')}</h2>
                <p className="muted" style={{ marginTop: '0.3rem' }}>
                  {t('noScoreBody')}
                </p>
              </div>
            )}
            <p className="report-meta">
              {role.title} · {new Date().toLocaleDateString()}
            </p>
            <p className="tiny">{t('savedLocally')}</p>

            <div className="row no-print">
              <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
                {t('saveReport')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      buildReportText(role.title, overallFromAnswers(answers), answers, {
                        report: t('reportTitle'),
                        score: t('overallScore'),
                        question: t('question'),
                        yourAnswer: t('yourAnswer'),
                        worked: t('whatWorked'),
                        improve: t('whatToImprove'),
                      }),
                    );
                    setReportCopied(true);
                  } catch {
                    /* clipboard blocked — printing still works */
                  }
                }}
              >
                {reportCopied ? t('rateCopied') : t('copyReport')}
              </button>
            </div>
            <p className="tiny no-print">{t('saveReportHint')}</p>
          </div>

          {answers.some((answer) => answer.feedback.status === 'scored') && (() => {
            const scored = answers.filter((answer) => answer.feedback.status === 'scored');
            const strongestAnswer = scored.reduce((best, answer) =>
              answer.feedback.score > best.feedback.score ? answer : best,
            );
            const focusAnswer = scored.reduce((lowest, answer) =>
              answer.feedback.score < lowest.feedback.score ? answer : lowest,
            );
            return (
              <div className="card stack interview-summary">
                <div>
                  <p className="eyebrow">{t('summaryEyebrow')}</p>
                  <h2 style={{ fontSize: '1.35rem' }}>{t('summaryTitle')}</h2>
                </div>
                <div className="summary-grid">
                  <div>
                    <span className="rate-label">{t('strongest')}</span>
                    <p>{strongestAnswer.questionText}</p>
                  </div>
                  <div>
                    <span className="rate-label">{t('weakest')}</span>
                    <p>{focusAnswer.questionText}</p>
                  </div>
                </div>
                {focusAnswer.feedback.coachTip && (
                  <div className="coach-tip">
                    <strong>{t('nextAction')}</strong>
                    {focusAnswer.feedback.coachTip}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="card stack coaching-card no-print">
            <div>
              <p className="eyebrow">{t('coachingEyebrow')}</p>
              <h2 style={{ fontSize: '1.35rem' }}>{t('coachingTitle')}</h2>
              <p className="muted" style={{ marginTop: '0.45rem' }}>{t('coachingBody')}</p>
            </div>
            <p className="tiny">{t('coachingTrust')}</p>
            <a
              className="btn btn-quiet"
              href={coachingHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('coachingCta')}
            </a>
            <p className="tiny">{t('coachingPrivacy')}</p>
          </div>

          {savedAttempt && (
            <div className="no-print">
              <RatingCard attempt={savedAttempt} />
            </div>
          )}

          {answers.map((answer, i) => (
            <div key={`${answer.questionId}-${i}`} className="stack-sm">
              <p className="eyebrow" style={{ marginBottom: 0 }}>
                {t('question')} {i + 1}
              </p>
              <h3 style={{ fontSize: '1.05rem' }}>{answer.questionText}</h3>
              {answer.transcript && (
                <div className="answer-recap">
                  <span className="rate-label">{t('yourAnswer')}</span>
                  <p className="muted" style={{ marginTop: '0.25rem' }}>
                    {answer.transcript}
                  </p>
                </div>
              )}
              <FeedbackCard feedback={answer.feedback} />
            </div>
          ))}

          <div className="row no-print">
            <Link
              href={`/practice/${role.id}`}
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              {t('practiceAgain')}
            </Link>
            <Link href="/" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
              {t('tryAnotherRole')}
            </Link>
            <Link href="/progress" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              {t('seeProgress')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
