'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/roles';
import { startLevelMeter, startVideoAnswerRecording, type RecordedVideo, type VideoAnswerRecorder } from '@/lib/media';
import { startDictation, type SpeechSession } from '@/lib/speech';
import { uploadScreeningVideo, type ScreeningUploadGrant } from '@/lib/screening-video-upload';
import {
  deleteScreeningRecordingDraft,
  loadScreeningRecordingDraft,
  saveScreeningRecordingDraft,
} from '@/lib/screening-recording-draft';
import { useLang } from './LanguageProvider';
import { EmployerLinkUnavailable } from './EmployerLinkUnavailable';
import styles from './EmployerVideoInterview.module.css';

type Stage = 'resuming' | 'unavailable' | 'intro' | 'device' | 'ready' | 'recording' | 'saving' | 'consent' | 'submitting' | 'complete';

const ANSWER_SECONDS = 120;
const CONSENT_VERSION = 'employer-video-v1' as const;

const COPY = {
  en: {
    invited: 'Employer interview',
    title: 'Show how you would handle the job.',
    intro: 'This is a short video interview. You will answer three questions. Each answer can be up to two minutes.',
    privacy: 'Your video and audio will be shared only with the employer who invited you. Muqabala does not score your face, voice or accent.',
    uploadDisclosure: 'Your name and recordings are uploaded securely as you progress and kept for up to 90 days. The employer cannot open them until you submit the full interview and give consent.',
    transcriptDisclosure: 'Your browser may use its speech service to prepare an automatic transcript. The recording remains the source evidence.',
    name: 'Your name',
    namePlaceholder: 'Enter your full name',
    test: 'Test camera and microphone',
    checking: 'Checking your camera and microphone…',
    readyTitle: 'Camera and microphone are ready',
    readyBody: 'You can see yourself and the sound meter is moving. Your first timed question has not started yet.',
    notReadyTitle: 'Camera and microphone access is needed',
    notReadyBody: 'Open this page in Chrome on Android or Safari on iPhone. In your browser settings, allow Camera and Microphone for trymuqabala.com, then return and retry.',
    noDevice: 'No working camera or microphone was found on this device.',
    deviceBusy: 'Another app may be using your camera or microphone. Close it, then retry.',
    retry: 'Retry camera and microphone',
    startInterview: 'Start interview',
    question: 'Question',
    of: 'of',
    readyQuestion: 'Read the question. The two-minute timer starts when you press record.',
    startRecording: 'Start recording',
    recording: 'Recording',
    sound: 'Microphone level',
    stop: 'Save this response',
    saving: 'Saving your response',
    upload: 'Uploaded',
    keepOpen: 'Keep this page open. A weak connection may take longer, but your recording stays here while we retry.',
    saved: 'Response saved',
    saveFailed: 'Your recording is still on this page, but it has not uploaded yet.',
    retrySave: 'Retry saving response',
    consentTitle: 'Ready to submit',
    consentBody: 'All three video responses are saved. Check the consent box before you send them to the employer.',
    consent: 'I agree to submit my interview responses and video recordings to the employer who invited me. I understand that the employer will use them to review my application.',
    submit: 'Submit to employer',
    submitting: 'Submitting interview…',
    submitFailed: 'The interview was not submitted. Your saved responses are still here. Please try again.',
    completeTitle: 'Your interview has been submitted successfully.',
    completeBody: 'The employer will review your responses and contact you directly if there is a next step.',
    close: 'You may now close this page.',
    genericError: 'Something went wrong. Please try again.',
    unsupported: 'This browser cannot record video and audio. Open the link in Chrome on Android or Safari on iPhone.',
    employerReview: 'The hiring team will review your recordings. You will not see scores or analysis in this interview.',
    checkingProgress: 'Checking for a saved interview…',
    resumeFound: 'Your saved progress is ready. Test your camera and microphone to continue.',
    recoveredRecording: 'We recovered a response that had not finished uploading. Retry saving it now.',
  },
  ar: {
    invited: 'مقابلة من جهة العمل',
    title: 'أظهر كيف ستتعامل مع مهام الوظيفة.',
    intro: 'هذه مقابلة فيديو قصيرة. ستجيب عن ثلاثة أسئلة. لديك دقيقتان كحد أقصى لكل إجابة.',
    privacy: 'سيتم إرسال الفيديو والصوت فقط إلى جهة العمل التي دعتك. لا تقيّم مقابلة وجهك أو صوتك أو لهجتك.',
    uploadDisclosure: 'يتم رفع اسمك وتسجيلاتك بشكل آمن أثناء تقدمك والاحتفاظ بها لمدة تصل إلى 90 يوماً. لا تستطيع جهة العمل فتحها حتى ترسل المقابلة كاملة وتوافق على الإقرار.',
    transcriptDisclosure: 'قد يستخدم متصفحك خدمة تحويل الكلام إلى نص لإعداد نص تلقائي. يظل التسجيل هو الدليل الأساسي.',
    name: 'اسمك',
    namePlaceholder: 'أدخل اسمك الكامل',
    test: 'اختبار الكاميرا والميكروفون',
    checking: 'جارٍ فحص الكاميرا والميكروفون…',
    readyTitle: 'الكاميرا والميكروفون جاهزان',
    readyBody: 'يمكنك رؤية نفسك ومؤشر الصوت يتحرك. لم يبدأ السؤال الأول بعد.',
    notReadyTitle: 'نحتاج إلى إذن الكاميرا والميكروفون',
    notReadyBody: 'افتح الصفحة في Chrome على Android أو Safari على iPhone. اسمح للكاميرا والميكروفون لموقع trymuqabala.com من إعدادات المتصفح، ثم عد وحاول مرة أخرى.',
    noDevice: 'لم يتم العثور على كاميرا وميكروفون يعملان على هذا الجهاز.',
    deviceBusy: 'قد يكون تطبيق آخر يستخدم الكاميرا أو الميكروفون. أغلقه ثم حاول مرة أخرى.',
    retry: 'إعادة اختبار الكاميرا والميكروفون',
    startInterview: 'بدء المقابلة',
    question: 'السؤال',
    of: 'من',
    readyQuestion: 'اقرأ السؤال. يبدأ عد الدقيقتين عند الضغط على زر التسجيل.',
    startRecording: 'بدء التسجيل',
    recording: 'جارٍ التسجيل',
    sound: 'مستوى الميكروفون',
    stop: 'حفظ هذه الإجابة',
    saving: 'جارٍ حفظ إجابتك',
    upload: 'تم الرفع',
    keepOpen: 'أبقِ هذه الصفحة مفتوحة. قد يستغرق الاتصال الضعيف وقتاً أطول، لكن التسجيل يبقى هنا أثناء إعادة المحاولة.',
    saved: 'تم حفظ الإجابة',
    saveFailed: 'لا يزال تسجيلك موجوداً في هذه الصفحة، لكنه لم يُرفع بعد.',
    retrySave: 'إعادة محاولة حفظ الإجابة',
    consentTitle: 'جاهز للإرسال',
    consentBody: 'تم حفظ إجابات الفيديو الثلاث. وافق على الإقرار قبل إرسالها إلى جهة العمل.',
    consent: 'أوافق على إرسال إجاباتي وتسجيلات الفيديو إلى جهة العمل التي دعتني. وأفهم أن جهة العمل ستستخدمها لمراجعة طلبي.',
    submit: 'إرسال إلى جهة العمل',
    submitting: 'جارٍ إرسال المقابلة…',
    submitFailed: 'لم يتم إرسال المقابلة. إجاباتك المحفوظة ما زالت موجودة. حاول مرة أخرى.',
    completeTitle: 'تم إرسال مقابلتك بنجاح.',
    completeBody: 'ستراجع جهة العمل إجاباتك وتتواصل معك مباشرة إذا كانت هناك خطوة تالية.',
    close: 'يمكنك الآن إغلاق هذه الصفحة.',
    genericError: 'حدث خطأ. حاول مرة أخرى.',
    unsupported: 'هذا المتصفح لا يستطيع تسجيل الفيديو والصوت. افتح الرابط في Chrome على Android أو Safari على iPhone.',
    employerReview: 'سيراجع فريق التوظيف تسجيلاتك. لن تظهر لك درجات أو تحليلات في هذه المقابلة.',
    checkingProgress: 'جارٍ البحث عن مقابلة محفوظة…',
    resumeFound: 'تم العثور على تقدمك المحفوظ. اختبر الكاميرا والميكروفون للمتابعة.',
    recoveredRecording: 'استعدنا إجابة لم يكتمل رفعها. أعد محاولة حفظها الآن.',
  },
} as const;

