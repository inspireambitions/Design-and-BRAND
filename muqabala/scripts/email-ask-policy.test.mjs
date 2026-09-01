import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('./test-hooks/ts-paths.mjs', import.meta.url);

const {
  EMAIL_CONSENT_KEY, emptyConsentState, loadConsentState, normaliseConsentState, recordAsked, recordConsent,
  recordDecline, recordSessionEnd, saveConsentState, shouldAskForEmail, updateConsentState,
} = await import('../lib/practice-plan/ask-policy.ts');
const {
  PLAN_ATTACH_KEY, RETURN_WINDOW_MS, SESSION_MARKER_KEY, SESSION_STATE_KEY, attachPlanLocally, beginVisit, recordVisit,
} = await import('../lib/practice-plan/second-session.ts');

const DAY = 24 * 60 * 60 * 1_000;
const T0 = Date.parse('2026-09-01T10:00:00.000Z');

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    dump: () => Object.fromEntries(map),
  };
}

test('a fresh device is asked once, and never twice in the same session', () => {
  let state = emptyConsentState();
  assert.equal(shouldAskForEmail(state, T0), true);
  state = recordAsked(state);
  assert.equal(shouldAskForEmail(state, T0), false);
  state = recordSessionEnd(state);
  assert.equal(shouldAskForEmail(state, T0 + DAY), true);
});

test('a decline holds until the end of the second session after it', () => {
  let state = recordDecline(emptyConsentState(), T0);
  assert.equal(shouldAskForEmail(state, T0), false);
  state = recordSessionEnd(state);
  assert.equal(shouldAskForEmail(state, T0 + 60_000), false, 'end of the first session: still quiet');
  state = recordSessionEnd(state);
  assert.equal(shouldAskForEmail(state, T0 + 2 * 60_000), true, 'end of the second session: ask again');
  state = recordDecline(state, T0 + 3 * 60_000);
  assert.equal(shouldAskForEmail(recordSessionEnd(state), T0 + 4 * 60_000), false);
  assert.equal(shouldAskForEmail(recordSessionEnd(recordSessionEnd(state)), T0 + 5 * 60_000), true);
});

test('a decline older than thirty days no longer blocks the ask', () => {
  const state = recordDecline(emptyConsentState(), T0);
  assert.equal(shouldAskForEmail(state, T0 + 31 * DAY), true);
  assert.equal(shouldAskForEmail(state, T0 + 29 * DAY), false);
});

test('consent ends the asking for good and records the source', () => {
  const state = recordConsent(recordDecline(emptyConsentState(), T0), 'feedback_card', T0 + 1_000);
  assert.equal(state.consentedAt, new Date(T0 + 1_000).toISOString());
  assert.equal(state.source, 'feedback_card');
  assert.equal(state.declinedAt, undefined);
  assert.equal(shouldAskForEmail(state, T0 + 400 * DAY), false);
  assert.equal(shouldAskForEmail(recordSessionEnd(recordSessionEnd(state)), T0 + DAY), false);
});

test('the advert pack writes the same key and is read compatibly', () => {
  const store = memoryStorage({
    [EMAIL_CONSENT_KEY]: JSON.stringify({ consentedAt: '2026-08-30T09:00:00.000Z', source: 'advert_pack', sessions: 1 }),
  });
  const state = loadConsentState(store);
  assert.equal(state.source, 'advert_pack');
  assert.equal(state.sessions, 1);
  assert.equal(shouldAskForEmail(state, T0), false);
  assert.deepEqual(normaliseConsentState({ sessions: 'two', source: 'newsletter', declinedAt: '' }), { sessions: 0, consentedAt: undefined, source: undefined, declinedAt: undefined, declinedAtSession: undefined, askedAtSession: undefined });
  assert.deepEqual(loadConsentState(memoryStorage({ [EMAIL_CONSENT_KEY]: '{broken' })), emptyConsentState());
});

test('storage round-trips drop undefined fields and survive a blocked store', () => {
  const store = memoryStorage();
  const saved = updateConsentState((state) => recordDecline(state, T0), store);
  assert.equal(saved.declinedAtSession, 0);
  assert.deepEqual(Object.keys(JSON.parse(store.dump()[EMAIL_CONSENT_KEY])).sort(), ['askedAtSession', 'declinedAt', 'declinedAtSession', 'sessions']);
  assert.equal(saveConsentState(saved, null), false);
  assert.deepEqual(loadConsentState(null), emptyConsentState());
});

test('second session fires once for a new browser session within seven days of the first', () => {
  const first = recordVisit({}, T0, true);
  assert.equal(first.isSecondSession, false);
  assert.equal(first.state.firstSessionAt, new Date(T0).toISOString());
  const reload = recordVisit(first.state, T0 + 60_000, false);
  assert.equal(reload.isSecondSession, false, 'a reload in the same tab is not a return');
  const back = recordVisit(first.state, T0 + 2 * DAY, true);
  assert.equal(back.isSecondSession, true);
  const third = recordVisit(back.state, T0 + 3 * DAY, true);
  assert.equal(third.isSecondSession, false, 'reported only once');
  const late = recordVisit(first.state, T0 + RETURN_WINDOW_MS + 1, true);
  assert.equal(late.isSecondSession, false, 'outside the seven-day window');
});

test('beginVisit uses a session marker so a tab counts once and persists state locally', () => {
  const local = memoryStorage();
  const session = memoryStorage();
  assert.equal(beginVisit(T0, { local, session }).isSecondSession, false);
  assert.equal(session.getItem(SESSION_MARKER_KEY), '1');
  assert.equal(beginVisit(T0 + DAY, { local, session }).isSecondSession, false, 'same tab, no return');
  const freshTab = memoryStorage();
  assert.equal(beginVisit(T0 + DAY, { local, session: freshTab }).isSecondSession, true);
  assert.ok(JSON.parse(local.getItem(SESSION_STATE_KEY)).secondSessionReportedAt);
  assert.equal(beginVisit(T0 + 2 * DAY, { local: null, session: null }).isSecondSession, false);
});

test('plan attachment records the plan reference and the days opened, never the token', () => {
  const store = memoryStorage();
  const first = attachPlanLocally({ planRef: 'hash-1', roleId: 'nurse', day: 3 }, T0, store);
  assert.deepEqual(first.daysOpened, [3]);
  const second = attachPlanLocally({ planRef: 'hash-1', roleId: 'nurse', day: 1 }, T0 + DAY, store);
  assert.deepEqual(second.daysOpened, [1, 3]);
  assert.equal(second.firstOpenedAt, new Date(T0).toISOString());
  const replaced = attachPlanLocally({ planRef: 'hash-2', roleId: 'waiter', day: 2 }, T0 + 2 * DAY, store);
  assert.deepEqual(replaced.daysOpened, [2]);
  assert.doesNotMatch(store.getItem(PLAN_ATTACH_KEY), /hash-1/);
  assert.equal(attachPlanLocally({ planRef: 'x', roleId: 'y', day: 1 }, T0, null), null);
});
