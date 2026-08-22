/**
 * Handoff between the landing-page advert form and /practice/custom.
 *
 * sessionStorage, not localStorage: the draft is one navigation's worth of
 * state, and a job advert someone pasted should not outlive the tab.
 */
export const HERO_DRAFT_KEY = 'muqabala.heroDraft.v1';

export type HeroDraft = { jobTitle: string; jobText: string };

/** Read the draft and clear it, so a refresh never replays an auto-start. */
export function takeHeroDraft(): HeroDraft | null {
  try {
    const raw = sessionStorage.getItem(HERO_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HERO_DRAFT_KEY);
    const parsed = JSON.parse(raw) as Partial<HeroDraft>;
    return {
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle : '',
      jobText: typeof parsed.jobText === 'string' ? parsed.jobText : '',
    };
  } catch {
    return null;
  }
}
