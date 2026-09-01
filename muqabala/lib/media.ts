'use client';

/**
 * Recording and microphone-level helpers.
 *
 * The private practice flow keeps its recording blobs on the device. The
 * employer flow uses the blob-returning helper below and uploads only after the
 * candidate has been shown the employer-specific disclosure.
 */

/** Picks a container the browser can actually record: Safari differs from Chrome. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

export function isRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export type AnswerRecorder = {
  pause: () => void;
  resume: () => void;
  /** Resolves with a playable object URL, or null when recording was not possible. */
  stop: () => Promise<string | null>;
};

export type RecordedVideo = {
  blob: Blob;
  mimeType: 'video/webm' | 'video/mp4' | 'video/quicktime';
  durationSeconds: number;
};

export type VideoAnswerRecorder = {
  stop: () => Promise<RecordedVideo | null>;
};

function baseVideoMimeType(value: string | undefined): RecordedVideo['mimeType'] {
  const base = (value || '').split(';')[0].trim().toLowerCase();
  if (base === 'video/mp4') return 'video/mp4';
  if (base === 'video/quicktime') return 'video/quicktime';
  return 'video/webm';
}

/**
 * Captures a bounded employer response as a Blob. A one-second timeslice makes
 * the final chunk more reliable on mobile browsers when the timer stops the
 * recorder automatically.
 */
export function startVideoAnswerRecording(stream: MediaStream): VideoAnswerRecorder | null {
  if (!isRecordingSupported()) return null;
  const selectedMimeType = pickMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = selectedMimeType
      ? new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 650_000,
          audioBitsPerSecond: 64_000,
        })
      : new MediaRecorder(stream, {
          videoBitsPerSecond: 650_000,
          audioBitsPerSecond: 64_000,
        });
  } catch {
    return null;
  }

  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  try {
    recorder.start(1000);
  } catch {
    return null;
  }

  return {
    stop: () => new Promise<RecordedVideo | null>((resolve) => {
      if (recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        const mimeType = baseVideoMimeType(recorder.mimeType || selectedMimeType);
        resolve({
          blob: new Blob(chunks, { type: mimeType }),
          mimeType,
          durationSeconds: Math.max(1, Math.min(120, Math.ceil((Date.now() - startedAt) / 1000))),
        });
      };
      try {
        recorder.requestData();
        recorder.stop();
      } catch {
        resolve(null);
      }
    }),
  };
}

export function startRecording(stream: MediaStream): AnswerRecorder | null {
  if (!isRecordingSupported()) return null;

  const mimeType = pickMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    return null;
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  try {
    recorder.start();
  } catch {
    return null;
  }

  return {
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
        /* recording support is best effort; transcript remains editable */
      }
    },
    stop: () =>
      new Promise<string | null>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          resolve(URL.createObjectURL(blob));
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      }),
  };
}

export type LevelMeter = {
  stop: () => void;
};

/**
 * Reports microphone loudness as 0-1, so the candidate can see that they are
 * actually being heard. Purely a reassurance signal: it is never recorded,
 * never scored, and never leaves the component.
 */
export function startLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
  onUnavailable?: () => void,
): LevelMeter | null {
  const AudioCtx =
    typeof window === 'undefined'
      ? undefined
      : window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  let context: AudioContext;
  try {
    context = new AudioCtx();
  } catch {
    return null;
  }

  let frame = 0;
  let stopped = false;

  // iOS creates the context suspended when construction happens outside a user
  // gesture (our prep countdown auto-advances into recording). A suspended
  // context reports silence forever: which the UI would phrase as "we cannot
  // hear you" to someone speaking normally. Resume it, and if it never starts,
  // say so via the callback so the meter is hidden instead of accusing.
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }
  setTimeout(() => {
    if (!stopped && context.state !== 'running') {
      onUnavailable?.();
    }
  }, 2000);

  try {
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(data);
      // Root mean square over the spectrum, scaled so ordinary speech sits high
      // enough to read at a glance without pinning the meter.
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length) / 255;
      onLevel(Math.min(1, rms * 3.2));
      frame = requestAnimationFrame(tick);
    };
    tick();
  } catch {
    context.close().catch(() => {});
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(frame);
      context.close().catch(() => {});
      onLevel(0);
    },
  };
}
