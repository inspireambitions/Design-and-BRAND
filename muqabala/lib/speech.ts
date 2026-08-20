'use client';

/** Minimal typings for the Web Speech API, which TypeScript's DOM lib does not ship. */
type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /**
   * Chrome 139+. When true, recognition runs on the device instead of being
   * sent to the browser vendor's speech service. Undefined elsewhere.
   */
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = (new () => SpeechRecognitionLike) & {
  /** Chrome 139+ availability probe for on-device recognition. */
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
};

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getConstructor() !== null;
}

/**
 * Whether speech can be recognised entirely on the device.
 *
 * This matters for what we are allowed to tell candidates. Browser speech
 * recognition sends audio to the browser vendor's speech service unless
 * on-device processing is explicitly requested and confirmed available.
 * We only return true when the browser positively confirms it — an
 * unknown answer is treated as "audio leaves the device", never the reverse.
 */
export async function isOnDeviceRecognitionAvailable(langCode: string): Promise<boolean> {
  const Ctor = getConstructor();
  if (!Ctor?.available) return false;
  try {
    const status = await Ctor.available({ langs: [langCode], processLocally: true });
    return status === 'available';
  } catch {
    return false;
  }
}

export type SpeechSession = {
  stop: () => void;
};

/**
 * Starts live dictation. `onUpdate` receives the confirmed transcript so far plus
 * whatever is still being spoken, so the UI can show words appearing in real time.
 */
export function startDictation(
  langCode: string,
  onUpdate: (finalText: string, interimText: string) => void,
  onError?: (error: string) => void,
): SpeechSession | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = langCode;
  recognition.continuous = true;
  recognition.interimResults = true;
  // Ask for on-device recognition wherever the browser supports it, so audio
  // stays on the phone. Ignored by browsers that do not implement it — which
  // is why the UI must disclose cloud recognition unless it is confirmed.
  try {
    recognition.processLocally = true;
  } catch {
    /* property not supported — disclosure covers this case */
  }

  let finalText = '';
  let stopped = false;

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) {
        finalText += (finalText ? ' ' : '') + text.trim();
      } else {
        interim += text;
      }
    }
    onUpdate(finalText, interim.trim());
  };

  recognition.onerror = (event) => {
    // "no-speech" and "aborted" are normal during a pause — do not alarm the user.
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      onError?.(event.error);
    }
  };

  // Chrome ends the session on silence; restart until the user actually stops.
  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start();
      } catch {
        /* already restarting */
      }
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
