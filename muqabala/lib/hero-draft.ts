/**
 * Handoff between the landing-page advert form and /practice/custom.
 *
 * sessionStorage, not localStorage: the draft is one navigation's worth of
 * state, and a job advert someone pasted should not outlive the tab.
 */
export const HERO_DRAFT_KEY = 'muqabala.heroDraft.v1';

export type HeroDraft = { jobTitle: string; jobText: string };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Store the draft for the next page. Returns false when storage is blocked. */
export function saveHeroDraft(draft: HeroDraft, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(HERO_DRAFT_KEY, JSON.stringify({ jobTitle: draft.jobTitle, jobText: draft.jobText }));
    return true;
  } catch {
    return false;
  }
}

/** Read the draft and clear it, so a refresh never replays an auto-start. */
export function takeHeroDraft(storage: StorageLike | null = defaultStorage()): HeroDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HERO_DRAFT_KEY);
    if (!raw) return null;
    storage.removeItem(HERO_DRAFT_KEY);
    const parsed = JSON.parse(raw) as Partial<HeroDraft>;
    return {
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle : '',
      jobText: typeof parsed.jobText === 'string' ? parsed.jobText : '',
    };
  } catch {
    return null;
  }
}