type Props = {
  role: Role;
  interviewToken: string;
  companyName: string;
  recruiterName?: string;
  publicCode: string;
  availability?: 'active' | 'full';
};

function formatTime(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function permissionHelp(error: unknown, fallback: string, noDevice: string, deviceBusy: string): string {
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return noDevice;
  }
  if (error instanceof DOMException && error.name === 'NotReadableError') {
    return deviceBusy;
  }
  return fallback;
}

function browserStartKey(publicCode: string): string | null {
  try {
    const storageKey = `muqabala.screening.start.${publicCode}`;
    const existing = window.localStorage.getItem(storageKey);
    if (existing && /^[A-Za-z0-9_-]{40,60}$/.test(existing)) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const created = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return null;
  }
}

export function EmployerVideoInterview({
  role,
  interviewToken,
  companyName,
  recruiterName,
  publicCode,
  availability = 'active',
}: Props) {
  const { lang, setLang, dir } = useLang();
  const c = COPY[lang];
  const [stage, setStage] = useState<Stage>('resuming');
  const [candidateName, setCandidateName] = useState('');
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ANSWER_SECONDS);
  const [micLevel, setMicLevel] = useState(0);
  const [devicesReady, setDevicesReady] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pending, setPending] = useState<{ recording: RecordedVideo; transcript: string; questionIndex: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<VideoAnswerRecorder | null>(null);
  const meterRef = useRef<ReturnType<typeof startLevelMeter> | null>(null);
  const speechRef = useRef<SpeechSession | null>(null);
  const transcriptRef = useRef('');
  const finishingRef = useRef(false);
  const startKeyRef = useRef<string | null>(null);

  const questions = role.questions;
  const question = questions[index];
  const questionText = lang === 'ar' ? question?.textAr : question?.text;
  const progress = questions.length ? Math.round((savedCount / questions.length) * 100) : 0;

  useEffect(() => {
    let cancelled = false;
    const startKey = browserStartKey(publicCode);
    startKeyRef.current = startKey;
    void fetch('/api/screening/resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(startKey ? { 'Idempotency-Key': startKey } : {}),
      },
      body: JSON.stringify({ publicCode }),
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then(async (body) => {
        if (cancelled) return;
        const resumed = body?.resume as {
          id?: string;
          candidateName?: string;
          currentQuestion?: number;
          complete?: boolean;
        } | null | undefined;
        if (!resumed?.id) {
          setStage(availability === 'full' ? 'unavailable' : 'intro');
          return;
        }
        setInterviewId(resumed.id);
        setCandidateName(resumed.candidateName || '');
        const nextIndex = Math.max(0, Math.min(questions.length - 1, resumed.currentQuestion ?? 0));
        setIndex(nextIndex);
        setSavedCount(Math.max(0, Math.min(questions.length, resumed.currentQuestion ?? 0)));
        if (resumed.complete) {
          await deleteScreeningRecordingDraft(resumed.id);
          setStage('complete');
          return;
        }
        const recovered = await loadScreeningRecordingDraft(resumed.id);
        if (recovered && recovered.questionIndex === nextIndex) {
          setPending({
            recording: recovered.recording,
            transcript: recovered.transcript,
            questionIndex: recovered.questionIndex,
          });
          setError(c.recoveredRecording);
          setStage('saving');
          return;
        }
        setError(c.resumeFound);
        setStage(resumed.currentQuestion && resumed.currentQuestion >= questions.length ? 'consent' : 'intro');
      })
      .catch(() => {
        if (!cancelled) setStage(availability === 'full' ? 'unavailable' : 'intro');
      });
    return () => { cancelled = true; };
  }, [availability, c.recoveredRecording, c.resumeFound, publicCode, questions.length]);

  const attachPreview = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    await videoRef.current.play().catch(() => {});
  }, []);

  useEffect(() => {
    void attachPreview();
  }, [attachPreview, stage]);

  const stopDevices = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    meterRef.current?.stop();
    meterRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicLevel(0);
    setDevicesReady(false);
  }, []);

  useEffect(() => () => stopDevices(), [stopDevices]);

  useEffect(() => {
    const active = Boolean(interviewId && stage !== 'complete');
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [interviewId, stage]);

  const testDevices = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(c.unsupported);
      return;
    }
    setStage('device');
    stopDevices();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 960 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const videoLive = stream.getVideoTracks().some((track) => track.readyState === 'live');
      const audioLive = stream.getAudioTracks().some((track) => track.readyState === 'live');
      if (!videoLive || !audioLive) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException('Missing camera or microphone', 'NotFoundError');
      }
      streamRef.current = stream;
      setDevicesReady(true);
      meterRef.current = startLevelMeter(stream, setMicLevel);
      await attachPreview();
    } catch (caught) {
      setError(permissionHelp(caught, c.notReadyBody, c.noDevice, c.deviceBusy));
    }
  }, [attachPreview, c.deviceBusy, c.noDevice, c.notReadyBody, c.unsupported, stopDevices]);

  const createInterview = useCallback(async () => {
    if (!candidateName.trim() || !streamRef.current) return;
    if (interviewId) {
      setError('');
      setStage('ready');
      return;
    }
    setError('');
    try {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(startKeyRef.current ? { 'Idempotency-Key': startKeyRef.current } : {}),
        },
        body: JSON.stringify({
          roleId: role.id,
          roleTitle: role.title,
          language: lang,
          mode: 'screening',
          questions: questions.map(({ id, text, textAr, competencies, hint, hintAr, prepSeconds }) => ({
            id,
            text,
            textAr,
            competencies,
            hint,
            hintAr,
            prepSeconds,
            answerSeconds: ANSWER_SECONDS,
          })),
          interviewToken,
          candidateName: candidateName.trim(),
        }),
      });
      const body = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error || c.genericError);
      setInterviewId(body.id);
      setStage('ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : c.genericError);
    }
  }, [c.genericError, candidateName, interviewId, interviewToken, lang, questions, role.id, role.title]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream
      || !stream.getVideoTracks().some((track) => track.readyState === 'live')
      || !stream.getAudioTracks().some((track) => track.readyState === 'live')) {
      setError(c.notReadyBody);
      setStage('device');
      return;
    }
    const recorder = startVideoAnswerRecording(stream);
    if (!recorder) {
      setError(c.unsupported);
      setStage('device');
      return;
    }
    transcriptRef.current = '';
    const speech = startDictation(
      lang === 'ar' ? 'ar-AE' : 'en-US',
      (finalText, interimText) => {
        transcriptRef.current = [finalText.trim(), interimText.trim()].filter(Boolean).join(' ');
      },
      () => {
        // The video remains the source evidence. An unavailable browser
        // transcript must never stop or invalidate a recorded answer.
      },
    );
    speechRef.current = speech;
    recorderRef.current = recorder;
    setSecondsLeft(ANSWER_SECONDS);
    setError('');
    setStage('recording');
  }, [c.notReadyBody, c.unsupported, lang]);

  const scoreInBackground = useCallback((savedIndex: number, transcript: string) => {
    if (!interviewId || !transcript.trim()) return;
    const savedQuestion = questions[savedIndex];
    void fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Scoring-Session': `${interviewId}-${savedIndex}` },
      body: JSON.stringify({
        roleId: role.id,
        questionId: savedQuestion.id,
        transcript: transcript.trim(),
        lang,
        roleTitle: role.title,
        interviewToken,
        interviewId,
        questionIndex: savedIndex,
      }),
    }).catch(() => {});
  }, [interviewId, interviewToken, lang, questions, role.id, role.title]);

  const savePending = useCallback(async (toSave: { recording: RecordedVideo; transcript: string; questionIndex: number }) => {
    if (!interviewId) return;
    setStage('saving');
    setError('');
    setUploadProgress(0);
    try {
      if (toSave.recording.blob.size > 50 * 1024 * 1024) {
        throw new Error('This recording is too large to upload. Please record the answer again.');
      }
      const grantResponse = await fetch(`/api/screening/interviews/${interviewId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex: toSave.questionIndex, mimeType: toSave.recording.mimeType }),
      });
      const grantBody = await grantResponse.json().catch(() => ({})) as ScreeningUploadGrant & { error?: string };
      if (!grantResponse.ok || !grantBody.path || !grantBody.token) {
        throw new Error(grantBody.error || c.genericError);
      }
      await uploadScreeningVideo(grantBody, toSave.recording.blob, toSave.recording.mimeType, setUploadProgress);

      const saveResponse = await fetch(`/api/screening/interviews/${interviewId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: toSave.questionIndex,
          transcript: toSave.transcript,
          videoPath: grantBody.path,
          mimeType: toSave.recording.mimeType,
          sizeBytes: toSave.recording.blob.size,
          durationSeconds: toSave.recording.durationSeconds,
        }),
      });
      const savedBody = await saveResponse.json().catch(() => ({})) as { error?: string };
      if (!saveResponse.ok) throw new Error(savedBody.error || c.genericError);

      const savedIndex = toSave.questionIndex;
      scoreInBackground(savedIndex, toSave.transcript);
      await deleteScreeningRecordingDraft(interviewId);
      setPending(null);
      setSavedCount(savedIndex + 1);
      setUploadProgress(100);
      window.setTimeout(() => {
        if (savedIndex >= questions.length - 1) {
          setStage('consent');
        } else {
          setIndex(savedIndex + 1);
          setStage('ready');
        }
      }, 700);
    } catch (caught) {
      setPending(toSave);
      setError(caught instanceof Error ? caught.message : c.genericError);
    }
  }, [c.genericError, interviewId, questions.length, scoreInBackground]);

  const finishRecording = useCallback(async () => {
    if (finishingRef.current || stage !== 'recording') return;
    finishingRef.current = true;
    speechRef.current?.stop();
    speechRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setStage('saving');
    try {
      const recording = await recorder?.stop();
      if (!recording) throw new Error(c.genericError);
      const captured = { recording, transcript: transcriptRef.current.trim(), questionIndex: index };
      setPending(captured);
      await saveScreeningRecordingDraft({ interviewId: interviewId!, ...captured });
      await savePending(captured);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : c.genericError);
    } finally {
      finishingRef.current = false;
    }
  }, [c.genericError, index, interviewId, savePending, stage]);

  useEffect(() => {
    if (stage !== 'recording') return;
    if (secondsLeft <= 0) {
      void finishRecording();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [finishRecording, secondsLeft, stage]);

  useEffect(() => {
    if (stage !== 'recording') return;
    const stream = streamRef.current;
    if (!stream) return;
    const ended = () => void finishRecording();
    stream.getTracks().forEach((track) => track.addEventListener('ended', ended, { once: true }));
    return () => stream.getTracks().forEach((track) => track.removeEventListener('ended', ended));
  }, [finishRecording, stage]);

  const submitInterview = useCallback(async () => {
    if (!consent || !interviewId) return;
    setStage('submitting');
    setError('');
    try {
      const response = await fetch(`/api/screening/interviews/${interviewId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, consentVersion: CONSENT_VERSION }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || c.submitFailed);
      stopDevices();
      await deleteScreeningRecordingDraft(interviewId);
      setStage('complete');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : c.submitFailed);
      setStage('consent');
    }
  }, [c.submitFailed, consent, interviewId, stopDevices]);

  if (stage === 'unavailable') return <EmployerLinkUnavailable reason="full" />;

  return (
    <main className={styles.page} dir={dir}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Muqabala home">
          <span className={styles.mark} aria-hidden="true">م</span>
          <span>Muqabala</span>
        </a>
        <button type="button" className={styles.language} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </header>

      <div className={styles.shell}>
        <div className={styles.context}>
          <span>{c.invited}</span>
          <strong dir="auto">{companyName}</strong>
          <span aria-hidden="true">·</span>
          <strong dir="auto">{lang === 'ar' ? role.titleAr : role.title}</strong>
        </div>

        {stage === 'resuming' && (
          <section className={styles.card} aria-live="polite">
            <p className={styles.eyebrow}>{c.invited}</p>
            <h1>{c.checkingProgress}</h1>
          </section>
        )}

        {interviewId && stage !== 'complete' && (
          <div className={styles.progressWrap}>
            <div className={styles.progressMeta}>
              <span>{c.question} {Math.min(index + 1, questions.length)} {c.of} {questions.length}</span>
              <span>{progress}%</span>
            </div>
            <div className={styles.progress} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          </div>
        )}

        {stage === 'intro' && (
          <section className={styles.card} aria-labelledby="video-interview-title">
            <p className={styles.eyebrow}>{recruiterName ? `${recruiterName} · ${companyName}` : companyName}</p>
            <h1 id="video-interview-title">{c.title}</h1>
            <p className={styles.lede}>{c.intro}</p>
            {error && <div className={styles.savedBanner} role="status">{error}</div>}
            <div className={styles.assurance}>{c.privacy}</div>
            <p className={styles.footnote}>{c.uploadDisclosure}</p>
            <p className={styles.footnote}>{c.transcriptDisclosure}</p>
            <label className={styles.field}>
              <span>{c.name}</span>
              <input
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                minLength={2}
                maxLength={100}
                autoComplete="name"
                placeholder={c.namePlaceholder}
                required
              />
            </label>
            <button type="button" className={styles.primary} disabled={candidateName.trim().length < 2} onClick={() => void testDevices()}>
              {c.test}
            </button>
            <p className={styles.footnote}>{c.employerReview}</p>
          </section>
        )}

        {stage === 'device' && (
          <section className={styles.card} aria-labelledby="device-title">
            <p className={styles.eyebrow}>{error ? c.notReadyTitle : c.checking}</p>
            <h1 id="device-title">{error ? c.notReadyTitle : c.readyTitle}</h1>
            <div className={styles.previewFrame}>
              <video ref={videoRef} muted playsInline autoPlay />
              {!devicesReady && !error && <span>{c.checking}</span>}
            </div>
            {devicesReady && !error && (
              <>
                <div className={styles.meter} aria-label={c.sound}>
                  <span>{c.sound}</span>
                  <i><b style={{ width: `${Math.max(5, Math.round(micLevel * 100))}%` }} /></i>
                </div>
                <p>{c.readyBody}</p>
                <button type="button" className={styles.primary} onClick={() => void createInterview()}>{c.startInterview}</button>
              </>
            )}
            {error && (
              <>
                <div className={styles.error} role="alert"><strong>{c.notReadyTitle}</strong><p>{error}</p></div>
                <button type="button" className={styles.primary} onClick={() => void testDevices()}>{c.retry}</button>
              </>
            )}
          </section>
        )}

        {stage === 'ready' && question && (
          <section className={styles.card} aria-labelledby="question-title">
            {savedCount > 0 && <div className={styles.savedBanner} role="status">✓ {c.saved}</div>}
            <p className={styles.eyebrow}>{c.question} {index + 1} {c.of} {questions.length}</p>
            <h1 id="question-title" dir="auto">{questionText}</h1>
            <p>{c.readyQuestion}</p>
            <div className={styles.previewFrame}><video ref={videoRef} muted playsInline autoPlay /></div>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button type="button" className={styles.primary} onClick={startRecording}>{c.startRecording}</button>
          </section>
        )}

        {stage === 'recording' && question && (
          <section className={`${styles.card} ${styles.recordingCard}`} aria-labelledby="active-question-title">
            <div className={styles.recordingHead}>
              <span className={styles.live}><i /> {c.recording}</span>
              <time aria-live="polite" className={secondsLeft <= 20 ? styles.timeUrgent : ''}>{formatTime(secondsLeft)}</time>
            </div>
            <p className={styles.eyebrow}>{c.question} {index + 1} {c.of} {questions.length}</p>
            <h1 id="active-question-title" dir="auto">{questionText}</h1>
            <div className={styles.previewFrame}><video ref={videoRef} muted playsInline autoPlay /></div>
            <div className={styles.meter} aria-label={c.sound}>
              <span>{c.sound}</span>
              <i><b style={{ width: `${Math.max(5, Math.round(micLevel * 100))}%` }} /></i>
            </div>
            <button type="button" className={styles.primary} onClick={() => void finishRecording()}>{c.stop}</button>
          </section>
        )}

        {stage === 'saving' && (
          <section className={styles.card} aria-labelledby="saving-title">
            <p className={styles.eyebrow}>{error ? c.saveFailed : c.saving}</p>
            <h1 id="saving-title">{error ? c.saveFailed : `${c.saving}…`}</h1>
            {!error && (
              <div className={styles.upload}>
                <span style={{ width: `${uploadProgress}%` }} />
                <strong>{c.upload}: {uploadProgress}%</strong>
              </div>
            )}
            <p>{c.keepOpen}</p>
            {error && <div className={styles.error} role="alert">{error}</div>}
            {error && pending && (
              <button type="button" className={styles.primary} onClick={() => void savePending(pending)}>{c.retrySave}</button>
            )}
          </section>
        )}

        {(stage === 'consent' || stage === 'submitting') && (
          <section className={styles.card} aria-labelledby="consent-title">
            <div className={styles.savedBanner}>✓ {questions.length} {c.of} {questions.length} {c.saved}</div>
            <p className={styles.eyebrow}>{c.consentTitle}</p>
            <h1 id="consent-title">{c.consentTitle}</h1>
            <p>{c.consentBody}</p>
            <label className={styles.consent}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>{c.consent}</span>
            </label>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button
              type="button"
              className={styles.primary}
              disabled={!consent || stage === 'submitting'}
              onClick={() => void submitInterview()}
            >
              {stage === 'submitting' ? c.submitting : c.submit}
            </button>
          </section>
        )}

        {stage === 'complete' && (
          <section className={`${styles.card} ${styles.complete}`} aria-labelledby="complete-title">
            <span className={styles.completeMark} aria-hidden="true">✓</span>
            <p className={styles.eyebrow}>{companyName}</p>
            <h1 id="complete-title">{c.completeTitle}</h1>
            <p className={styles.lede}>{c.completeBody}</p>
            <p className={styles.footnote}>{c.close}</p>
          </section>
        )}
      </div>
    </main>
  );
}
