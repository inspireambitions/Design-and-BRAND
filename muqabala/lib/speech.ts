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
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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
