'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Question, Role } from '@/lib/roles';
import type { AnswerFeedback, Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import { saveAttempt } from '@/lib/storage';
import {
  discardInterviewDraft,
  loadInterviewDraft,
  saveInterviewDraft,
  type InterviewSessionDraft,
} from '@/lib/session-draft';
import { track, trackTiming } from '@/lib/analytics';
import {
  FEEDBACK_STREAM_CONTENT_TYPE,
  FEEDBACK_STREAM_TIMEOUT_MS,
  decodeFeedbackStreamChunk,
  type FeedbackStreamEvent,
  type PartialFeedback,
} from '@/lib/feedback-stream';
import { rubricForQuestion } from '@/lib/question-rubric';
import {
  combineProbeTranscript,
  nextStarProbe,
  probeQuestion,
  type StarElement,
} from '@/lib/star-probe';
import type { AnswerRecorder, LevelMeter } from '@/lib/media';
import { isAudioCaptureSupported, startAudioCapture, type AudioCapture } from '@/lib/audio-capture';
import type { InterviewMode } from '@/lib/interview-plan-policy';
import {
  INITIAL_DEVICE_CAPABILITIES,
  defaultAnswerMethod,
  detectDeviceCapabilities,
  type DeviceCapabilities,
  videoCaptureSupported,
  videoModeSupported,
} from '@/lib/device-capabilities';
import type { SpeechSession } from '@/lib/speech';
import {
  RECORDING_LIMIT_SECONDS,
  initialAnswerMode,
  readStarGuide,
  readStoredAnswerMode,
  recordingLimitSeconds,
  storeAnswerMode,
  storeStarGuide,
  type AnswerMode,
} from '@/lib/flow/answer-mode';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { FeedbackCard, StreamingFeedbackCard } from './FeedbackCard';
import { AnswerModeSelector } from './flow/AnswerModeSelector';
import { StarGuideLines, StarGuideToggle } from './flow/StarGuide';
import { KeepFeedbackSlot, QuestionTagsSlot, ReadinessSlot } from './flow/Slots';
import { recordSessionEnd, updateConsentState } from '@/lib/practice-plan/ask-policy';

/*
 * Screens that most visits never reach, or reach only after the candidate has
 * answered, are loaded when first rendered rather than shipped with the page.
 */
const ScoreRing = dynamic(() => import('./ScoreRing').then((m) => m.ScoreRing));
const RatingCard = dynamic(() => import('./RatingCard').then((m) => m.RatingCard));
const CoachingCard = dynamic(() => import('./CoachingCard').then((m) => m.CoachingCard));
const EmailSignIn = dynamic(() => import('./EmailSignIn').then((m) => m.EmailSignIn));
const AnswerComparison = dynamic(() => import('./flow/AnswerComparison').then((m) => m.AnswerComparison));
const ModelAnswer = dynamic(() => import('./flow/ModelAnswer').then((m) => m.ModelAnswer));
const ReportShareActions = dynamic(() => import('./ReportShareActions').then((m) => m.ReportShareActions));

/**
 * Microphone, camera and dictation code is only needed once the candidate
 * speaks, and never on browsers without speech recognition. Both modules are
 * fetched together the first time either is needed and then reused.
 */
type CaptureLibs = {
  speech: typeof import('@/lib/speech');
  media: typeof import('@/lib/media');
};

let captureLibsPromise: Promise<CaptureLibs> | null = null;

function loadCaptureLibs(): Promise<CaptureLibs> {
  captureLibsPromise ??= Promise.all([import('@/lib/speech'), import('@/lib/media')])
    .then(([speech, media]) => ({ speech, media }))
    .catch((error: unknown) => {
      captureLibsPromise = null;
      throw error;
    });
  return captureLibsPromise;
}

type Stage = 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';

type CompletedAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

type PreviousTry = {
  transcript: string;
  feedback: AnswerFeedback;
};

type ScoringError = {
  creditsExhausted: boolean;
  answerTooLong: boolean;
  /** The 12 second budget ran out. The candidate retries by hand. */
  timedOut: boolean;
};

class ScoringRequestError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly retryAfterSeconds: number,
    readonly creditsExhausted: boolean,
    readonly answerTooLong: boolean,
    readonly timedOut = false,
  ) {
    super('Scoring request failed');
  }
}

/** Streaming is on unless the deployment turns it off to capture a baseline. */
const FEEDBACK_STREAMING_ENABLED = process.env.NEXT_PUBLIC_FEEDBACK_STREAMING !== 'off';

/** The browser waits a little longer than the server so the server speaks first. */
const CLIENT_SCORING_TIMEOUT_MS = FEEDBACK_STREAM_TIMEOUT_MS + 3_000;

/** Server transcription budget is 20 s; the upload itself gets a little more. */
const CLIENT_TRANSCRIPTION_TIMEOUT_MS = 25_000;

type ScoreResponsePayload = { feedback: AnswerFeedback; locked?: boolean };

function scoringErrorFromBody(
  status: number,
  body: { error?: { code?: string; retryable?: boolean; retryAfterSeconds?: number } } | null,
  headerRetryAfter: string | null,
): ScoringRequestError {
  const headerDelay = Number(headerRetryAfter);
  const requestedDelay = body?.error?.retryAfterSeconds ?? headerDelay;
  const delay = Number.isFinite(requestedDelay)
    ? Math.max(2, Math.min(120, Math.ceil(requestedDelay)))
    : 20;
  const timedOut = body?.error?.code === 'scoring_timeout' || status === 504;
  return new ScoringRequestError(
    body?.error?.retryable ?? (status === 409 || status === 429 || status >= 500),
    delay,
    body?.error?.code === 'credits_exhausted' || status === 402,
    body?.error?.code === 'answer_too_long' || status === 413,
    timedOut,
  );
}

/**
 * Reads the NDJSON feedback stream. Partial blocks are handed to the caller as
 * they complete; the promise settles with the final payload or throws the same
 * typed error the JSON path would have produced.
 */
