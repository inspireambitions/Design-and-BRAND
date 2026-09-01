/**
 * Validation shared by the transcription endpoint and its tests.
 *
 * Candidate practice video never leaves the device. The audio fallback only
 * exists so a browser without live captions can still write up spoken words,
 * so this module accepts a short list of audio containers and nothing else.
 * Anything that looks like video is refused before a single byte is read.
 */

/** 6 MB of Opus at 24 kbps is well over ten minutes, far past any answer timer. */
export const MAX_TRANSCRIPTION_BYTES = 6 * 1024 * 1024;

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
] as const;

export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

export type TranscriptionUploadCheck =
  | { ok: true; mimeType: AllowedAudioMimeType }
  | {
      ok: false;
      status: 400 | 413 | 415;
      code: 'audio_missing' | 'audio_too_large' | 'video_rejected' | 'unsupported_media_type';
      message: string;
    };

/** Strips codec parameters so `audio/webm;codecs=opus` compares as `audio/webm`. */
export function baseMimeType(value: string | null | undefined): string {
  return (value ?? '').split(';')[0].trim().toLowerCase();
}

export function validateTranscriptionUpload(input: {
  type: string | null | undefined;
  size: number;
}): TranscriptionUploadCheck {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return {
      ok: false,
      status: 400,
      code: 'audio_missing',
      message: 'An audio recording is required.',
    };
  }
  const base = baseMimeType(input.type);
  if (base.startsWith('video/')) {
    return {
      ok: false,
      status: 415,
      code: 'video_rejected',
      message: 'Video is never accepted. Practice video stays on your device; only audio can be written up.',
    };
  }
  const mimeType = ALLOWED_AUDIO_MIME_TYPES.find((allowed) => allowed === base);
  if (!mimeType) {
    return {
      ok: false,
      status: 415,
      code: 'unsupported_media_type',
      message: 'Only audio recordings (webm, ogg, mp4, mpeg or wav) can be written up.',
    };
  }
  if (input.size > MAX_TRANSCRIPTION_BYTES) {
    return {
      ok: false,
      status: 413,
      code: 'audio_too_large',
      message: 'That recording is too long to write up. Please keep answers under the timer.',
    };
  }
  return { ok: true, mimeType };
}

/** File extension the transcription provider expects for a given container. */
export function audioFileExtension(mimeType: AllowedAudioMimeType): string {
  switch (mimeType) {
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
      return 'wav';
  }
}
