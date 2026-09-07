'use client';

import { useEffect, useRef, useState } from 'react';
import { startAudioCaptureFromStream, type AudioCapture } from '@/lib/audio-capture';
import { startLevelMeter } from '@/lib/media';
import { RecordingPlayback } from './RecordingPlayback';
import styles from './EmployerVideoInterview.module.css';

const COPY = {
  en: {
    title: 'Check your microphone', selected: 'Microphone', unnamed: 'Default microphone',
    prompt: 'Record five seconds of speech, then play it back. This test stays on this device and is not sent to the employer.',
    record: 'Record a five-second test', recording: 'Recording test. Say a short sentence…',
    sound: 'Sound detected. Play the test to check that it is your voice.',
    silent: 'No sound detected yet. Speak near the microphone. Check its mute switch and the microphone selected in your browser or computer settings.',
    unavailable: 'The sound meter is unavailable. Use the playback test to check your microphone.',
    failed: 'We could not record the audio test. Check your microphone settings, then retry camera and microphone.',
    playback: 'Play your microphone test', heard: 'I can hear my voice clearly',
    retry: 'Record another test', waiting: 'Speak to check the sound level.',
  },
  ar: {
    title: 'اختبر الميكروفون', selected: 'الميكروفون', unnamed: 'الميكروفون الافتراضي',
    prompt: 'سجّل كلاماً لمدة خمس ثوانٍ ثم استمع إليه. يبقى الاختبار على هذا الجهاز ولا يُرسل إلى جهة العمل.',
    record: 'تسجيل اختبار لخمس ثوانٍ', recording: 'جارٍ تسجيل الاختبار. قل جملة قصيرة…',
    sound: 'تم رصد صوت. استمع إلى الاختبار للتأكد من أنه صوتك.',
    silent: 'لم يتم رصد صوت بعد. تحدث قرب الميكروفون وتحقق من زر كتم الصوت والميكروفون المحدد في إعدادات المتصفح أو الكمبيوتر.',
    unavailable: 'مؤشر الصوت غير متاح. استمع إلى التسجيل للتحقق من الميكروفون.',
    failed: 'تعذر تسجيل الاختبار الصوتي. تحقق من إعدادات الميكروفون ثم أعد اختبار الكاميرا والميكروفون.',
    playback: 'استمع إلى اختبار الميكروفون', heard: 'أسمع صوتي بوضوح',
    retry: 'تسجيل اختبار آخر', waiting: 'تحدث للتحقق من مستوى الصوت.',
  },
} as const;

export function MicrophoneCheck({ stream, lang, onConfirm }: {
  stream: MediaStream; lang: 'en' | 'ar'; onConfirm: (confirmed: boolean) => void;
}) {
  const c = COPY[lang];
  const [level, setLevel] = useState(0);
  const [heardSound, setHeardSound] = useState(false);
  const [meterAvailable, setMeterAvailable] = useState(true);
  const [waited, setWaited] = useState(false);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [played, setPlayed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const capture = useRef<AudioCapture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const changed = () => { setConfirmed(false); setPlayed(false); setHeardSound(false); onConfirm(false); };
    const tracks = stream.getAudioTracks();
    tracks.forEach(track => { track.addEventListener('ended', changed); track.addEventListener('mute', changed); });
    navigator.mediaDevices?.addEventListener('devicechange', changed);
    const meter = startLevelMeter(stream, value => {
      setLevel(value);
      if (value > 0.04) setHeardSound(true);
    }, () => setMeterAvailable(false));
    if (!meter) setMeterAvailable(false);
    const delay = setTimeout(() => setWaited(true), 4000);
    return () => {
      generation.current++;
      meter?.stop(); clearTimeout(delay);
      if (timer.current) clearTimeout(timer.current);
      capture.current?.discard();
      tracks.forEach(track => { track.removeEventListener('ended', changed); track.removeEventListener('mute', changed); });
      navigator.mediaDevices?.removeEventListener('devicechange', changed);
    };
  }, [stream, onConfirm]);
  const record = () => {
    if (capture.current) return;
    onConfirm(false); setConfirmed(false); setPlayed(false); setHeardSound(false); setBlob(null); setFailed(false);
    const session = startAudioCaptureFromStream(stream);
    if (!session) { setFailed(true); return; }
    capture.current = session; setRecording(true);
    const current = generation.current;
    timer.current = setTimeout(async () => {
      try {
        const result = await session.stop();
        if (current !== generation.current) return;
        setBlob(result); setFailed(!result?.size);
      } catch { if (current === generation.current) setFailed(true); }
      finally {
        if (current === generation.current) { capture.current = null; setRecording(false); }
      }
    }, 5000);
  };
  return <section className={styles.micCheck} aria-labelledby="mic-check-title">
    <h2 id="mic-check-title">{c.title}</h2>
    <p>{c.selected}: {stream.getAudioTracks()[0]?.label || c.unnamed}</p>
    <div className={styles.meter}><span>{c.selected}</span><meter min={0} max={1} value={level} aria-label={c.selected} /></div>
    <p role="status">{!meterAvailable ? c.unavailable : heardSound ? c.sound : waited ? c.silent : c.waiting}</p>
    <p>{c.prompt}</p>
    <button type="button" className={styles.secondary} disabled={recording} onClick={record}>
      {recording ? c.recording : blob ? c.retry : c.record}
    </button>
    {failed && <p role="alert">{c.failed}</p>}
    {blob && <>
      <RecordingPlayback blob={blob} audioOnly label={c.playback} onPlayed={() => setPlayed(true)} />
      <label className={styles.consent}><input type="checkbox" disabled={!played} checked={confirmed}
        onChange={event => { setConfirmed(event.target.checked); onConfirm(event.target.checked); }} />{c.heard}</label>
    </>}
  </section>;
}
