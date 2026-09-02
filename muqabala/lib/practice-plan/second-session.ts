/**
 * Return-visit detection for the `second_session` event: fired once, when a
 * candidate comes back in a new browser session within seven days of their
 * first practice session on this device. Pure over a small state record; the
 * storage helpers keep it in localStorage plus a per-tab session marker.
 */
export const SESSION_STATE_KEY = 'muqabala.sessions.v1';
export const SESSION_MARKER_KEY = 'muqabala.sessions.marker';
export const PLAN_ATTACH_KEY = 'muqabala.practicePlan.v1';

export const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export type SessionState = {
  firstSessionAt?: string;
  lastSessionAt?: string;
  /** ISO time the second_session event was reported, so it is never sent twice. */
  secondSessionReportedAt?: string;
};

export type SessionVisit = {
  state: SessionState;
  /** True exactly once: a fresh session within seven days of the first one. */
  isSecondSession: boolean;
};

export function normaliseSessionState(value: unknown): SessionState {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === 'string' && Number.isFinite(Date.parse(raw[key] as string)) ? (raw[key] as string) : undefined);
  return {
    firstSessionAt: text('firstSessionAt'),
    lastSessionAt: text('lastSessionAt'),
    secondSessionReportedAt: text('secondSessionReportedAt'),
  };
}

/**
 * Apply a visit. `newBrowserSession` is true when this tab has not yet been
 * counted (see `beginVisit`); reloads inside one tab never count as a return.
 */
export function recordVisit(state: SessionState, now: number | Date, newBrowserSession: boolean): SessionVisit {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const iso = new Date(nowMs).toISOString();
  if (!state.firstSessionAt) {
    return { state: { ...state, firstSessionAt: iso, lastSessionAt: iso }, isSecondSession: false };
  }
  if (!newBrowserSession) return { state, isSecondSession: false };
  const firstMs = Date.parse(state.firstSessionAt);
  const withinWindow = nowMs > firstMs && nowMs - firstMs <= RETURN_WINDOW_MS;
  const isSecondSession = withinWindow && !state.secondSessionReportedAt;
  return {
    state: {
      ...state,
      lastSessionAt: iso,
      secondSessionReportedAt: isSecondSession ? iso : state.secondSessionReportedAt,
    },
    isSecondSession,
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function local(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function session(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadSessionState(store: StorageLike | null = local()): SessionState {
  if (!store) return {};
  try {
    const raw = store.getItem(SESSION_STATE_KEY);
    return raw ? normaliseSessionState(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/**
 * Call once per page load on a practice surface. Returns whether this load is
 * the candidate's second session so the caller can fire the event.
 */
export function beginVisit(
  now: number | Date = Date.now(),
  stores: { local?: StorageLike | null; session?: StorageLike | null } = {},
): SessionVisit {
  const localStore = stores.local === undefined ? local() : stores.local;
  const sessionStore = stores.session === undefined ? session() : stores.session;
  let fresh = true;
  try {
    fresh = !sessionStore?.getItem(SESSION_MARKER_KEY);
    sessionStore?.setItem(SESSION_MARKER_KEY, '1');
  } catch {
    fresh = true;
  }
  const visit = recordVisit(loadSessionState(localStore), now, fresh);
  try {
    localStore?.setItem(SESSION_STATE_KEY, JSON.stringify(visit.state));
  } catch {
    /* storage blocked: the event is simply not counted */
  }
  return visit;
}

export type PlanAttachment = {
  /** SHA-256 of the plan link token, never the token itself. */
  planRef: string;
  roleId: string;
  daysOpened: number[];
  firstOpenedAt: string;
  lastOpenedAt: string;
};

/**
 * Attaches the plan to this device. Progress made here is already local; this
 * records which plan and which days brought the candidate back so a later
 * sign-in can claim it. Nothing is sent anywhere.
 */
export function attachPlanLocally(
  input: { planRef: string; roleId: string; day: number },
  now: number | Date = Date.now(),
  store: StorageLike | null = local(),
): PlanAttachment | null {
  if (!store) return null;
  const iso = new Date(now).toISOString();
  let current: PlanAttachment | null = null;
  try {
    const raw = store.getItem(PLAN_ATTACH_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PlanAttachment>) : null;
    if (parsed && parsed.planRef === input.planRef && Array.isArray(parsed.daysOpened)) {
      current = {
        planRef: input.planRef,
        roleId: typeof parsed.roleId === 'string' ? parsed.roleId : input.roleId,
        daysOpened: parsed.daysOpened.filter((day): day is number => Number.isInteger(day)),
        firstOpenedAt: typeof parsed.firstOpenedAt === 'string' ? parsed.firstOpenedAt : iso,
        lastOpenedAt: iso,
      };
    }
  } catch {
    current = null;
  }
  const next: PlanAttachment = current
    ? { ...current, daysOpened: Array.from(new Set([...current.daysOpened, input.day])).sort((a, b) => a - b), lastOpenedAt: iso }
    : { planRef: input.planRef, roleId: input.roleId, daysOpened: [input.day], firstOpenedAt: iso, lastOpenedAt: iso };
  try {
    store.setItem(PLAN_ATTACH_KEY, JSON.stringify(next));
  } catch {
    return null;
  }
  return next;
}
