import type { Profile, RoadmapReport } from "./types";

const PROFILE_KEY = "ascent.profile.v1";
const REPORT_KEY = "ascent.report.v1";
const UNLOCK_KEY = "ascent.unlocked.v1";
const EMAIL_KEY = "ascent.email.v1";

// localStorage, not sessionStorage: the landing page promises a roadmap you can
// re-read at month 7, and a report that dies with the tab makes that a lie.
// This survives closing the browser but is still per-device — a server-side
// store keyed to the captured email is what makes the promise fully true.
function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — the page still works, just not across reloads */
  }
}

export const store = {
  saveProfile: (p: Profile) => safeSet(PROFILE_KEY, p),
  loadProfile: () => safeGet<Profile>(PROFILE_KEY),
  saveReport: (r: RoadmapReport) => safeSet(REPORT_KEY, r),
  loadReport: () => safeGet<RoadmapReport>(REPORT_KEY),
  setUnlocked: (v: boolean) => safeSet(UNLOCK_KEY, v),
  isUnlocked: () => safeGet<boolean>(UNLOCK_KEY) === true,
  saveEmail: (e: string) => safeSet(EMAIL_KEY, e),
  loadEmail: () => safeGet<string>(EMAIL_KEY),
  clear: () => {
    if (typeof window === "undefined") return;
    [PROFILE_KEY, REPORT_KEY, UNLOCK_KEY, EMAIL_KEY].forEach((k) =>
      window.localStorage.removeItem(k)
    );
  },
};
