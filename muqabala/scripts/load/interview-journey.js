import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate } from 'k6/metrics';

const profileName = __ENV.LOAD_PROFILE || 'smoke';
const baseUrl = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const runId = __ENV.LOAD_RUN_ID || 'local-smoke';
const runAi = __ENV.CONFIRM_AI_SPEND === 'YES';
const journeyPercent = Number(__ENV.JOURNEY_PERCENT || 20);
const bypassSecret = __ENV.VERCEL_AUTOMATION_BYPASS_SECRET || '';

const profiles = {
  smoke: [
    { duration: '20s', target: 5 },
    { duration: '20s', target: 0 },
  ],
  capacity: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '5m', target: 250 },
    { duration: '10m', target: 500 },
    { duration: '15m', target: 1000 },
    { duration: '5m', target: 0 },
  ],
  soak: [
    { duration: '2m', target: 150 },
    { duration: '30m', target: 150 },
    { duration: '3m', target: 0 },
  ],
};

const transportFailures = new Counter('transport_failures');
const application5xx = new Counter('application_5xx');
const transportFailureRate = new Rate('transport_failure_rate');
const application5xxRate = new Rate('application_5xx_rate');

export const options = {
  stages: profiles[profileName] || profiles.smoke,
  discardResponseBodies: false,
  tags: { load_run: runId, load_profile: profileName },
  cloud: {
    distribution: {
      gulf_near_mumbai: { loadZone: 'amazon:in:mumbai', percent: 50 },
      asia_singapore: { loadZone: 'amazon:sg:singapore', percent: 25 },
      europe_frankfurt: { loadZone: 'amazon:de:frankfurt', percent: 25 },
    },
  },
  thresholds: {
    transport_failure_rate: ['rate<0.01'],
    application_5xx_rate: ['rate<0.005'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
};

function targetHost() {
  return baseUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
}

export function setup() {
  if (!profiles[profileName]) throw new Error('LOAD_PROFILE must be smoke, capacity or soak.');
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(runId)) throw new Error('LOAD_RUN_ID must be a safe 4-64 character label.');
  if (!Number.isFinite(journeyPercent) || journeyPercent < 1 || journeyPercent > 100) {
    throw new Error('JOURNEY_PERCENT must be between 1 and 100.');
  }
  if (profileName === 'smoke') return;

  const host = targetHost();
  const productionHosts = new Set([
    'trymuqabala.com',
    'www.trymuqabala.com',
    'muqabala.vercel.app',
    'muqabala-inspire14.vercel.app',
  ]);
  if (__ENV.TARGET_ENV !== 'staging') throw new Error('Capacity and soak profiles require TARGET_ENV=staging.');
  if (__ENV.DISTRIBUTED !== 'YES') throw new Error('Capacity and soak profiles require DISTRIBUTED=YES.');
  if (!baseUrl.startsWith('https://')) throw new Error('Distributed tests require an HTTPS staging URL.');
  if (productionHosts.has(host)) throw new Error('Production load testing is blocked by this harness.');
  if (host.endsWith('.vercel.app') && !bypassSecret) {
    throw new Error('Protected Vercel staging requires its automation bypass secret.');
  }

  const preflight = http.get(requestUrl('/practice'), {
    headers: headers(),
    redirects: 0,
    tags: { step: 'staging_preflight' },
  });
  const contentSecurityPolicy = preflight.headers['Content-Security-Policy'] || '';
  if (preflight.status !== 200 || !contentSecurityPolicy.includes("default-src 'self'")) {
    throw new Error('Staging preflight did not reach the Muqabala application.');
  }
}

function requestUrl(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${baseUrl}${path}${separator}load_run=${encodeURIComponent(runId)}`;
}

function headers(extra = {}) {
  return {
    Origin: baseUrl,
    'X-Load-Test-Run': runId,
    ...(bypassSecret ? { 'x-vercel-protection-bypass': bypassSecret } : {}),
    ...extra,
  };
}

function observe(response, step) {
  const transportFailed = response.status === 0;
  const serverFailed = response.status >= 500;
  transportFailureRate.add(transportFailed, { step });
  application5xxRate.add(serverFailed, { step });
  if (transportFailed) {
    transportFailures.add(1, { step, error_code: String(response.error_code || 'unknown') });
    console.error(JSON.stringify({
      runId,
      step,
      kind: 'transport',
      errorCode: response.error_code || null,
      error: response.error || 'connection failed before an HTTP response',
    }));
  } else if (serverFailed) {
    application5xx.add(1, { step, status: String(response.status) });
    console.error(JSON.stringify({
      runId,
      step,
      kind: 'application_5xx',
      status: response.status,
      vercelId: response.headers['X-Vercel-Id'] || null,
    }));
  }
}

function get(path, step) {
  const response = http.get(requestUrl(path), { headers: headers(), tags: { step } });
  observe(response, step);
  return response;
}

const questionIds = [
  'intro',
  'angry_guest',
  'overbooking',
  'systems',
  'svc_worst_day',
  'svc_mistake_bank',
  'svc_two_customers',
  'why_gulf',
];
const questions = questionIds.map((id) => ({
  id,
  text: 'Canonical question supplied by the server.',
  textAr: 'يتم توفير السؤال المعتمد من الخادم.',
  competencies: [],
  hint: '',
  hintAr: '',
  prepSeconds: 30,
  answerSeconds: 120,
}));

function browseJourney() {
  const home = get('/', 'home_get');
  check(home, { 'home page loads': (response) => response.status === 200 });
  sleep(Math.random() * 2 + 0.5);
  const practice = get('/practice', 'practice_get');
  check(practice, { 'practice directory loads': (response) => response.status === 200 });
  sleep(Math.random() * 3 + 1);
  const role = get('/practice/front-office-agent', 'role_get');
  check(role, { 'role page loads': (response) => response.status === 200 });
  sleep(Math.random() * 4 + 1);
}

function fullInterviewJourney() {
  const page = get('/practice/front-office-agent', 'role_get');
  check(page, { 'practice page loads': (response) => response.status === 200 });
  sleep(Math.random() * 2 + 1);

  const create = http.post(requestUrl('/api/interviews'), JSON.stringify({
    roleId: 'front-office-agent',
    roleTitle: 'Front Office Agent',
    language: 'en',
    mode: 'mock',
    questions,
  }), { headers: headers({ 'Content-Type': 'application/json' }), tags: { step: 'interview_create' } });
  observe(create, 'interview_create');
  check(create, { 'interview starts': (response) => response.status === 201 });
  if (create.status !== 201) return;
  const id = create.json('id');
  sleep(Math.random() * 5 + 2);

  for (let questionIndex = 0; questionIndex < questionIds.length; questionIndex += 1) {
    const answer = `Load test candidate ${exec.vu.idInTest} gives answer ${questionIndex + 1}, describes a real hotel problem, the action taken and the confirmed result.`;
    const completed = questionIndex === questionIds.length - 1;
    const save = http.patch(requestUrl(`/api/interviews/${id}`), JSON.stringify({
      questionIndex,
      transcript: answer,
      currentQuestion: completed ? questionIndex : questionIndex + 1,
      status: completed ? 'completed' : 'in_progress',
    }), { headers: headers({ 'Content-Type': 'application/json' }), tags: { step: 'answer_save' } });
    observe(save, 'answer_save');
    check(save, { 'answer autosaves': (response) => response.status === 200 });

    if (runAi) {
      const score = http.post(requestUrl('/api/score'), JSON.stringify({
        roleId: 'front-office-agent',
        questionId: questionIds[questionIndex],
        questionIndex,
        interviewId: id,
        transcript: answer,
        lang: 'en',
      }), { headers: headers({ 'Content-Type': 'application/json', 'X-Scoring-Session': `${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${questionIndex}` }), tags: { step: 'score' } });
      observe(score, 'score');
      check(score, { 'AI response is controlled': (response) => [200, 409, 429, 503].includes(response.status) });
    }
    sleep(Math.random() * 2 + 0.5);
  }

  const report = get(`/api/interviews/${id}/report`, 'report_get');
  check(report, {
    'anonymous report is locked': (response) => response.status === 200 && response.json('unlocked') === false,
    'only question one is exposed': (response) => response.status === 200 && response.json('answers').length === 1,
  });
  sleep(Math.random() * 3 + 1);
}

export default function () {
  const journeySlot = (exec.vu.idInTest * 37) % 100;
  if (journeySlot < journeyPercent) fullInterviewJourney();
  else browseJourney();
}
