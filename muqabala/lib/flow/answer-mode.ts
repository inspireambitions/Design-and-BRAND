/**
 * How a candidate answers: by typing, by speaking, or on video. Pure helpers
 * shared by the selector and the interview flow. Nothing here touches the
 * camera or microphone; it only remembers a choice and works out the default.
 */
export type AnswerMode = 'type' | 'speak' | 'video';

export const ANSWER_MODES: readonly AnswerMode[] = ['type', 'speak', 'video'];

export const ANSWER_MODE_STORAGE_KEY = 'muqabala.answerMode';
export const STAR_GUIDE_STORAGE_KEY = 'muqabala.starGuide';

/** Every recording stops itself at two minutes, however long the question allows. */
export const RECORDING_LIMIT_SECONDS = 120;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type AnswerModeAvailability = {
  speak: boolean;
  video: boolean;
};

export function isAnswerMode(value: unknown): value is AnswerMode {
  return typeof value === 'string' && (ANSWER_MODES as readonly string[]).includes(value);
}

/** Type on a phone, Speak on a desktop. Video is only ever an explicit choice. */
export function defaultAnswerMode(device: { isMobile: boolean }): AnswerMode {
  return device.isMobile ? 'type' : 'speak';
}

/**
 * Drops a remembered or default mode to one the browser can actually run.
 * Video falls back to Speak, Speak falls back to Type.
 */
export function availableAnswerMode(mode: AnswerMode, availability: AnswerModeAvailability): AnswerMode {
  if (mode === 'video' && availability.video) return 'video';
  if (mode !== 'type' && availability.speak) return 'speak';
  return 'type';
}

export function readStoredAnswerMode(storage: StorageLike | null | undefined): AnswerMode | null {
  try {
    const value = storage?.getItem(ANSWER_MODE_STORAGE_KEY);
    return isAnswerMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeAnswerMode(storage: StorageLike | null | undefined, mode: AnswerMode): boolean {
  try {
    storage?.setItem(ANSWER_MODE_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

/**
 * The card to highlight when the selector opens: the remembered choice when
 * there is one and the device still supports it, otherwise the device default.
 */
export function initialAnswerMode(options: {
  stored: AnswerMode | null;
  device: { isMobile: boolean };
  availability: AnswerModeAvailability;
}): AnswerMode {
  const preferred = options.stored ?? defaultAnswerMode(options.device);
  return availableAnswerMode(preferred, options.availability);
}

/**
 * Seconds a spoken or filmed answer may run. The question's own allowance wins
 * when it is shorter than two minutes; extra time (an access need) is added on
 * top so the limit never takes away what the candidate asked for.
 */
export function recordingLimitSeconds(answerSeconds: number, extraTimeSeconds = 0): number {
  const base = Math.min(RECORDING_LIMIT_SECONDS, Math.max(1, Math.floor(answerSeconds)));
  return base + Math.max(0, Math.floor(extraTimeSeconds));
}

export function readStarGuide(storage: StorageLike | null | undefined): boolean {
  try {
    return storage?.getItem(STAR_GUIDE_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function storeStarGuide(storage: StorageLike | null | undefined, on: boolean): void {
  try {
    if (on) storage?.setItem(STAR_GUIDE_STORAGE_KEY, 'on');
    else storage?.removeItem(STAR_GUIDE_STORAGE_KEY);
  } catch {
    // Private mode or a full quota: the toggle still works for this visit.
  }
}
