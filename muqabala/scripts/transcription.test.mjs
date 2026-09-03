import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { pickAudioMimeType } from '../lib/audio-capture.ts';
import {
  MAX_TRANSCRIPTION_BYTES,
  audioFileExtension,
  validateTranscriptionUpload,
} from '../lib/transcription-upload.ts';
import { ScreeningAnswerSchema, TranscriptSegmentsSchema } from '../lib/interviews.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('pickAudioMimeType prefers Opus in WebM, then Opus in Ogg, then MP4', () => {
  assert.equal(pickAudioMimeType(() => true), 'audio/webm;codecs=opus');
  assert.equal(
    pickAudioMimeType((type) => type !== 'audio/webm;codecs=opus'),
    'audio/ogg;codecs=opus',
  );
  assert.equal(pickAudioMimeType((type) => type === 'audio/mp4'), 'audio/mp4');
});

test('pickAudioMimeType never offers a video container and copes with a throwing probe', () => {
  assert.equal(pickAudioMimeType(() => false), undefined);
  assert.equal(pickAudioMimeType((type) => type.startsWith('video/')), undefined);
  assert.equal(
    pickAudioMimeType((type) => {
      if (type === 'audio/webm;codecs=opus') throw new Error('not implemented');
      return type === 'audio/mp4';
    }),
    'audio/mp4',
  );
});

test('validateTranscriptionUpload accepts the allowed audio containers, with or without codecs', () => {
  for (const type of ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']) {
    const result = validateTranscriptionUpload({ type, size: 1024 });
    assert.equal(result.ok, true, type);
    assert.equal(result.mimeType, type);
  }
  const withCodecs = validateTranscriptionUpload({ type: 'audio/webm;codecs=opus', size: 1024 });
  assert.deepEqual(withCodecs, { ok: true, mimeType: 'audio/webm' });
  const upperCase = validateTranscriptionUpload({ type: 'Audio/OGG; codecs=opus', size: 1024 });
  assert.deepEqual(upperCase, { ok: true, mimeType: 'audio/ogg' });
});

test('validateTranscriptionUpload rejects every video type with 415 and a clear message', () => {
  for (const type of ['video/webm', 'video/mp4', 'video/quicktime', 'video/webm;codecs=vp9,opus']) {
    const result = validateTranscriptionUpload({ type, size: 1024 });
    assert.equal(result.ok, false, type);
    assert.equal(result.status, 415);
    assert.equal(result.code, 'video_rejected');
    assert.match(result.message, /video/i);
    assert.match(result.message, /stays on your device/i);
  }
});

test('validateTranscriptionUpload rejects non-audio and unknown types with 415', () => {
  for (const type of ['text/plain', 'application/octet-stream', 'image/png', 'audio/flac', '', null, undefined]) {
    const result = validateTranscriptionUpload({ type, size: 1024 });
    assert.equal(result.ok, false, String(type));
    assert.equal(result.status, 415);
    assert.equal(result.code, 'unsupported_media_type');
  }
});

test('validateTranscriptionUpload caps the file at 6 MB and refuses empty uploads', () => {
  assert.equal(MAX_TRANSCRIPTION_BYTES, 6 * 1024 * 1024);
  assert.equal(validateTranscriptionUpload({ type: 'audio/webm', size: MAX_TRANSCRIPTION_BYTES }).ok, true);
  const tooLarge = validateTranscriptionUpload({ type: 'audio/webm', size: MAX_TRANSCRIPTION_BYTES + 1 });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.code, 'audio_too_large');

  for (const size of [0, -1, Number.NaN]) {
    const empty = validateTranscriptionUpload({ type: 'audio/webm', size });
    assert.equal(empty.ok, false);
    assert.equal(empty.status, 400);
    assert.equal(empty.code, 'audio_missing');
  }
});

test('video is refused before size is considered, so an oversized video still says video', () => {
  const result = validateTranscriptionUpload({ type: 'video/mp4', size: MAX_TRANSCRIPTION_BYTES * 3 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 415);
  assert.equal(result.code, 'video_rejected');
});

test('audioFileExtension gives the provider an extension it recognises', () => {
  assert.equal(audioFileExtension('audio/webm'), 'webm');
  assert.equal(audioFileExtension('audio/ogg'), 'ogg');
  assert.equal(audioFileExtension('audio/mp4'), 'm4a');
  assert.equal(audioFileExtension('audio/mpeg'), 'mp3');
  assert.equal(audioFileExtension('audio/wav'), 'wav');
});

test('timed transcript segments are ordered, bounded and tied to the recording duration', () => {
  const segments = [
    { id: 'S001', startMs: 250, endMs: 1800, text: 'I checked the room first.' },
    { id: 'S002', startMs: 1850, endMs: 3200, text: 'Then I called the supervisor.' },
  ];
  assert.equal(TranscriptSegmentsSchema.safeParse(segments).success, true);
  assert.equal(TranscriptSegmentsSchema.safeParse([...segments].reverse()).success, false);
  const base = {
    questionIndex: 0,
    transcript: 'I checked the room first. Then I called the supervisor.',
    transcriptSegments: segments,
    transcriptTimingVersion: 'openai-whisper-segment-v1',
    videoPath: 'pack/interview/0-video.webm',
    mimeType: 'video/webm',
    sizeBytes: 1024,
    durationSeconds: 4,
  };
  assert.equal(ScreeningAnswerSchema.safeParse(base).success, true);
  assert.equal(ScreeningAnswerSchema.safeParse({ ...base, transcriptTimingVersion: null }).success, false);
  assert.equal(ScreeningAnswerSchema.safeParse({
    ...base,
    transcriptSegments: [{ ...segments[0], endMs: 8000 }],
  }).success, false);
});

test('employer transcription asks Whisper for segment timestamps without changing practice transcription', () => {
  const route = read('app/api/transcribe/route.ts');
  const flow = read('components/EmployerVideoInterview.tsx');
  assert.match(route, /const TIMED_MODEL = 'whisper-1'/);
  assert.match(route, /response_format: 'verbose_json'/);
  assert.match(route, /timestamp_granularities: \['segment'\]/);
  assert.match(route, /form\.get\('timestamps'\) === 'segment'/);
  assert.match(flow, /form\.append\('timestamps', 'segment'\)/);
  assert.match(flow, /transcriptSegments/);
  assert.match(flow, /transcriptTimingVersion/);
});