async function readFeedbackStream(
  response: Response,
  onPartial: (partial: PartialFeedback) => void,
): Promise<ScoreResponsePayload> {
  const reader = response.body?.getReader();
  if (!reader) throw new ScoringRequestError(true, 20, false, false);
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ScoreResponsePayload | null = null;
  let failure: ScoringRequestError | null = null;
  const handle = (event: FeedbackStreamEvent) => {
    if (event.type === 'partial') onPartial(event.partial);
    else if (event.type === 'final') result = { feedback: event.feedback, locked: event.locked };
    else failure = scoringErrorFromBody(event.status, { error: event.error }, null);
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const decoded = decodeFeedbackStreamChunk(buffer);
    buffer = decoded.remainder;
    decoded.events.forEach(handle);
    if (result || failure) break;
  }
  if (!result && !failure && buffer.trim()) {
    decodeFeedbackStreamChunk(`${buffer}\n`).events.forEach(handle);
  }
  if (failure) throw failure;
  if (!result) throw new ScoringRequestError(true, 20, false, false);
  return result;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function InterviewFlow({
  role,
  customTitle,
  tailored = false,
  interviewToken,
  fellBack = false,
  mockQuestions,
  initialLanguage,
  initialAnswerMode: requestedAnswerMode,
  ignoreLocalDraft = false,
  focusQuestionId,
  focusedQuestion,
  proof,
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
  /** Eight-question set for Full Mock mode; absent when the role cannot support it. */
  mockQuestions?: Question[];
  /** Language carried from a report retry. It stays fixed for this interview. */
  initialLanguage?: 'en' | 'ar';
  /** A plan link can open straight into the way the candidate chose to answer. */
  initialAnswerMode?: AnswerMode;
  /** Start a new interview from a saved template without reopening another local draft. */
  ignoreLocalDraft?: boolean;
  /** Exact trusted question requested from a report retry. */
  focusQuestionId?: string;
  /** Question resolved before catalogue rotation or custom-role subsetting. */
  focusedQuestion?: Question;
  /** Live work sample for a hiring team. Not practice. */
  proof?: { workplace: string; recruiterName?: string };
}) {
  const { lang, setLang, t } = useLang();

  const [stage, setStage] = useState<Stage>('check');
  const [index, setIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);

  /**
   * 'idle' means we have not asked yet: which must never be reported to the
   * candidate as "blocked". Only a real refusal is 'denied'.
   */
  const [cameraState, setCameraState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [speechOk, setSpeechOk] = useState(INITIAL_DEVICE_CAPABILITIES.speechSupported);
  /**
   * Browsers without the Web Speech API (Firefox, some in-app browsers) can
   * still speak their answer: the audio alone is recorded and written up on
   * the server when they finish. Turned off for the session if that fails.
   */
  const [audioFallbackAvailable, setAudioFallbackAvailable] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionFailed, setTranscriptionFailed] = useState(false);
  const [playbackIsVideo, setPlaybackIsVideo] = useState(false);
  const [onDeviceSpeech, setOnDeviceSpeech] = useState(false);
  const [answerMethod, setAnswerMethod] = useState<AnswerMode>(() =>
    defaultAnswerMethod(INITIAL_DEVICE_CAPABILITIES),
  );
  const [deviceCaps, setDeviceCaps] = useState<DeviceCapabilities>(INITIAL_DEVICE_CAPABILITIES);
  /** True once the candidate has confirmed a way to answer this sitting. */
  const [modeChosen, setModeChosen] = useState(false);
  /** The "Change mode" panel on a later question. Never opens by itself. */
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [starGuideOn, setStarGuideOn] = useState(false);
  /** Transcript check starts read only; Edit turns it into the textarea. */
  const [editingTranscript, setEditingTranscript] = useState(false);
  /** A second attempt at the same question, answered under the first one. */
  const [retrying, setRetrying] = useState(false);
  /** Seconds a spoken or filmed answer may run this question. */
  const [recordingLimit, setRecordingLimit] = useState(RECORDING_LIMIT_SECONDS);
  const firstAnswerTrackedRef = useRef(false);
  /**
   * Guided: revealed questions, feedback after each answer, retakes.
   * Mock: eight questions one at a time, no interruptions, report at the end.
   */
  const [mode, setMode] = useState<InterviewMode>(proof ? 'screening' : 'guided');
  const [recordingLive, setRecordingLive] = useState(false);
  const lastHeardRef = useRef(0);
  const [meterUnavailable, setMeterUnavailable] = useState(false);
  const [streamLost, setStreamLost] = useState(false);
  const [deviceFallback, setDeviceFallback] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [localDraftSaveFailed, setLocalDraftSaveFailed] = useState(false);
  const [proofStartFailed, setProofStartFailed] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [extraTimeEnabled, setExtraTimeEnabled] = useState(false);
  const [timerAnnouncement, setTimerAnnouncement] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false);
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [streamingFeedback, setStreamingFeedback] = useState<PartialFeedback | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [scoringError, setScoringError] = useState<ScoringError | null>(null);
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  const [answers, setAnswers] = useState<CompletedAnswer[]>([]);
  const [previousTry, setPreviousTry] = useState<PreviousTry | null>(null);
  const [serverAttemptId, setServerAttemptId] = useState<string | null>(null);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [reportGateRequired, setReportGateRequired] = useState(false);
  const [resumedQuestions, setResumedQuestions] = useState<Question[] | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [showContinueSignIn, setShowContinueSignIn] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<InterviewSessionDraft | null>(null);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  const [sessionLanguage, setSessionLanguage] = useState<'en' | 'ar' | null>(initialLanguage ?? null);
  const [starProbe, setStarProbe] = useState<{
    element: StarElement;
    question: string;
    baseTranscript: string;
  } | null>(null);
  const [starProbeDeclined, setStarProbeDeclined] = useState(false);
  const [starProbeUsed, setStarProbeUsed] = useState<Record<number, boolean>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dictationRef = useRef<SpeechSession | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<AnswerRecorder | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const captureLibsRef = useRef<CaptureLibs | null>(null);
  const playbackRef = useRef<HTMLVideoElement | null>(null);
  const savedRef = useRef(false);
  const scoringInFlightRef = useRef(false);
  const finalizingRef = useRef(false);
  const advancingRef = useRef(false);
  const scoringSessionRef = useRef<string | null>(null);
  const automaticRetriesRef = useRef(0);
  const [savedAttempt, setSavedAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    const capabilities = detectDeviceCapabilities();
    const audioFallback = !capabilities.speechSupported && isAudioCaptureSupported();
    setDeviceCaps(capabilities);
    setSpeechOk(capabilities.speechSupported);
    setAudioFallbackAvailable(audioFallback);
    // The highlighted card: what this device chose last time, if it still can,
    // otherwise Type on a phone and Speak on a desktop. Nothing is requested yet.
    setAnswerMethod(initialAnswerMode({
      stored: requestedAnswerMode ?? readStoredAnswerMode(window.localStorage),
      device: capabilities,
      availability: {
        speak: capabilities.speechSupported || audioFallback,
        video: videoModeSupported(capabilities) || (audioFallback && videoCaptureSupported(capabilities)),
      },
    }));
    setStarGuideOn(readStarGuide(window.localStorage));
  }, []);

  const voiceAvailable = speechOk || audioFallbackAvailable;
  const selectedAnswerMethod: AnswerMode = voiceAvailable ? answerMethod : 'type';
  const useVoice = selectedAnswerMethod !== 'type';
  /** Speaking without live captions: audio only is written up after the answer. */
  const usingAudioFallback = useVoice && !speechOk;
  const videoSelectable = videoModeSupported(deviceCaps)
    || (audioFallbackAvailable && videoCaptureSupported(deviceCaps));
  const useVideo = selectedAnswerMethod === 'video' && videoSelectable;
  const modeAvailability = { speak: voiceAvailable, video: videoSelectable };
  /** Employer sittings get no coaching scaffolds. */
  const practiceSitting = mode !== 'screening';
  const requestedQuestion = focusedQuestion ?? (focusQuestionId
    ? [...role.questions, ...(role.bank ?? [])].find((item) => item.id === focusQuestionId)
    : undefined);
  const activeQuestions = resumedQuestions ?? (
    mode === 'mock' && mockQuestions && mockQuestions.length > 0
      ? mockQuestions
      : mode === 'screening'
        ? role.questions
        : requestedQuestion
          ? [requestedQuestion]
          : role.questions.slice(0, 1)
  );
  const question = activeQuestions[index];
  // Latched, not instantaneous: ordinary pauses between sentences must not
  // flip the caption to "we cannot hear you" four times a second.
  const heardRecently = micLevel > 0.08 || Date.now() - lastHeardRef.current < 2500;
  const isLast = index === activeQuestions.length - 1;
  const interviewLanguage = sessionLanguage ?? lang;
  const questionText = interviewLanguage === 'ar' ? question.textAr : question.text;
  const promptText = starProbe?.question ?? questionText;
  const scoringTranscript = starProbe
    ? combineProbeTranscript(starProbe.baseTranscript, starProbe.question, transcript, t('starProbeLabel'))
    : transcript;
  const starFollowUp = feedback
    && mode === 'guided'
    && !starProbe
    && !starProbeDeclined
    && !starProbeUsed[index]
    ? nextStarProbe(feedback)
    : null;
  const hintText = interviewLanguage === 'ar' ? question.hintAr : question.hint;
  const questionRubric = rubricForQuestion(role, question);
  const reportRoleTitle = customTitle || (interviewLanguage === 'ar' ? role.titleAr : role.title);

  const persistProgress = useCallback(async (payload: {
    questionIndex: number;
    transcript: string;
    currentQuestion: number;
    status: 'in_progress' | 'completed';
  }) => {
    if (!serverAttemptId) return false;
    setSyncState('syncing');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/interviews/${serverAttemptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          setSyncState('saved');
          return true;
        }
      } catch {
        // The retry below covers brief network and platform interruptions.
      }
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
    }
    setSyncState('error');
    return false;
  }, [serverAttemptId]);

  useEffect(() => {
    setStarProbeDeclined(false);
    setStarProbe(null);
  }, [index]);

  // Fetch the results-screen code while the candidate reads their first
  // feedback, so the final screen is not waiting on the network.
  useEffect(() => {
    if (stage !== 'feedback') return;
    void Promise.all([
      import('./ScoreRing'),
      import('./RatingCard'),
      import('./CoachingCard'),
      import('./EmailSignIn'),
      import('./ReportShareActions'),
    ]).catch(() => {});
  }, [stage]);

  const restoreDraft = useCallback((draft: InterviewSessionDraft) => {
    const restoredQuestions = draft.questionSnapshot.length ? draft.questionSnapshot : activeQuestions;
    const safeIndex = Math.max(0, Math.min(restoredQuestions.length - 1, draft.questionIndex));
    setSessionLanguage(draft.language);
    setLang(draft.language);
    setServerAttemptId(draft.serverAttemptId);
    setReportGateRequired(draft.reportGateRequired);
    setResumedQuestions(restoredQuestions);
    setIndex(safeIndex);
    setMode(draft.mode);
    setAnswerMethod(draft.answerMethod);
    setModeChosen(true);
    setTranscript(draft.transcript);
    setTranscriptConfirmed(draft.transcriptConfirmed);
    setFeedback(draft.feedback);
    setAnswers(draft.answers);
    setPreviousTry(draft.previousTry);
    setAttemptCount(draft.attemptCount);
    setReportUnlocked(draft.reportUnlocked);
    setSecondsLeft(restoredQuestions[safeIndex]?.prepSeconds ?? 30);
    setPendingDraft(null);
    setConfirmDiscardDraft(false);
    setStage(draft.stage);
  }, [activeQuestions, setLang]);

  // An account resume link is already an explicit choice. A browser-local
  // draft is not: show Resume and Discard instead of silently moving screens.
  useEffect(() => {
    if (proof) {
      setReportGateRequired(false);
      setReportUnlocked(true);
      return;
    }
    let cancelled = false;
    const resumeId = new URLSearchParams(window.location.search).get('resume');
    if (resumeId) {
      fetch(`/api/interviews/${encodeURIComponent(resumeId)}/report`, { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((report) => {
          if (!report || cancelled) return;
          const restoredQuestions = Array.isArray(report.questionSnapshot) && report.questionSnapshot.length
            ? report.questionSnapshot
            : activeQuestions;
          const currentTranscript = (report.answers ?? []).find(
            (answer: { questionIndex: number }) => answer.questionIndex === report.currentQuestion,
          )?.transcript ?? '';
          restoreDraft({
            version: 2,
            roleId: role.id,
            ...(customTitle ? { customTitle } : {}),
            tailored,
            fellBack,
            language: report.language === 'ar' ? 'ar' : 'en',
            stage: currentTranscript.trim() ? 'review' : 'prep',
            questionIndex: report.currentQuestion ?? 0,
            mode: report.mode === 'mock' ? 'mock' : 'guided',
            answerMethod: 'type',
            transcript: currentTranscript,
            transcriptConfirmed: false,
            feedback: null,
            answers: (report.answers ?? [])
              .filter((answer: { feedback?: AnswerFeedback | null }) => answer.feedback)
              .map((answer: { questionId: string; questionText: string; transcript: string; feedback: AnswerFeedback }) => ({
                questionId: answer.questionId,
                questionText: answer.questionText,
                transcript: answer.transcript,
                feedback: answer.feedback,
              })),
            previousTry: null,
            attemptCount: 1,
            serverAttemptId: report.id,
            reportGateRequired: true,
            reportUnlocked: Boolean(report.unlocked),
            questionSnapshot: restoredQuestions,
            updatedAt: report.updatedAt ?? new Date().toISOString(),
          });
        })
        .catch(() => {});
    } else if (!ignoreLocalDraft) {
      const draft = loadInterviewDraft(window.localStorage, {
        roleId: role.id,
        customTitle,
        fallbackLanguage: lang,
        fallbackQuestions: activeQuestions,
      });
      if (!cancelled) setPendingDraft(draft);
    } else if (!cancelled) {
      setPendingDraft(null);
    }
    return () => { cancelled = true; };
    // Restore exactly once for this role and custom interview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.id, customTitle]);

  useEffect(() => {
    if (stage === 'check') return;
    if (proof) return;
    if (stage === 'done') {
      discardInterviewDraft(window.localStorage, role.id, customTitle);
      setLocalDraftSaveFailed(false);
      return;
    }
    const saved = saveInterviewDraft(window.localStorage, {
      roleId: role.id,
      customTitle,
      interviewToken,
      tailored,
      fellBack,
      language: interviewLanguage,
      stage,
      questionIndex: index,
      mode,
      answerMethod: selectedAnswerMethod,
      transcript,
      transcriptConfirmed,
      feedback,
      answers,
      previousTry,
      attemptCount,
      serverAttemptId,
      reportGateRequired,
      reportUnlocked,
      questionSnapshot: activeQuestions,
    });
    setLocalDraftSaveFailed(!saved);
  }, [activeQuestions, answers, attemptCount, customTitle, feedback, fellBack, index, interviewLanguage,
    interviewToken, mode, previousTry, reportGateRequired, reportUnlocked, role.id,
    selectedAnswerMethod, serverAttemptId, stage, tailored, transcript, transcriptConfirmed]);

  // Save typed or transcribed words after a short pause. This runs before AI
  // scoring, so a provider outage or closed tab cannot erase the answer.
  useEffect(() => {
    if (!serverAttemptId || !transcript.trim() || (stage !== 'record' && stage !== 'review')) return;
    const timeout = window.setTimeout(() => {
      void persistProgress({
        questionIndex: index,
        transcript,
        currentQuestion: index,
        status: 'in_progress',
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [index, persistProgress, serverAttemptId, stage, transcript]);

  useEffect(() => {
    if (!serverAttemptId || !transcript.trim() || stage === 'check' || stage === 'done') return;
    const flush = () => {
      void fetch(`/api/interviews/${serverAttemptId}`, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: index,
          transcript,
          currentQuestion: index,
          status: 'in_progress',
        }),
      });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [index, serverAttemptId, stage, transcript]);

  const createServerAttempt = useCallback(async (questionsOverride?: Question[]): Promise<string | null> => {
    if (serverAttemptId) return serverAttemptId;
    try {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: role.id,
          roleTitle: reportRoleTitle,
          language: interviewLanguage,
          mode,
          questions: (questionsOverride ?? activeQuestions).map(({ id, text, textAr, competencies, hint, hintAr, prepSeconds, answerSeconds }) => ({
            id, text, textAr, competencies, hint, hintAr, prepSeconds, answerSeconds,
          })),
          interviewToken,
          focusQuestionId: mode === 'guided' && (questionsOverride ?? activeQuestions).length === 1
            ? focusQuestionId
            : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (proof) return null;
        // Account storage is part of the report lock. Failure must never turn
        // the paid-in-email gate off and expose Questions 2 onward.
        setReportGateRequired(true);
        return null;
      }
      setServerAttemptId(data.id);
      if (proof) {
        setReportGateRequired(false);
        setReportUnlocked(true);
      } else {
        setReportGateRequired(true);
        setReportUnlocked(Boolean(data.unlocked));
      }
      return data.id as string;
    } catch {
      if (!proof) setReportGateRequired(true);
      return null;
    }
  }, [activeQuestions, focusQuestionId, interviewLanguage, interviewToken, mode, proof, reportRoleTitle, role.id, serverAttemptId]);

  useEffect(() => {
    // Same window.SpeechRecognition check as lib/speech, without loading it.
    const supported = detectDeviceCapabilities().speechSupported;
    setSpeechOk(supported);
    if (!supported) {
      // Without live captions the candidate may still speak: audio only is
      // written up when they finish. Only a browser that cannot record audio
      // at all is moved to typing here.
      if (!isAudioCaptureSupported()) setAnswerMethod('type');
      return;
    }
    let cancelled = false;
    void loadCaptureLibs()
      .then(({ speech }) => speech.isOnDeviceRecognitionAvailable(interviewLanguage === 'ar' ? 'ar-AE' : 'en-US'))
      .then((local) => {
        if (!cancelled) setOnDeviceSpeech(local);
      })
      .catch(() => {
        // Unknown means "audio may leave the device", which is what false says.
        if (!cancelled) setOnDeviceSpeech(false);
      });
    return () => {
      cancelled = true;
    };
  }, [interviewLanguage]);

  const stopDictation = useCallback(() => {
    const captured = dictationRef.current?.stop();
    dictationRef.current = null;
    // A dictation session that heard nothing must not wipe the transcript:
    // when speech dies mid-question the candidate falls back to typing, and
    // an empty capture here would erase what they typed.
    const heard = captured
      ? [captured.finalText.trim(), captured.interimText.trim()].filter(Boolean).join(' ')
      : '';
    if (heard) setTranscript(heard);
    setInterim('');
  }, []);

  /** Drops any audio held for server transcription and stops waiting for a result. */
  const discardAudioCapture = useCallback(() => {
    audioCaptureRef.current?.discard();
    audioCaptureRef.current = null;
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;
    setTranscribing(false);
  }, []);

  const switchToTyping = useCallback(async () => {
    stopDictation();
    discardAudioCapture();
    setAnswerMethod('type');
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
  }, [discardAudioCapture, stopDictation]);

  // Release camera and microphone when the component unmounts, and drop any
  // audio held for transcription. The same happens when the tab is closed or
  // sent to the background history, so no recording outlives the session.
  useEffect(() => {
    const release = () => {
      dictationRef.current?.stop();
      meterRef.current?.stop();
      audioCaptureRef.current?.discard();
      audioCaptureRef.current = null;
      transcriptionAbortRef.current?.abort();
      transcriptionAbortRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
      release();
    };
  }, []);

  // Object URLs are session-only; free the previous one whenever it is replaced.
  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  const enableCamera = useCallback(async (): Promise<boolean> => {
    if (streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) return true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
      // typing: the camera is a rehearsal aid, never a requirement.
      setCameraState('denied');
      return false;
    } finally {
      setRequestingCamera(false);
    }
  }, []);

  const enableMicrophone = useCallback(async (): Promise<boolean> => {
    if (streamRef.current?.getTracks().some((track) => track.readyState === 'live')) return true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      streamRef.current = stream;
      return true;
    } catch {
      return false;
    } finally {
      setRequestingCamera(false);
    }
  }, []);

  const resumeLocalDraft = useCallback(async (draft: InterviewSessionDraft) => {
    let safeDraft = draft;
    if (draft.stage === 'prep' && draft.answerMethod !== 'type') {
      const captureReady = draft.answerMethod === 'video'
        ? await enableCamera()
        : await enableMicrophone();
      if (!captureReady) {
        setDeviceFallback(true);
        safeDraft = { ...draft, answerMethod: 'type' };
      }
    }
    restoreDraft(safeDraft);
  }, [enableCamera, enableMicrophone, restoreDraft]);

  const ensureCaptureReady = useCallback(async (): Promise<boolean> => {
    if (!useVoice) return true;
    const stream = streamRef.current;
    if (stream?.getTracks().every((track) => track.readyState === 'live')) {
      setStreamLost(false);
      if (useVideo && stream.getVideoTracks().some((track) => track.readyState === 'live')) {
        setCameraState('granted');
      }
      return true;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState('idle');
    setStreamLost(false);
    return useVideo ? enableCamera() : enableMicrophone();
  }, [enableCamera, enableMicrophone, useVideo, useVoice]);

  // Re-attach the stream whenever the video element remounts between stages.
  useEffect(() => {
    if (cameraState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraState, stage]);

  const startSpeechCapture = useCallback(async (initialText = ''): Promise<boolean> => {
    // A failed download is treated exactly like a browser without speech:
    // the candidate keeps going by typing.
    const libs = await loadCaptureLibs().catch(() => null);
    captureLibsRef.current = libs;
    const speechSession = libs?.speech.startDictation(
      interviewLanguage === 'ar' ? 'ar-AE' : 'en-US',
      (finalText, interimText) => {
        setTranscript(finalText);
        setInterim(interimText);
      },
      () => {
        setSpeechOk(false);
        setDeviceFallback(true);
        void switchToTyping();
      },
      initialText,
    );
    if (!speechSession) {
      setSpeechOk(false);
      setDeviceFallback(true);
      void switchToTyping();
      return false;
    }
    dictationRef.current = speechSession;
    return true;
  }, [interviewLanguage, switchToTyping]);

  /**
   * Audio-only fallback for browsers without live captions. The recorder gets
   * its own microphone-only stream, so even in Video mode no camera frame can
   * reach it. The local video preview stays on the device exactly as before.
   */
  const startAudioFallbackCapture = useCallback(async (): Promise<boolean> => {
    audioCaptureRef.current?.discard();
    // The local preview recorder and level meter live in the lazily loaded
    // media library, so make sure it is present on this path as well.
    captureLibsRef.current = await loadCaptureLibs().catch(() => null);
    const capture = await startAudioCapture();
    if (!capture) {
      setAudioFallbackAvailable(false);
      setDeviceFallback(true);
      await switchToTyping();
      return false;
    }
    audioCaptureRef.current = capture;
    return true;
  }, [switchToTyping]);

  /** Uploads one answer's audio and fills the transcript for the candidate to check. */
  const transcribeOnServer = useCallback(async (blob: Blob, stoppedAt: number) => {
    transcriptionAbortRef.current?.abort();
    const controller = new AbortController();
    transcriptionAbortRef.current = controller;
    setTranscribing(true);
    setTranscriptionFailed(false);
    const timeoutId = window.setTimeout(() => controller.abort(), CLIENT_TRANSCRIPTION_TIMEOUT_MS);
    const timingProps = { lang: interviewLanguage, outcome: 'server' };
    try {
      const form = new FormData();
      form.append('audio', blob, 'answer');
      form.append('lang', interviewLanguage);
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`transcription_${response.status}`);
      const data = (await response.json()) as { transcript?: string };
      // A retry or next question may have moved on while the upload ran.
      if (transcriptionAbortRef.current !== controller) return;
      setTranscript((data.transcript ?? '').trim());
      trackTiming('transcript_ready_ms', performance.now() - stoppedAt, timingProps);
    } catch {
      if (transcriptionAbortRef.current !== controller) return;
      trackTiming('transcript_ready_ms', performance.now() - stoppedAt, { ...timingProps, outcome: 'server_failed' });
      // 503 (no provider), a timeout or a network fault all mean the same to
      // the candidate: type this answer, and speak-to-text is off for now.
      setTranscriptionFailed(true);
      setDeviceFallback(true);
      setAudioFallbackAvailable(false);
    } finally {
      window.clearTimeout(timeoutId);
      if (transcriptionAbortRef.current === controller) {
        transcriptionAbortRef.current = null;
        setTranscribing(false);
      }
    }
  }, [interviewLanguage]);

  // Only called after a capture start succeeded, so the libraries are loaded.
  const startMicMeter = useCallback(() => {
    const media = captureLibsRef.current?.media;
    if (!streamRef.current || !media) return;
    meterRef.current = media.startLevelMeter(
      streamRef.current,
      (level) => {
        if (level > 0.08) lastHeardRef.current = Date.now();
        setMicLevel(level);
      },
      () => setMeterUnavailable(true),
    );
  }, []);

  const liveSitting = mode === 'mock' || mode === 'screening';

  /**
   * `typedOnly` is passed when capture was just refused, so a stale `useVoice`
   * in this closure cannot ask the browser a second time.
   */
  const beginRecording = useCallback(async (typedOnly = false) => {
    const voice = useVoice && !typedOnly;
    setTranscript('');
    setInterim('');
    setEditingTranscript(false);
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    // Two minutes at most for a spoken or filmed answer. Extra time chosen at
    // the start of a mock was already added to answerSeconds; keep it on top.
    const extraSeconds = mode === 'mock' && extraTimeEnabled ? 60 : 0;
    const limit = recordingLimitSeconds(question.answerSeconds - extraSeconds, extraSeconds);
    setRecordingLimit(limit);
    setSecondsLeft(limit);
    setTimerPaused(false);
    setTimerAnnouncement('');
    setStage('record');

    setStreamLost(false);
    if (voice) {
      const ready = await ensureCaptureReady();
      if (!ready) {
        setDeviceFallback(true);
        await switchToTyping();
        return;
      }
    }
    streamRef.current?.getTracks().forEach((track) => { track.enabled = true; });
    const live = Boolean(voice && streamRef.current);
    setRecordingLive(live);
    if (voice) {
      if (usingAudioFallback) {
        setTranscriptionFailed(false);
        if (!(await startAudioFallbackCapture())) return;
      } else if (!(await startSpeechCapture())) {
        return;
      }
      const media = captureLibsRef.current?.media;
      if (streamRef.current && media) {
        recorderRef.current = media.startRecording(streamRef.current);
        startMicMeter();
      }
    }
  }, [ensureCaptureReady, extraTimeEnabled, mode, playbackUrl, question.answerSeconds, startAudioFallbackCapture,
    startMicMeter, startSpeechCapture, switchToTyping, useVoice, usingAudioFallback]);

  const toggleMockPause = useCallback(async () => {
    if (!liveSitting || stage !== 'record' || !useVoice) return;
    if (!timerPaused) {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      recorderRef.current?.pause();
      audioCaptureRef.current?.pause();
      streamRef.current?.getTracks().forEach((track) => { track.enabled = false; });
      setRecordingLive(false);
      setTimerPaused(true);
      setTimerAnnouncement(t('timerPausedStatus'));
      return;
    }
    streamRef.current?.getTracks().forEach((track) => { track.enabled = true; });
    recorderRef.current?.resume();
    if (usingAudioFallback) {
      audioCaptureRef.current?.resume();
    } else if (!(await startSpeechCapture(transcript))) {
      return;
    }
    startMicMeter();
    setRecordingLive(true);
    setTimerPaused(false);
    setTimerAnnouncement(t('timerResumedStatus'));
  }, [liveSitting, stage, startMicMeter, startSpeechCapture, stopDictation, t, timerPaused, transcript, useVoice,
    usingAudioFallback]);

  const finishAnswer = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);
    const stoppedAt = performance.now();
    try {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      setMicLevel(0);
      setTranscriptConfirmed(false);
      setEditingTranscript(false);
      setPlaybackIsVideo(useVideo);
      setStage('review');
      if (practiceSitting && !firstAnswerTrackedRef.current) {
        firstAnswerTrackedRef.current = true;
        track('first_answer_completed', { role_id: role.id, mode: selectedAnswerMethod, lang: interviewLanguage });
      }
      if (useVoice && !usingAudioFallback) {
        trackTiming('transcript_ready_ms', performance.now() - stoppedAt, {
          lang: interviewLanguage,
          outcome: 'device',
        });
      }

      const capture = audioCaptureRef.current;
      audioCaptureRef.current = null;
      if (capture) {
        const audio = await capture.stop();
        if (audio) {
          // Not awaited: the review screen shows a skeleton until the words land.
          void transcribeOnServer(audio, stoppedAt);
        } else {
          setTranscriptionFailed(true);
        }
      }

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
  }, [interviewLanguage, practiceSitting, role.id, selectedAnswerMethod, stopDictation, transcribeOnServer, useVideo,
    useVoice, usingAudioFallback]);

  // The OS kills camera and microphone on a phone call or an app switch, and
  // nothing tells the page. Watch the tracks themselves, and when the page
  // comes back to the foreground check whether capture died while it was away
  //: checking on return avoids false alarms on desktop tab switches.
  useEffect(() => {
    if (stage !== 'record' || !recordingLive) return;
    const stream = streamRef.current;
    if (!stream) return;
    const markLost = () => {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      setMicLevel(0);
      setStreamLost(true);
    };
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener('ended', markLost);
    });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (stream.getTracks().some((track) => track.readyState === 'ended')) markLost();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      tracks.forEach((track) => track.removeEventListener('ended', markLost));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [stage, recordingLive, stopDictation]);

  // Warn only when work is genuinely at risk. A successfully saved typed
  // answer should survive an ordinary refresh without a contradictory prompt.
  useEffect(() => {
    const workAtRisk = (stage === 'record' && useVoice)
      || isScoring
      || transcribing
      || syncState === 'error'
      || localDraftSaveFailed;
    if (!workAtRisk) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isScoring, localDraftSaveFailed, stage, syncState, transcribing, useVoice]);

  const startPrep = useCallback(() => {
    setSecondsLeft(question.prepSeconds);
    setTimerPaused(false);
    setStage('prep');
  }, [question.prepSeconds]);

  // Countdown for both the prep and recording stages.
  useEffect(() => {
    if (stage !== 'prep' && stage !== 'record') return;
    if (timerPaused) return;
    // Typing has no clock: cutting someone off mid-sentence with a timer they
    // were never shown punishes exactly the people pushed into typing by a
    // camera denial or a speech failure. "Review answer" is the only exit.
    if (stage === 'record' && !useVoice) return;
    // A lost stream freezes the clock instead of racing on over dead capture.
    if (stage === 'record' && streamLost) return;
    if (secondsLeft <= 0) {
      // A spoken or filmed answer stops itself at the limit in every mode.
      if (stage === 'prep') void beginRecording();
      else void finishAnswer();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [stage, secondsLeft, beginRecording, finishAnswer, useVoice, streamLost, timerPaused]);

  // completeCurrentAnswer is declared later in the file; the mock path inside
  // submitForScoring reaches it through a ref kept current on every render.
  const completeAnswerRef = useRef<((fb: AnswerFeedback) => Promise<void>) | null>(null);

  const submitForScoring = useCallback(async () => {
    if (scoringInFlightRef.current || !transcript.trim()) return;
    // Pressing Get feedback after seeing the words is the confirmation.
    setTranscriptConfirmed(true);
    setEditingTranscript(false);
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
    // Only the guided path shows feedback straight away, so only it streams.
    // Live sittings bank the score and move on; streaming would reveal nothing.
    const streaming = FEEDBACK_STREAMING_ENABLED && mode === 'guided';
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), streaming ? CLIENT_SCORING_TIMEOUT_MS : 45_000);
    const tappedAt = performance.now();
    let firstBlockAt: number | null = null;
    const timingProps = { lang: interviewLanguage, role_id: role.id, streamed: streaming };
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: streaming ? `${FEEDBACK_STREAM_CONTENT_TYPE}, application/json` : 'application/json',
          'X-Scoring-Session': scoringSessionRef.current,
        },
        body: JSON.stringify({
          roleId: role.id,
          questionId: question.id,
          transcript: scoringTranscript,
          lang: interviewLanguage,
          roleTitle: customTitle,
          interviewToken,
          interviewId: serverAttemptId ?? undefined,
          questionIndex: index,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string; retryable?: boolean; retryAfterSeconds?: number };
        } | null;
        throw scoringErrorFromBody(response.status, body, response.headers.get('Retry-After'));
      }
      const isStream = (response.headers.get('content-type') ?? '').includes(FEEDBACK_STREAM_CONTENT_TYPE);
      let data: ScoreResponsePayload;
      if (isStream) {
        data = await readFeedbackStream(response, (partial) => {
          if (firstBlockAt === null && (partial.headline || partial.strengths?.length)) {
            firstBlockAt = performance.now();
            trackTiming('feedback_first_token_ms', firstBlockAt - tappedAt, timingProps);
          }
          setStreamingFeedback(partial);
          setStage('feedback');
        });
      } else {
        data = (await response.json()) as ScoreResponsePayload;
      }
      if (firstBlockAt === null) {
        trackTiming('feedback_first_token_ms', performance.now() - tappedAt, timingProps);
      }
      trackTiming('feedback_complete_ms', performance.now() - tappedAt, {
        ...timingProps,
        outcome: data.locked ? 'locked' : data.feedback.status,
      });
      scoringSessionRef.current = null;
      automaticRetriesRef.current = 0;
      setStreamingFeedback(null);
      if (mode === 'mock' || mode === 'screening' || data.locked) {
        // Live sittings do not interrupt: the score is banked and the interview
        // moves straight on. Everything is shown together in the final report.
        await completeAnswerRef.current?.(data.feedback);
      } else {
        if (starProbe) {
          setTranscript(scoringTranscript);
          setStarProbe(null);
          setStarProbeUsed((used) => ({ ...used, [index]: true }));
        }
        setFeedback(data.feedback);
        setStage('feedback');
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      const requestError =
        error instanceof ScoringRequestError
          ? error
          : aborted
            ? new ScoringRequestError(true, 0, false, false, true)
            : new ScoringRequestError(true, 20, false, false);
      // Anything half shown is withdrawn. The candidate sees a clear message
      // and a Retry button, never a card that stopped filling in.
      setStreamingFeedback(null);
      setStage('review');
      trackTiming('feedback_complete_ms', performance.now() - tappedAt, {
        ...timingProps,
        outcome: requestError.timedOut ? 'timeout' : 'error',
      });
      setScoringError({
        creditsExhausted: requestError.creditsExhausted,
        answerTooLong: requestError.answerTooLong,
        timedOut: requestError.timedOut,
      });
      if (!requestError.timedOut && requestError.retryable && automaticRetriesRef.current < 2) {
        automaticRetriesRef.current += 1;
        setRetrySeconds(requestError.retryAfterSeconds);
      }
    } finally {
      window.clearTimeout(timeoutId);
      scoringInFlightRef.current = false;
      setIsScoring(false);
    }
  }, [customTitle, index, interviewLanguage, interviewToken, mode, question.id, role.id, scoringTranscript, serverAttemptId, starProbe, transcript]);

  const startStarProbe = useCallback(() => {
    if (!feedback || !starFollowUp) return;
    discardAudioCapture();
    setTranscriptionFailed(false);
    setStarProbe({
      element: starFollowUp,
      question: probeQuestion(starFollowUp, interviewLanguage),
      baseTranscript: transcript,
    });
    setTranscript('');
    setTranscriptConfirmed(false);
    setRetrying(false);
    setInterim('');
    setFeedback(null);
    setScoringError(null);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setSecondsLeft(Math.min(question.prepSeconds, 20));
    setStage('prep');
  }, [discardAudioCapture, feedback, interviewLanguage, question.prepSeconds, starFollowUp, transcript]);

  const skipStarProbe = useCallback(() => {
    setStarProbeDeclined(true);
    setStarProbeUsed((used) => ({ ...used, [index]: true }));
  }, [index]);

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

  /**
   * Try again without leaving the screen: the first answer stays visible and
   * the answer box opens under it. The new feedback then replaces the old.
   */
  const retryQuestion = useCallback(async () => {
    if (feedback && transcript.trim()) {
      setPreviousTry({ transcript, feedback });
      setRetrying(true);
      track('retry_started', { role_id: role.id, mode: selectedAnswerMethod, lang: interviewLanguage });
    }
    setAttemptCount((c) => c + 1);
    setFeedback(null);
    setScoringError(null);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setStarProbe(null);
    setStarProbeDeclined(false);
    setStarProbeUsed((used) => {
      const next = { ...used };
      delete next[index];
      return next;
    });
    setTranscript('');
    setTranscriptConfirmed(false);
    setInterim('');
    // A retry drops the previous answer's audio and any write-up still in flight.
    discardAudioCapture();
    setTranscriptionFailed(false);
    let typedOnly = false;
    if (useVoice && !streamRef.current) {
      const captureReady = useVideo ? await enableCamera() : await enableMicrophone();
      if (!captureReady) {
        setDeviceFallback(true);
        await switchToTyping();
        typedOnly = true;
      }
    }
    await beginRecording(typedOnly);
  }, [beginRecording, discardAudioCapture, enableCamera, enableMicrophone, feedback, interviewLanguage, role.id,
    selectedAnswerMethod, switchToTyping, transcript, useVideo, useVoice]);

  const completeCurrentAnswer = useCallback(async (answerFeedback: AnswerFeedback) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const completed: CompletedAnswer = {
      questionId: question.id,
      questionText,
      transcript,
      feedback: answerFeedback,
    };
    const nextAnswers = [...answers, completed];
    if (serverAttemptId) {
      const persisted = await persistProgress({
        questionIndex: index,
        transcript,
        currentQuestion: isLast ? index : index + 1,
        status: isLast ? 'completed' : 'in_progress',
      });
      if (!persisted) {
        advancingRef.current = false;
        return;
      }
    }
    setAnswers(nextAnswers);
    // Release this answer's recording now, including on the final question.
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    discardAudioCapture();
    setTranscriptionFailed(false);
    setFeedback(null);
    setScoringError(null);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setTranscript('');
    setTranscriptConfirmed(false);
    setPreviousTry(null);
    setRetrying(false);
    setEditingTranscript(false);
    setShowModeSelector(false);
    setInterim('');
    setStarProbe(null);
    setAttemptCount(1);
    setStreamLost(false);
    setRecordingLive(false);

    if (isLast) {
      setStage('done');
    } else {
      setIndex((i) => i + 1);
      setSecondsLeft(activeQuestions[index + 1].prepSeconds);
      setStage('prep');
    }
    window.setTimeout(() => {
      advancingRef.current = false;
    }, 0);
  }, [answers, discardAudioCapture, index, isLast, playbackUrl, question.id, questionText, activeQuestions,
    persistProgress, serverAttemptId, transcript]);

  completeAnswerRef.current = completeCurrentAnswer;

  const advance = useCallback(() => {
    if (feedback) void completeCurrentAnswer(feedback);
  }, [completeCurrentAnswer, feedback]);

  const continueWithoutFeedback = useCallback(() => {
    setRetrySeconds(null);
    setScoringError(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    void completeCurrentAnswer({
      questionId: question.id,
      score: 0,
      status: 'unscored',
      unscoredReason: transcript.trim() ? 'scoring_service_unavailable' : 'question_not_answered',
      headline: t('feedbackSkippedTitle'),
      competencies: [],
      strengths: [],
      improvements: [t('feedbackSkippedBody')],
      coachTip: '',
      source: 'none',
    });
  }, [completeCurrentAnswer, question.id, t, transcript]);

  /**
   * The first question's "Choose how to answer" step. One tap confirms the
   * mode, remembers it, and only then asks for the camera or microphone. A
   * refusal drops quietly to typing.
   */
  const startWithMode = useCallback(async (chosen: AnswerMode) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState('idle');
    setDeviceFallback(false);
    setAnswerMethod(chosen);
    storeAnswerMode(window.localStorage, chosen);
    const startingQuestions = mode === 'mock' && extraTimeEnabled
      ? activeQuestions.map((item) => ({ ...item, answerSeconds: item.answerSeconds + 60 }))
      : activeQuestions;
    if (startingQuestions !== activeQuestions) setResumedQuestions(startingQuestions);
    const startingLanguage = initialLanguage ?? lang;
    setSessionLanguage(startingLanguage);
    track('interview_started', { role_id: role.id, lang: startingLanguage });
    track('mode_selected', { role_id: role.id, mode: chosen, lang: startingLanguage });
    if (!proof) track('practice_started', { role_id: role.id, mode: chosen, lang: startingLanguage });
    const attemptId = await createServerAttempt(startingQuestions);
    if (proof && !attemptId) {
      setProofStartFailed(true);
      return;
    }
    setProofStartFailed(false);
    // Permissions are requested here, after the choice, inside the tap that
    // made it. Type asks for nothing.
    if (chosen !== 'type') {
      const captureReady = chosen === 'video' && videoSelectable ? await enableCamera() : await enableMicrophone();
      if (!captureReady) {
        setDeviceFallback(true);
        await switchToTyping();
      }
    }
    setModeChosen(true);
    startPrep();
  }, [activeQuestions, createServerAttempt, enableCamera, enableMicrophone, extraTimeEnabled, initialLanguage, lang,
    mode, proof, role.id, startPrep, switchToTyping, videoSelectable]);

  /** "Change mode" on a later question. Same rules as the first choice. */
  const changeMode = useCallback(async (chosen: AnswerMode) => {
    setShowModeSelector(false);
    storeAnswerMode(window.localStorage, chosen);
    track('mode_selected', { role_id: role.id, mode: chosen, lang: interviewLanguage });
    if (chosen === 'type') {
      await switchToTyping();
      setDeviceFallback(false);
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState('idle');
    setAnswerMethod(chosen);
    const captureReady = chosen === 'video' && videoSelectable ? await enableCamera() : await enableMicrophone();
    if (!captureReady) {
      setDeviceFallback(true);
      await switchToTyping();
    } else {
      setDeviceFallback(false);
    }
  }, [enableCamera, enableMicrophone, interviewLanguage, role.id, switchToTyping, videoSelectable]);

  const toggleStarGuide = useCallback((on: boolean) => {
    setStarGuideOn(on);
    storeStarGuide(window.localStorage, on);
  }, []);

  // Feedback on screen, and the side by side view when there is one.
  useEffect(() => {
    if (stage !== 'feedback' || !feedback || !practiceSitting) return;
    track('feedback_viewed', { role_id: role.id, mode: selectedAnswerMethod, lang: interviewLanguage });
    if (previousTry) {
      track('comparison_viewed', { role_id: role.id, mode: selectedAnswerMethod, lang: interviewLanguage });
    }
    // Fire once per feedback shown, not on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, feedback]);

  const startFullMock = useCallback(() => {
    if (!mockQuestions || mockQuestions.length < 8) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    savedRef.current = false;
    setRetrying(false);
    setShowModeSelector(false);
    setMode('mock');
    setResumedQuestions(null);
    setServerAttemptId(null);
    setReportGateRequired(false);
    setReportUnlocked(false);
    setAnswers([]);
    setIndex(0);
    setAttemptCount(1);
    setTranscript('');
    setTranscriptConfirmed(false);
    setPreviousTry(null);
    setFeedback(null);
    setPlaybackUrl(null);
    setSessionLanguage(null);
    setStage('check');
  }, [mockQuestions]);

  // Persist the finished interview once, when results are shown.
  useEffect(() => {
    if (stage !== 'done' || savedRef.current || answers.length === 0) return;
    savedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const attempt: Attempt = {
      id: `${role.id}-${Date.now()}`,
      roleId: role.id,
      roleTitle: reportRoleTitle,
      startedAt: new Date().toISOString(),
      overallScore: overallFromAnswers(answers),
      answers,
    };
    // The account database is the durable copy. Avoid retaining a second full
    // transcript in this browser once server persistence is available.
    setSaveFailed(serverAttemptId ? false : !saveAttempt(attempt));
    setSavedAttempt(attempt);
    // A finished sitting closes the session for the email ask rule.
    updateConsentState(recordSessionEnd);
    track('interview_completed', {
      role_id: role.id,
      lang: interviewLanguage,
      overall_score: attempt.overallScore ?? undefined,
      questions_answered: attempt.answers.length,
      scoring_source: attempt.answers[0]?.feedback.source ?? 'unknown',
    });
  }, [answers, interviewLanguage, reportRoleTitle, role.id, serverAttemptId, stage]);

  const wordCount = `${transcript} ${interim}`.trim().split(/\s+/).filter(Boolean).length;
  // Speech recognition is unreliable inside iOS in-app browsers: it reports as
  // supported, starts without error, and simply never returns words. If a
  // candidate has been speaking for a while with nothing transcribed, stop
  // letting them wonder and offer typing.
  const elapsed = recordingLimit - secondsLeft;
  // The audio fallback has no live words by design, so it is never "silent".
  const silentTranscript = stage === 'record' && !usingAudioFallback && elapsed > 12 && wordCount === 0;

  const progressLabel = t('questionProgress')
    .replace('{current}', String(index + 1))
    .replace('{total}', String(activeQuestions.length));

  /**
   * Read only transcript with one Edit and one Get feedback button. Nothing to
   * check yet (the write-up failed or the box was left empty) opens the editor.
   */
  const transcriptEditing = editingTranscript || transcript.trim().length === 0;
  const transcriptCheck = (
    <>
      {transcriptEditing ? (
        <div className="answer-box-wrap">
          <textarea
            className="answer-box"
            aria-label={t('yourAnswer')}
            placeholder={t('typeAnswer')}
            value={transcript}
            autoFocus={editingTranscript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setEditingTranscript(true);
              setTranscriptConfirmed(false);
              setScoringError(null);
              setRetrySeconds(null);
              scoringSessionRef.current = null;
              automaticRetriesRef.current = 0;
            }}
          />
        </div>
      ) : (
        <div className="transcript transcript-check" dir="auto" tabIndex={0} aria-label={t('yourAnswer')}>
          {transcript}
        </div>
      )}
      <div className="row-between">
        <p className="tiny" style={{ margin: 0 }}>
          {wordCount} {t('words')}
        </p>
        {!transcriptEditing && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditingTranscript(true)}>
            {t('editTranscript')}
          </button>
        )}
      </div>
    </>
  );

  /** The first answer, kept in view while the candidate answers again. */
  const previousAnswerRecap = retrying && previousTry ? (
    <div className="card stack-sm previous-answer">
      <p className="eyebrow" style={{ marginBottom: 0 }}>{t('previousAnswerLabel')}</p>
      <p className="muted" dir="auto">{previousTry.transcript}</p>
      <p className="tiny">{t('retryAnswerIntro')}</p>
    </div>
  ) : null;

  const quietFallbackNotice = deviceFallback && !useVoice ? (
    <p className="notice tiny quiet-notice" role="status">{t('permissionDeniedTypeInstead')}</p>
  ) : null;

  return (
    <div className="shell shell-narrow">
      <TopBar showProgressLink={false} locked={stage !== 'check' && stage !== 'done'} />

      <div className="rail" aria-hidden="true">
        {activeQuestions.map((q, i) => (
          <span
            key={q.id}
            className={`rail-step ${i < index ? 'done' : i === index ? 'current' : ''}`}
          />
        ))}
      </div>
      <p className="tiny flow-progress" style={{ marginBottom: '1.4rem' }}>
        {interviewLanguage === 'ar' ? role.titleAr : role.title}
        {' · '}
        <span aria-label={`${t('question')} ${progressLabel}`}>{progressLabel}</span>
      </p>
      {serverAttemptId && stage !== 'check' && stage !== 'done' && syncState !== 'idle' && (
        <p className={`tiny ${syncState === 'error' ? 'notice notice-warn' : ''}`} role="status">
          {syncState === 'syncing' ? t('progressSyncing') : syncState === 'saved' ? t('progressSaved') : t('progressSaveFailed')}
        </p>
      )}
      {localDraftSaveFailed && stage !== 'check' && stage !== 'done' && (
        <p className="notice notice-warn tiny" role="status">
          {t('localDraftSaveFailed')}
        </p>
      )}
      {serverAttemptId && !reportUnlocked && stage !== 'check' && stage !== 'done' && (
        <div className="stack-sm" style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setShowContinueSignIn((shown) => !shown)}>
            {showContinueSignIn ? t('hideSignIn') : t('saveContinueDevice')}
          </button>
          {showContinueSignIn && (
            <EmailSignIn compact next={`/practice/${encodeURIComponent(role.id)}?resume=${encodeURIComponent(serverAttemptId)}`} />
          )}
        </div>
      )}

      {/* ---------- device check ---------- */}
      {stage === 'check' && pendingDraft && (
        <section className="card stack" aria-labelledby="resume-draft-title">
          <div>
            <p className="eyebrow">{t('beforeStart')}</p>
            <h1 id="resume-draft-title" style={{ fontSize: '1.75rem' }}>
              {t('resumeDraftTitle')}
            </h1>
            <p className="lede" style={{ marginTop: '0.6rem' }}>{t('resumeDraftBody')}</p>
          </div>
          <div className="notice tiny">
            <strong>{pendingDraft.customTitle || (pendingDraft.language === 'ar' ? role.titleAr : role.title)}</strong>
            <p style={{ marginTop: '0.35rem' }}>
              {t('question')} {pendingDraft.questionIndex + 1} {t('of')} {pendingDraft.questionSnapshot.length}
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              {pendingDraft.language === 'ar'
                ? t('resumeDraftLanguageArabic')
                : t('resumeDraftLanguageEnglish')}
            </p>
          </div>
          {!confirmDiscardDraft ? (
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => void resumeLocalDraft(pendingDraft)}>
                {t('resumeInterview')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDiscardDraft(true)}>
                {t('discardSavedPractice')}
              </button>
            </div>
          ) : (
            <div className="notice notice-warn stack-sm" role="alert">
              <strong>{t('discardDraftTitle')}</strong>
              <p className="tiny">{t('discardDraftBody')}</p>
              <div className="row">
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmDiscardDraft(false)}>
                  {t('keepSavedPractice')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    discardInterviewDraft(window.localStorage, role.id, customTitle);
                    setPendingDraft(null);
                    setConfirmDiscardDraft(false);
                  }}
                >
                  {t('deleteSavedPractice')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {stage === 'check' && !pendingDraft && (
        <div className="stack">
          <div>
            <p className="eyebrow">{t('beforeStart')}</p>
            <h1 style={{ fontSize: '1.75rem' }}>
              {interviewLanguage === 'ar' ? role.titleAr : role.title}
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
            <p className="lede" style={{ marginTop: '0.6rem' }}>
              {proof
                ? (proof.recruiterName
                    ? t('proofBeforeStartRecruiter')
                        .replace('{recruiter}', proof.recruiterName)
                        .replace('{company}', proof.workplace || t('proofCompanyFallback'))
                    : t('proofBeforeStartShort')
                        .replace('{company}', proof.workplace || t('proofCompanyFallback')))
                : t('beforeStartShort')}
            </p>
            <details className="disclosure" style={{ marginTop: '0.5rem' }}>
              <summary className="tiny">{t('beforeStartMore')}</summary>
              <p className="tiny" style={{ marginTop: '0.4rem' }}>
                {proof ? t('proofBeforeStartBody') : t('beforeStartBody')}
              </p>
            </details>
          </div>

          {!proof && (
          <div className="mode-row">
            {mode === 'mock' && mockQuestions && mockQuestions.length > 0 && (
              <button
                type="button"
                className={`mode-card ${mode === 'mock' ? 'on' : ''}`}
                aria-pressed={mode === 'mock'}
                onClick={() => setMode('mock')}
              >
                <span className="method-title-row">
                  <span className="mode-title">{t('modeMockTitle')}</span>
                  <span className="choice-note">{t('modeRecommended')}</span>
                </span>
                <span className="tiny">{t('modeMockBody')}</span>
              </button>
            )}
            <button
              type="button"
              className={`mode-card ${mode === 'guided' ? 'on' : ''}`}
              aria-pressed={mode === 'guided'}
              onClick={() => setMode('guided')}
            >
              <span className="mode-title">{t('modeGuidedTitle')}</span>
                <span className="tiny">{t('modeGuidedBody')}</span>
            </button>
          </div>
          )}

          {mode === 'mock' && !proof && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={extraTimeEnabled}
                onChange={(event) => setExtraTimeEnabled(event.target.checked)}
              />
              <span>
                <strong>{t('extraTimeTitle')}</strong>
                <span className="tiny" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {t('extraTimeBody')}
                </span>
              </span>
            </label>
          )}

          {/* ---------- choose how to answer ---------- */}
          <section className="answer-method stack-sm" aria-labelledby="answer-method-title">
            <div>
              <p className="eyebrow" id="answer-method-title">{t('chooseHowToAnswer')}</p>
              <p className="tiny" style={{ marginTop: '0.25rem' }}>
                {deviceCaps.isDesktop ? t('modeEnterToStart') : t('modeTapToStart')}
              </p>
            </div>
            <AnswerModeSelector
              highlighted={selectedAnswerMethod}
              availability={modeAvailability}
              onChoose={(chosen) => void startWithMode(chosen)}
              focusHighlighted={deviceCaps.isDesktop}
              disabled={requestingCamera}
            />
            {requestingCamera && (
              <p className="tiny" role="status">{t('cameraStarting')}</p>
            )}
            {voiceAvailable && (
              <p className="tiny muted" role="note">
                {audioFallbackAvailable && !speechOk
                  ? `${t('captionsUnavailableNotice')} ${t('captionsUnavailableAudioOnly')}`
                  : onDeviceSpeech ? t('speechOnDevice') : t('speechCloud')}
              </p>
            )}
          </section>

          {liveSitting && (
            <p className="notice tiny" style={{ margin: 0 }}>
              {proof ? t('proofHiddenNote') : t('mockHiddenNote')}
            </p>
          )}

          <div className="card-flat expectation-summary">
            <p className="eyebrow">{t('whatToExpect')}</p>
            <p className="expectation-keyline">
              <strong>
                {proof
                  ? t('expectProofQuestions')
                  : activeQuestions.length === 1
                    ? t('expectOneQuestion')
                    : `${activeQuestions.length} ${t('expect1')}`}
              </strong>
              <span aria-hidden="true">·</span>
              <strong>
                {proof ? t('expectProofTime') : mode === 'mock' ? t('expectMockTime') : t('expectQuickTime')}
              </strong>
            </p>
            <p className="tiny">
              {proof ? t('modeProofExpect') : mode === 'mock' ? t('modeMockExpect') : t('modeGuidedExpect')}
            </p>
            <p className="notice tiny" style={{ marginTop: '0.9rem' }}>
              {t('scoringPolicy')}
            </p>
          </div>

          {proofStartFailed && (
            <p className="notice notice-warn" role="alert">{t('proofStartFailed')}</p>
          )}
          {!proof && (
            <div className="row">
              <Link href="/practice" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                {t('back')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ---------- preparation ---------- */}
      {stage === 'prep' && (
        <div className="stack">
          {quietFallbackNotice}
          {/* The selector never reappears on its own. "Change mode" opens it
              inline; choosing a card closes it and asks for permission then. */}
          {modeChosen && (
            <div className="change-mode">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                aria-expanded={showModeSelector}
                aria-controls="change-mode-panel"
                disabled={requestingCamera}
                onClick={() => setShowModeSelector((shown) => !shown)}
              >
                {requestingCamera ? t('cameraStarting') : t('changeMode')}
              </button>
              {showModeSelector && (
                <div id="change-mode-panel" className="card stack-sm">
                  <p className="eyebrow" style={{ marginBottom: 0 }}>{t('chooseHowToAnswer')}</p>
                  <AnswerModeSelector
                    highlighted={selectedAnswerMethod}
                    availability={modeAvailability}
                    onChoose={(chosen) => void changeMode(chosen)}
                    focusHighlighted={deviceCaps.isDesktop}
                    disabled={requestingCamera}
                    compact
                  />
                </div>
              )}
            </div>
          )}
          <div className="card stack">
            <p className="eyebrow">
              {starProbe ? t('starProbeEyebrow') : `${t('question')} ${index + 1}`}
            </p>
            <h2 style={{ fontSize: '1.35rem' }} dir="auto">{promptText}</h2>
            {!starProbe && <QuestionTagsSlot question={question} lang={interviewLanguage} />}
            {mode === 'guided' && !starProbe && (
              <div className="coach-tip">
                <strong>{t('tip')}</strong>
                {hintText}
              </div>
            )}
            {questionRubric.length > 0 && !starProbe && (
              <div className="rubric-preview" aria-label={t('rubricPreviewTitle')}>
                <div>
                  <p className="eyebrow">{t('rubricPreviewTitle')}</p>
                  <p className="tiny">{t('rubricPreviewBody')}</p>
                </div>
                <ul className="rubric-preview-list">
                  {questionRubric.map((competency) => (
                    <li key={competency.id}>
                      <strong>{interviewLanguage === 'ar' ? competency.labelAr : competency.label}</strong>
                      <span dir="auto">
                        {interviewLanguage === 'ar' && competency.anchorAr
                          ? competency.anchorAr
                          : competency.anchor}
                      </span>
                    </li>
                  ))}
                </ul>
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
              <button type="button" className="btn btn-primary" onClick={() => void beginRecording()}>
                {t('startAnswer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- recording ---------- */}
      {stage === 'record' && (
        <div className="stack">
          {quietFallbackNotice}
          <div className="card stack">
            <p className="eyebrow">
              {starProbe ? t('starProbeEyebrow') : `${t('question')} ${index + 1}`}
            </p>
            <h2 style={{ fontSize: '1.25rem' }} dir="auto">{promptText}</h2>
          </div>

          {previousAnswerRecap}

          <div className="card stack">
            {useVoice && (
              <>
                {recordingLive && !streamLost && (
                  <div className="capture-indicators" role="status">
                    {useVideo && (
                      <span className="chip chip-live">
                        <span className="rec-dot" aria-hidden="true" />
                        {t('cameraOn')}
                      </span>
                    )}
                    <span className="chip chip-live">
                      <span className="rec-dot" aria-hidden="true" />
                      {t('micOn')}
                    </span>
                  </div>
                )}
                {useVideo ? (
                  <div className="video-frame">
                    <video ref={videoRef} muted playsInline />
                    {cameraState !== 'granted' && (
                      <div className="video-placeholder">
                        {cameraState === 'denied' ? t('cameraDeniedHelp') : t('cameraIdle')}
                      </div>
                    )}
                    {recordingLive && !streamLost ? (
                      <span className="video-badge">
                        <span className="rec-dot" aria-hidden="true" />
                        {t('recording')} · {t('timeLeft')} · {formatClock(secondsLeft)}
                      </span>
                    ) : (
                      <span className="video-badge">
                        {t('timeLeft')} · {formatClock(secondsLeft)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="notice" role="status">
                    <strong>{recordingLive ? t('recording') : t('speakingModeTitle')}</strong>
                    <p className="tiny" style={{ marginTop: '0.35rem' }}>
                      {t('timeLeft')}: {formatClock(secondsLeft)}. {mode === 'guided' ? t('finishWhenReady') : ''}
                    </p>
                  </div>
                )}

                <div className="meter" aria-hidden="true">
                  <div
                    className={`meter-fill ${secondsLeft <= 15 ? 'crit' : 'gold'}`}
                    style={{ width: `${(secondsLeft / recordingLimit) * 100}%` }}
                  />
                </div>
                <p className="tiny" style={{ margin: 0 }}>{t('recordingLimitNote')}</p>

                {liveSitting && (
                  <div className="row timer-controls">
                    <button
                      type="button"
                      className="btn btn-quiet"
                      aria-pressed={timerPaused}
                      onClick={() => void toggleMockPause()}
                    >
                      {timerPaused ? t('resumeTimer') : t('pauseTimer')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setSecondsLeft((seconds) => seconds + 60);
                        setTimerAnnouncement(t('extraTimeAdded'));
                      }}
                    >
                      {t('addExtraTime')}
                    </button>
                    {timerPaused && <strong className="timer-paused-label">{t('paused')}</strong>}
                  </div>
                )}
                <span className="sr-only" aria-live="polite">{timerAnnouncement}</span>

                {/* Proof the microphone is live. Reassurance only: never
                    recorded or scored: and shown only when a working meter
                    exists: a silent meter must hide, not accuse. */}
                {recordingLive && !streamLost && !meterUnavailable && (
                  <div className="mic-row">
                    <span className="mic-label">{t('micLive')}</span>
                    <span className="mic-bars" aria-hidden="true">
                      {[0.08, 0.2, 0.34, 0.5, 0.68].map((threshold) => (
                        <span key={threshold} className={`mic-bar ${micLevel > threshold ? 'on' : ''}`} />
                      ))}
                    </span>
                    <span className="tiny">{heardRecently ? t('micHearing') : t('micQuiet')}</span>
                  </div>
                )}

                {streamLost && (
                  <div className="notice notice-warn tiny">
                    {t('streamLostBody')}
                    <div className="row" style={{ marginTop: '0.6rem' }}>
                      <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
                        {t('streamLostRestart')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={finishAnswer}>
                        {t('streamLostKeep')}
                      </button>
                    </div>
                  </div>
                )}
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

            {usingAudioFallback ? (
              <div className="notice tiny" role="note">
                {t('captionsUnavailableNotice')} {t('captionsUnavailableAudioOnly')}
              </div>
            ) : (
              <div>
                <div className="row-between answer-box-header">
                  <p className="eyebrow" style={{ margin: 0 }}>
                    {t('yourAnswer')}
                  </p>
                  {practiceSitting && <StarGuideToggle on={starGuideOn} onChange={toggleStarGuide} />}
                </div>
                {(() => {
                  const showStar = practiceSitting && starGuideOn && !transcript && !interim;
                  return (
                    <div className="answer-box-wrap">
                      {useVoice ? (
                        <div className="transcript" aria-live="polite" aria-describedby={showStar ? 'star-lines' : undefined}>
                          {transcript}
                          {interim && <span className="transcript-interim"> {interim}</span>}
                          {!transcript && !interim && !showStar && (
                            <span className="transcript-interim">{t('typeHint')}</span>
                          )}
                        </div>
                      ) : (
                        <textarea
                          className="answer-box"
                          aria-label={t('yourAnswer')}
                          placeholder={showStar ? '' : t('typeAnswer')}
                          aria-describedby={showStar ? 'star-lines' : undefined}
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                        />
                      )}
                      {showStar && <StarGuideLines id="star-lines" />}
                    </div>
                  );
                })()}
                <p className="tiny" style={{ marginTop: '0.4rem' }}>
                  {wordCount} {t('words')}
                </p>
              </div>
            )}

            <div className="record-actions">
              <button
                type="button"
                className="btn btn-record"
                onClick={finishAnswer}
                disabled={isFinalizing}
              >
                {useVoice ? t('stopAndScore') : t('reviewTypedAnswer')}
              </button>
              {useVideo && (
                <p className="tiny video-stays" role="note">{t('videoStaysOnDevice')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- review before scoring ---------- */}
      {stage === 'review' && (
        <div className="stack">
          {previousAnswerRecap}
          <div className="card stack">
            <p className="eyebrow">{starProbe ? t('starProbeEyebrow') : t('transcriptCheckTitle')}</p>
            <h2 style={{ fontSize: '1.2rem' }} dir="auto">{promptText}</h2>
            <p className="tiny muted" style={{ margin: 0 }}>
              {starProbe ? t('starProbeReviewNote') : t('transcriptCheckBody')}
            </p>

            {playbackUrl && (
              <div className="stack-sm">
                <span className="rate-label">{t('watchBack')}</span>
                {playbackIsVideo ? (
                  <video
                    ref={playbackRef}
                    className="playback"
                    src={playbackUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <audio className="playback" src={playbackUrl} controls preload="metadata" />
                )}
                <p className="tiny">{t('watchBackHint')}</p>
              </div>
            )}

            {transcribing ? (
              <div className="notice stack-sm" role="status" aria-live="polite">
                <strong>{t('writingUpWords')}</strong>
                <p className="tiny">{t('writingUpWordsBody')}</p>
                <div className="skeleton-block" aria-hidden="true">
                  <span className="skeleton-line" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line skeleton-line-short" />
                </div>
              </div>
            ) : (
              <>
                {transcriptionFailed && (
                  <p className="notice tiny quiet-notice" role="status">{t('permissionDeniedTypeInstead')}</p>
                )}
                {transcriptCheck}
              </>
            )}
            {scoringError && (
              <div className="notice notice-warn" role="status" aria-live="polite">
                <strong>
                  {scoringError.answerTooLong
                    ? t('scoreAnswerTooLongTitle')
                    : scoringError.timedOut
                      ? t('scoreTimeoutTitle')
                      : t('scoreUnavailableTitle')}
                </strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>
                  {scoringError.answerTooLong
                    ? t('scoreAnswerTooLongBody')
                    : scoringError.timedOut
                      ? t('scoreTimeoutBody')
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
            {!transcribing && transcript.trim().length === 0 && (
              <p className="tiny" role="status">{t('answerRequired')}</p>
            )}
            <div className="row flow-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitForScoring}
                disabled={isScoring || transcribing || transcript.trim().length === 0}
              >
                {isScoring
                  ? liveSitting ? t('preparingNext') : t('scoring')
                  : scoringError
                    ? scoringError.timedOut ? t('retry') : t('retryNow')
                    : liveSitting ? t('confirmAnswer') : t('getFeedback')}
              </button>
              {mode === 'guided' && (
                <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
                  {t('tryAgain')}
                </button>
              )}
              {scoringError && (
                <button type="button" className="btn btn-ghost" onClick={continueWithoutFeedback}>
                  {t('continueWithoutFeedback')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- feedback, arriving ---------- */}
      {stage === 'feedback' && !feedback && streamingFeedback && (
        <div className="stack">
          <StreamingFeedbackCard partial={streamingFeedback} attempt={attemptCount} />
        </div>
      )}

      {/* ---------- feedback ---------- */}
      {stage === 'feedback' && feedback && (
        <div className="stack">
          <FeedbackCard feedback={feedback} attempt={attemptCount} />
          {answers.length === 0 && attemptCount === 1 && practiceSitting && (
            <KeepFeedbackSlot
              roleId={role.id}
              questionId={question.id}
              serverAttemptId={serverAttemptId}
              mode={selectedAnswerMethod}
              lang={interviewLanguage}
            />
          )}
          {previousTry && (
            <AnswerComparison
              firstTranscript={previousTry.transcript}
              firstFeedback={previousTry.feedback}
              newTranscript={transcript}
              newFeedback={feedback}
              lang={interviewLanguage}
              labelFor={(id, fallback) => {
                const competency = role.competencies.find((item) => item.id === id);
                if (!competency) return fallback;
                return interviewLanguage === 'ar' ? competency.labelAr : competency.label;
              }}
            />
          )}
          {/* A worked example only after two attempts, never before. */}
          {attemptCount >= 2 && practiceSitting && !starProbe && (
            <ModelAnswer roleId={role.id} question={question} lang={interviewLanguage} />
          )}
          {starFollowUp && (
            <div className="card stack-sm star-probe-card">
              <p className="eyebrow">{t('starProbeEyebrow')}</p>
              <h3 style={{ fontSize: '1.15rem' }}>{t('starProbeTitle')}</h3>
              <p className="muted">{t('starProbeBody')}</p>
              <p className="star-probe-question" dir="auto">{probeQuestion(starFollowUp, interviewLanguage)}</p>
              <div className="row flow-actions">
                <button type="button" className="btn btn-primary" onClick={startStarProbe}>
                  {t('starProbeAccept')}
                </button>
                <button type="button" className="btn btn-quiet" onClick={skipStarProbe}>
                  {t('starProbeSkip')}
                </button>
              </div>
            </div>
          )}
          <div className="row flow-actions">
            <button type="button" className="btn btn-primary" onClick={advance}>
              {isLast ? t('finishInterview') : t('nextQuestion')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={retryQuestion} disabled={requestingCamera}>
              {requestingCamera ? t('cameraStarting') : t('tryAgainShort')}
            </button>
          </div>
        </div>
      )}

      {/* ---------- results ---------- */}
      {stage === 'done' && reportGateRequired && !reportUnlocked && (
        <div className="stack-lg">
          <div className="card stack">
            <p className="eyebrow">{t('firstResult')}</p>
            <h2>{t('firstFeedbackReady')}</h2>
            <p className="muted">{t('unlockSummary')}</p>
          </div>
          {answers[0] && <div className="stack-sm">
            <p className="eyebrow">{t('question')} 1</p>
            <h3 dir="auto">{answers[0].questionText}</h3>
            <div className="answer-recap"><span className="rate-label">{t('yourAnswer')}</span><p dir="auto">{answers[0].transcript}</p></div>
            <FeedbackCard feedback={answers[0].feedback} />
          </div>}
          {mode === 'guided' && mockQuestions && mockQuestions.length >= 8 && (
            <div className="card stack-sm">
              <h2 style={{ fontSize: '1.3rem' }}>{t('readyForFullMock')}</h2>
              <p className="muted">{t('readyForFullMockBody')}</p>
              <button type="button" className="btn btn-primary" onClick={startFullMock}>
                {t('startFullMock')}
              </button>
            </div>
          )}
          <div className="card stack">
            <h2 style={{ fontSize: '1.3rem' }}>{t('unlockFullReport')}</h2>
            <p className="muted">{t('unlockBody')}</p>
            {serverAttemptId ? (
              <EmailSignIn compact next={`/account/reports/${serverAttemptId}`} />
            ) : (
              <div className="notice notice-warn stack-sm">
                <strong>{t('firstFeedbackReady')}</strong>
                <p className="tiny">{t('accountStorageUnavailable')}</p>
                <button type="button" className="btn btn-quiet" onClick={() => void createServerAttempt()}>{t('retryAccountStorage')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'done' && reportUnlocked && (
        <div className="stack-lg">
          {mode === 'guided' && mockQuestions && mockQuestions.length >= 8 && (
            <div className="card stack-sm">
              <h2 style={{ fontSize: '1.3rem' }}>{t('readyForFullMock')}</h2>
              <p className="muted">{t('readyForFullMockBody')}</p>
              <button type="button" className="btn btn-primary" onClick={startFullMock}>
                {t('startFullMock')}
              </button>
            </div>
          )}
          <div className="card stack">
            <p className="eyebrow">{proof ? t('proofComplete') : t('interviewComplete')}</p>
            {overallFromAnswers(answers) !== null ? (
              <div className="score-head">
                <ScoreRing value={overallFromAnswers(answers) ?? 0} />
                <div>
                  <h2 style={{ fontSize: '1.4rem' }}>
                    {t('overallScore')}: {overallFromAnswers(answers)}/100
                  </h2>
                  <p className="muted" style={{ marginTop: '0.3rem' }}>
                    {proof ? t('proofResultsBody') : t('resultsBody')}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: '1.3rem' }}>{t('noScoreTitle')}</h2>
                <p className="muted" style={{ marginTop: '0.3rem' }}>
                  {proof ? t('proofResultsBody') : t('noScoreBody')}
                </p>
              </div>
            )}
            <p className="report-meta">
              {reportRoleTitle} · {new Date().toLocaleDateString(interviewLanguage === 'ar' ? 'ar-AE' : 'en-GB')}
            </p>
            {saveFailed ? (
              <p className="notice notice-warn tiny" style={{ margin: 0 }}>
                {t('storageBlocked')}
              </p>
            ) : (
              <p className="tiny">{t('savedLocally')}</p>
            )}

            <ReportShareActions
              roleTitle={reportRoleTitle}
              overall={overallFromAnswers(answers)}
              answers={answers}
              proof={Boolean(proof)}
            />
            <p className="tiny no-print">{t('saveReportHint')}</p>
          </div>

          {!proof && (
            <ReadinessSlot
              roleId={role.id}
              feedback={answers.map((answer) => answer.feedback)}
              answers={answers}
              roleTitle={reportRoleTitle}
              lang={interviewLanguage}
            />
          )}

          {(() => {
            // Strongest answer / focus area / next action: computed only from
            // answers the AI actually scored, and only when there are at least
            // two so "strongest" and "focus" are different questions.
            const scored = answers
              .map((a, i) => ({ ...a, index: i }))
              .filter((a) => a.feedback.status === 'scored');
            if (scored.length < 2) return null;
            const best = scored.reduce((a, b) => (b.feedback.score > a.feedback.score ? b : a));
            const worst = scored.reduce((a, b) => (b.feedback.score < a.feedback.score ? b : a));
            if (best.index === worst.index) return null;
            const action = worst.feedback.coachTip || worst.feedback.improvements[0] || null;
            return (
              <div className="card stack-sm">
                <div className="summary-item">
                  <span className="rate-label">{t('strongest')}</span>
                  <p style={{ marginTop: '0.25rem' }}>
                    {t('question')} {best.index + 1} · {best.feedback.score}/100: {best.questionText}
                  </p>
                </div>
                <div className="summary-item">
                  <span className="rate-label">{t('weakest')}</span>
                  <p style={{ marginTop: '0.25rem' }}>
                    {t('question')} {worst.index + 1} · {worst.feedback.score}/100: {worst.questionText}
                  </p>
                </div>
                {action && (
                  <div className="summary-item">
                    <span className="rate-label">{t('nextAction')}</span>
                    <p style={{ marginTop: '0.25rem' }}>{action}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {!proof && savedAttempt && (
            <div className="no-print">
              <RatingCard attempt={savedAttempt} />
            </div>
          )}

          {!proof && <CoachingCard />}

          {answers.map((answer, i) => (
            <div key={`${answer.questionId}-${i}`} className="stack-sm">
              <p className="eyebrow" style={{ marginBottom: 0 }}>
                {t('question')} {i + 1}
              </p>
              <h3 style={{ fontSize: '1.05rem' }} dir="auto">{answer.questionText}</h3>
              {answer.transcript && (
                <div className="answer-recap">
                  <span className="rate-label">{t('yourAnswer')}</span>
                  <p className="muted" style={{ marginTop: '0.25rem' }}>
                    <span dir="auto">{answer.transcript}</span>
                  </p>
                </div>
              )}
              <FeedbackCard feedback={answer.feedback} />
            </div>
          ))}

          {!proof && (
          <div className="row no-print">
            <Link
              href={`/practice/${role.id}`}
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              {t('practiceAgain')}
            </Link>
            <Link href="/practice" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
              {t('tryAnotherRole')}
            </Link>
            <Link href="/progress" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              {t('seeProgress')}
            </Link>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
