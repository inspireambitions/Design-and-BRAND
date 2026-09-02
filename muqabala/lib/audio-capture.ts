'use client';

/**
 * Audio-only capture for the transcription fallback.
 *
 * Used only when the browser has no Web Speech API. The stream is requested
 * with `video: false`, so no camera frame can ever enter this recorder. Chunks
 * live in memory for the length of one answer and are released by `discard()`.
 * Nothing here touches IndexedDB, localStorage or any other storage.
 */

/** Ordered by size at a given quality; Opus first, MP4 (AAC) for Safari. */
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
] as const;

/** Speech is intelligible to transcription models well below this rate. */
const AUDIO_BITS_PER_SECOND = 24_000;

/**
 * Picks the first container the browser can record. Pure so it can be tested
 * without a `MediaRecorder`; `isTypeSupported` may throw on odd browsers and
 * that counts as unsupported.
 */
export function pickAudioMimeType(
  isTypeSupported: (type: string) => boolean,
): string | undefined {
  return AUDIO_MIME_CANDIDATES.find((type) => {
    try {
      return isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

export type AudioCapture = {
  /** Container type the recorder actually chose, for the upload's content type. */
  mimeType: string;
  pause: () => void;
  resume: () => void;
  /** Stops recording and resolves with the audio, or null when nothing was captured. */
  stop: () => Promise<Blob | null>;
  /** Stops recording, drops every chunk and releases the microphone. */
  discard: () => void;
};

export function isAudioCaptureSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

function createAudioCapture(stream: MediaStream, releaseTracks: boolean): AudioCapture | null {
  if (!stream.getAudioTracks().some((track) => track.readyState === 'live')) return null;

  const mimeType = pickAudioMimeType((type) => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })
      : new MediaRecorder(stream, { audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
  } catch {
    if (releaseTracks) stream.getTracks().forEach((track) => track.stop());
    return null;
  }

  let chunks: BlobPart[] = [];
  let discarded = false;
  recorder.ondataavailable = (event) => {
    if (!discarded && event.data?.size) chunks.push(event.data);
  };

  const releaseStream = () => {
    if (releaseTracks) stream.getTracks().forEach((track) => track.stop());
  };

  try {
    recorder.start(1000);
  } catch {
    releaseStream();
    return null;
  }

  const resolvedType = recorder.mimeType || mimeType || 'audio/webm';

  return {
    mimeType: resolvedType,
    pause: () => {
      try {
        if (recorder.state === 'recording') recorder.pause();
      } catch {
        /* the timer still pauses even when this browser cannot pause media */
      }
    },
    resume: () => {
      try {
        if (recorder.state === 'paused') recorder.resume();
      } catch {
        /* best effort; the candidate can still edit the written words */
      }
    },
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        if (discarded) {
          resolve(null);
          return;
        }
        const finish = () => {
          releaseStream();
          if (discarded || chunks.length === 0) {
            chunks = [];
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, { type: resolvedType });
          chunks = [];
          resolve(blob);
        };
        if (recorder.state === 'inactive') {
          finish();
          return;
        }
        recorder.onstop = finish;
        try {
          recorder.requestData();
          recorder.stop();
        } catch {
          finish();
        }
      }),
    discard: () => {
      discarded = true;
      chunks = [];
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        /* already stopped */
      }
      releaseStream();
    },
  };
}

/**
 * Records the audio track from an existing camera stream. The source tracks
 * remain owned by the caller, so stopping this recorder never turns off the
 * preview. This avoids a second permission prompt during a video answer.
 */
export function startAudioCaptureFromStream(source: MediaStream): AudioCapture | null {
  if (!isAudioCaptureSupported()) return null;
  const audioTracks = source.getAudioTracks().filter((track) => track.readyState === 'live');
  if (audioTracks.length === 0) return null;
  return createAudioCapture(new MediaStream(audioTracks), false);
}

/**
 * Opens a microphone-only stream and starts recording it. Resolves null when
 * the microphone was refused or the browser cannot record audio; the caller
 * then falls back to typing.
 */
export async function startAudioCapture(): Promise<AudioCapture | null> {
  if (!isAudioCaptureSupported()) return null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    return null;
  }
  // Belt and braces: even a misbehaving browser must not hand us a camera.
  if (stream.getVideoTracks().length > 0) {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }
  return createAudioCapture(stream, true);
}
