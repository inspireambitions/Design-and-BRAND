import type { Profile, RoadmapReport } from "./types";

const PROFILE_KEY = "ascent.profile.v1";
const REPORT_KEY = "ascent.report.v1";
const UNLOCK_KEY = "ascent.unlocked.v1";

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
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
  clear: () => {
    if (typeof window === "undefined") return;
    [PROFILE_KEY, REPORT_KEY, UNLOCK_KEY].forEach((k) => window.sessionStorage.removeItem(k));
  },
};
