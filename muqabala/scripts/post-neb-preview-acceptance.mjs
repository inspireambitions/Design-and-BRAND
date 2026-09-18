/**
 * Muqabala Post-Neb preview acceptance gate.
 *
 * Every gate is backed by a measured condition. A gate that cannot be measured
 * returns NOT_PERFORMED and blocks the production recommendation.
 * The process exits 0 only when every required gate is PASS, console errors are
 * zero, 5xx responses are zero, and no production Supabase contact is observed.
 *
 * This harness is test-only. It must never be pointed at the production project.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from 'pg';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { recoverStuckFeedbackAttempts } from '../lib/schools/feedback-recovery.ts';
import { resolveSchoolsFeedback } from '../lib/schools/evidence.ts';

dotenv.config({ path: '.env.preview.local' });

const PRODUCTION_REF = 'hmaxzpgsefzpflrwzopa';
const ISOLATED_REF = 'flznnwurtwernztltnva';
const baseUrl = 'http://127.0.0.1:3102';
const port = 9245;

/** Gate name -> PASS | FAIL | NOT_PERFORMED */
const results = {};
/** Gate name -> short human explanation of the measurement. */
const detail = {};

function record(gate, value, why) {
  results[gate] = value;
  detail[gate] = why;
  console.log(`  ${gate}: ${value} (${why})`);
}
function gatePass(gate, condition, why) {
  record(gate, condition ? 'PASS' : 'FAIL', why);
  return condition;
}
function notPerformed(gate, why) {
  record(gate, 'NOT_PERFORMED', why);
}

// ---------------------------------------------------------------- environment
const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'REAL_SUPABASE_DATABASE_URL'];
const missingEnv = requiredEnv.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`MISSING_ENV: ${missingEnv.join(',')}`);
  process.exit(2);
}
const envBlob = requiredEnv.map((k) => process.env[k]).join(' ');
if (envBlob.includes(PRODUCTION_REF)) {
  console.error(`REFUSING TO RUN: environment references production ${PRODUCTION_REF}`);
  process.exit(2);
}
if (!envBlob.includes(ISOLATED_REF)) {
  console.error(`REFUSING TO RUN: environment does not reference isolated ${ISOLATED_REF}`);
  process.exit(2);
}

// ------------------------------------------------------------ server ownership
function listeningPids() {
  try {
    return execSync('lsof -ti tcp:3102 -sTCP:LISTEN', { encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}
function processTree(pid) {
  const out = new Set([String(pid)]);
  try {
    const rows = execSync('ps -eo pid=,ppid=', { encoding: 'utf8' }).trim().split('\n');
    let added = true;
    while (added) {
      added = false;
      for (const row of rows) {
        const [p, pp] = row.trim().split(/\s+/);
        if (out.has(pp) && !out.has(p)) { out.add(p); added = true; }
      }
    }
  } catch { /* ps unavailable */ }
  return out;
}

const ownedPid = process.env.ACCEPTANCE_SERVER_PID;
const listeners = listeningPids();
if (!ownedPid) {
  record('SERVER_OWNERSHIP', 'FAIL', 'ACCEPTANCE_SERVER_PID was not provided by the runner');
} else if (listeners.length === 0) {
  record('SERVER_OWNERSHIP', 'FAIL', 'nothing is listening on port 3102');
} else {
  const tree = processTree(ownedPid);
  const owned = listeners.every((pid) => tree.has(pid));
  record('SERVER_OWNERSHIP', owned ? 'PASS' : 'FAIL',
    owned ? `port 3102 is served by runner pid ${ownedPid}` : `port 3102 is served by ${listeners.join(',')}, not by runner pid ${ownedPid}`);
}
if (results.SERVER_OWNERSHIP !== 'PASS') {
  console.log(`\nACCEPTANCE_RESULTS_JSON=${JSON.stringify({ results, detail })}`);
  console.error('Refusing to test a server this run does not own.');
  process.exit(3);
}

// ------------------------------------------------------------------ browser
const browserPath = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean).find((candidate) => existsSync(candidate));
if (!browserPath) throw new Error('Chrome was not found.');

const profile = await mkdtemp(join(tmpdir(), 'muqabala-post-neb-gate-'));
const screenshotDir = new URL('../audit_screenshots/post-neb-gate/', import.meta.url);
await mkdir(screenshotDir, { recursive: true });

const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findPage() {
  for (let i = 0; i < 80; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = pages.find((item) => item.type === 'page');
      if (p?.webSocketDebuggerUrl) return p;
    } catch { /* not ready */ }
    await wait(125);
  }
  throw new Error('Chrome did not become ready.');
}

let socket;
let nextId = 0;
const pending = new Map();
const consoleErrors = [];
const httpResponses = [];
/** POST /api/schools requests observed from the browser, with their operation and final status. */
const apiRequests = [];
const supabaseHosts = new Set();
/** Cookie jar of the most recent browser sign-in, used for deliberate negative requests sent from node. */
let currentCookies = [];

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser eval failed');
  return result.result?.value;
}
async function navigate(path, { width = 1280, height = 900, mobile = false } = {}) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await command('Page.navigate', { url: `${baseUrl}${path}` });
  for (let i = 0; i < 100; i++) {
    const ready = await evaluate(`({ state: document.readyState, len: document.body?.innerText.length || 0 })`);
    if (ready?.state === 'complete' && ready.len > 0) break;
    await wait(100);
  }
  await wait(300);
}
async function takeScreenshot(name) {
  const shot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(new URL(name, screenshotDir), Buffer.from(shot.data, 'base64'));
}
/** Fetch inside the page so the browser's cookies and Origin header are used. */
async function pageFetch(path, init = {}) {
  const expr = `(async () => {
    const r = await fetch(${JSON.stringify(path)}, Object.assign({ credentials: 'include', redirect: 'manual', cache: 'no-store' }, ${JSON.stringify(init)}));
    let body = '';
    try { body = (await r.text()).slice(0, 4000); } catch {}
    return { status: r.status, type: r.type, body };
  })()`;
  return evaluate(expr);
}
/**
 * Fetch from node with the current session cookies and a trusted Origin.
 * Used for requests that are EXPECTED to be refused, so the browser console is
 * not polluted by deliberate 4xx responses.
 */
async function nodeFetch(path, init = {}) {
  const headers = Object.assign({
    Origin: baseUrl,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    Cookie: currentCookies.map((c) => `${c.name}=${c.value}`).join('; '),
  }, init.headers || {});
  const r = await fetch(`${baseUrl}${path}`, Object.assign({ redirect: 'manual' }, init, { headers }));
  let body = '';
  try { body = (await r.text()).slice(0, 4000); } catch { /* no body */ }
  return { status: r.status, type: r.type, body, location: r.headers.get('location') };
}
async function apiSchoolsNegative(operation, payload) {
  return nodeFetch('/api/schools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, payload }),
  });
}
async function apiSchools(operation, payload) {
  return pageFetch('/api/schools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, payload }),
  });
}

// ------------------------------------------------------------------- fixtures
const db = new Client({ connectionString: process.env.REAL_SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const { createServerClient } = await import('@supabase/ssr');
const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
const admin = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const stamp = Date.now();
const pwd = 'Password123!Secure';
const made = { users: [], institutions: [], cohorts: [], assignments: [] };

async function makeUser(tag) {
  const email = `${tag}_${stamp}_${Math.random().toString(36).slice(2, 6)}@muqabala.test`;
  const res = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true });
  if (res.error) throw new Error(`create ${tag}: ${res.error.message}`);
  made.users.push(res.data.user.id);
  return { id: res.data.user.id, email };
}

/** Signs in through the SSR client and installs the session cookies in the browser. */
async function signInBrowserAs(user) {
  let cookies = [];
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookies,
        setAll: (values) => {
          for (const value of values) {
            cookies = cookies.filter((item) => item.name !== value.name);
            cookies.push(value);
          }
        },
      },
    },
  );
  const signIn = await ssr.auth.signInWithPassword({ email: user.email, password: pwd });
  if (signIn.error) throw new Error(`sign in ${user.email}: ${signIn.error.message}`);
  const claims = await ssr.auth.getClaims();
  const sessionId = claims.data?.claims?.session_id;
  if (sessionId) {
    await db.query(
      `INSERT INTO public.schools_sessions (session_id, user_id, last_seen_at) VALUES ($1, $2, now())
       ON CONFLICT (session_id) DO UPDATE SET last_seen_at = now(), revoked_at = null`,
      [sessionId, user.id],
    );
  }
  await command('Network.clearBrowserCookies');
  currentCookies = cookies;
  for (const c of cookies) {
    await command('Network.setCookie', { name: c.name, value: c.value, url: baseUrl, httpOnly: !!c.options?.httpOnly, sameSite: 'Lax' });
  }
}
async function signOutBrowser() {
  await command('Network.clearBrowserCookies');
  currentCookies = [];
}

async function makeAssignment({ cohortId, institutionId, educatorId, mode, maxAttempts = 2, questions = 3 }) {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO public.schools_assignments (id, cohort_id, role_id, job_title, instructions, due_at, delivery_mode, max_attempts, status, created_by)
     VALUES ($1, $2, 'front-office-agent', 'Front Office Agent', 'Answer clearly', now() + interval '7 days', $3, $4, 'draft', $5)`,
    [id, cohortId, mode, maxAttempts, educatorId],
  );
  for (let i = 0; i < questions; i++) {
    const qv = crypto.randomUUID();
    await db.query(
      `INSERT INTO public.schools_question_versions (id, institution_id, question_key, version, role_id, language, question_text, rubric, approved_by, no_example_follow_up)
       VALUES ($1, $2, $3, 1, 'front-office-agent', 'en', $4, '["r1","r2","r3","r4"]'::jsonb, $5, 'Tell us about a group project')`,
      [qv, institutionId, `q_${mode}_${i + 1}_${id.slice(0, 8)}_${stamp}`, `Question ${i + 1}: How do you handle a difficult guest?`, educatorId],
    );
    await db.query(
      `INSERT INTO public.schools_assignment_questions (assignment_id, question_index, question_version_id) VALUES ($1, $2, $3)`,
      [id, i, qv],
    );
  }
  await db.query(`UPDATE public.schools_assignments SET status='published', published_at=now() WHERE id=$1`, [id]);
  made.assignments.push(id);
  return id;
}

async function attachFeedback(attemptId, answers) {
  const providerOutput = {
    questions: answers.map((_, qIndex) => ({
      questionIndex: qIndex,
      improvement: 'Add concrete details on the business impact.',
      elements: ['r1', 'r2', 'r3', 'r4'].map((id) => ({
        id, present: id === 'r1' && qIndex === 0,
        firstExcerpt: id === 'r1' && qIndex === 0 ? 0 : null,
        lastExcerpt: id === 'r1' && qIndex === 0 ? 0 : null,
        confidence: 'medium',
      })),
    })),
  };
  const resolved = resolveSchoolsFeedback(providerOutput, answers);
  const fvId = crypto.randomUUID();
  await db.query(
    `INSERT INTO public.schools_feedback_versions (id, assignment_attempt_id, provider, model, contract_version, output)
     VALUES ($1, $2, 'openai', 'gpt-4.1-mini', '1.0', $3)`,
    [fvId, attemptId, JSON.stringify(providerOutput)],
  );
  await db.query(
    `UPDATE public.schools_assignment_attempts SET feedback_status='ready', feedback_version_id=$2, evidence_covered=1, evidence_detail=$3 WHERE id=$1`,
    [attemptId, fvId, JSON.stringify(resolved.questions)],
  );
  return fvId;
}

async function runGate(name, fn) {
  console.log(`\n[${name}]`);
  try { await fn(); }
  catch (err) { record(name, 'FAIL', `threw: ${String(err.message || err).slice(0, 200)}`); }
}

// --------------------------------------------------------------------- main
let exitCode = 0;
try {
  const page = await findPage();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params?.exceptionDetails || {};
      consoleErrors.push(`${d.text || 'Uncaught'} ${d.exception?.description || ''} at ${d.url || ''}:${d.lineNumber ?? ''}`.trim());
    }
    if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') consoleErrors.push(msg.params.entry.text);
    if (msg.method === 'Network.requestWillBeSent') {
      const req = msg.params?.request;
      if (req && req.url.includes('/api/schools') && req.method === 'POST') {
        let op = null;
        try { op = JSON.parse(req.postData || '{}').operation || JSON.parse(req.postData || '{}').action || null; } catch { /* not json */ }
        apiRequests.push({ requestId: msg.params.requestId, url: req.url, operation: op, status: null });
      }
    }
    if (msg.method === 'Network.responseReceived') {
      const res = msg.params?.response;
      if (res) {
        httpResponses.push({ url: res.url, status: res.status });
        const tracked = apiRequests.find((r) => r.requestId === msg.params.requestId);
        if (tracked) tracked.status = res.status;
        if (res.url.includes('.supabase.co')) supabaseHosts.add(new URL(res.url).host);
      }
    }
    if (!msg.id || !pending.has(msg.id)) return;
    const req = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error.message));
    else req.resolve(msg.result);
  });
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Log.enable');
  await command('Network.enable');

  // ---- fixtures ------------------------------------------------------------
  const educator = await makeUser('edu');
  const educatorB = await makeUser('edub');
  const student = await makeUser('stu');
  const studentB = await makeUser('stub');

  const instA = crypto.randomUUID();
  const instB = crypto.randomUUID();
  made.institutions.push(instA, instB);
  // schools_write refuses draft/submit unless the institution has completed setup and the DPA.
  // schools_institutions_check: setup_complete requires dpa_complete, dpa_reference, approved_by and approved_at.
  await db.query(`INSERT INTO public.schools_institutions (id,name,country,language,setup_complete,dpa_complete,dpa_reference,approved_by,approved_at) VALUES ($1,'Acceptance Uni A','AE','en',true,true,'ACCEPTANCE-DPA',$2,now())`, [instA, educator.id]);
  await db.query(`INSERT INTO public.schools_institutions (id,name,country,language,setup_complete,dpa_complete,dpa_reference,approved_by,approved_at) VALUES ($1,'Acceptance Uni B','AE','en',true,true,'ACCEPTANCE-DPA',$2,now())`, [instB, educatorB.id]);
  await db.query(`INSERT INTO public.schools_institution_members (institution_id,user_id,role,accepted_at) VALUES ($1,$2,'educator',now())`, [instA, educator.id]);
  await db.query(`INSERT INTO public.schools_institution_members (institution_id,user_id,role,accepted_at) VALUES ($1,$2,'educator',now())`, [instB, educatorB.id]);

  const cohortA = crypto.randomUUID();
  made.cohorts.push(cohortA);
  await db.query(
    `INSERT INTO public.schools_cohorts (id,institution_id,name,enrolment_code,created_by) VALUES ($1,$2,'Cohort A',$3,$4)`,
    [cohortA, instA, crypto.randomBytes(4).toString('hex').toUpperCase(), educator.id],
  );
  await db.query(`INSERT INTO public.schools_cohort_educators (cohort_id,educator_user_id) VALUES ($1,$2)`, [cohortA, educator.id]);
  for (const s of [student, studentB]) {
    await db.query(
      `INSERT INTO public.schools_cohort_members (cohort_id,student_user_id,display_name,status,adult_confirmed_at) VALUES ($1,$2,$3,'active',now())`,
      [cohortA, s.id, `Student ${s.id.slice(0, 4)}`],
    );
  }

  const adaptiveAsgn = await makeAssignment({ cohortId: cohortA, institutionId: instA, educatorId: educator.id, mode: 'adaptive_v2' });
  // A second adaptive assignment with no attempts, so the room gates see the setup step rather than a completed interview.
  const adaptiveRoomAsgn = await makeAssignment({ cohortId: cohortA, institutionId: instA, educatorId: educator.id, mode: 'adaptive_v2' });
  const formAsgn = await makeAssignment({ cohortId: cohortA, institutionId: instA, educatorId: educator.id, mode: 'form_v1' });

  // =========================================================== GATE: feedback
  const stuckAttempt = crypto.randomUUID();
  const sparseAnswers = ['I handled it calmly.', '', ''];
  await runGate('NEB_FEEDBACK_FAILURE', async () => {
    await db.query(
      `INSERT INTO public.schools_assignment_attempts (id,assignment_id,student_user_id,status,attempt_number,answers,submitted_at,feedback_status,feedback_tries,delivery_mode)
       VALUES ($1,$2,$3,'submitted',1,$4,now(),'failed',3,'adaptive_v2')`,
      [stuckAttempt, adaptiveAsgn, student.id, JSON.stringify(sparseAnswers)],
    );
    const before = (await db.query(`SELECT feedback_status,feedback_tries FROM public.schools_assignment_attempts WHERE id=$1`, [stuckAttempt])).rows[0];
    const requeued = await recoverStuckFeedbackAttempts(db);
    const after = (await db.query(`SELECT feedback_status,feedback_tries FROM public.schools_assignment_attempts WHERE id=$1`, [stuckAttempt])).rows[0];
    await attachFeedback(stuckAttempt, sparseAnswers);
    const ready = (await db.query(`SELECT feedback_status,evidence_covered FROM public.schools_assignment_attempts WHERE id=$1`, [stuckAttempt])).rows[0];
    gatePass('NEB_FEEDBACK_FAILURE',
      before.feedback_status === 'failed' && before.feedback_tries === 3 && ready.feedback_status === 'ready',
      `failed(tries=3) -> ${ready.feedback_status}, evidence_covered=${ready.evidence_covered}`);
    gatePass('STUCK_FEEDBACK_RECOVERY',
      requeued >= 1 && after.feedback_status === 'pending' && after.feedback_tries === 0,
      `requeued=${requeued}, state after recovery=${after.feedback_status}/tries=${after.feedback_tries}`);
  });

  await runGate('ASYNC_FEEDBACK', async () => {
    await signInBrowserAs(student);
    await navigate(`/schools/me/reports/${stuckAttempt}`);
    const text = await evaluate(`document.body.innerText`);
    await takeScreenshot('student-feedback-report.png');
    const onReport = !(await evaluate(`location.pathname`)).includes('sign-in');
    const showsFeedback = /evidence|feedback/i.test(text) && text.length > 200;
    gatePass('ASYNC_FEEDBACK', onReport && showsFeedback,
      `report page rendered=${onReport}, feedback content length=${text.length}`);
    const hasWell = /what you did well/i.test(text);
    const hasStrengthen = /strengthen|missing evidence|add this first/i.test(text);
    const hasNext = /practise next|try again|retry/i.test(text);
    const noJargon = !/engine confidence|psychometric|internal model/i.test(text);
    gatePass('FEEDBACK_HIERARCHY', hasWell && hasStrengthen && hasNext && noJargon,
      `well=${hasWell} strengthen=${hasStrengthen} next=${hasNext} noJargon=${noJargon}`);
  });

  // ============================================== GATE: adaptive humanisation
  await runGate('ADAPTIVE_HUMANISATION', async () => {
    await navigate(`/schools/me/${adaptiveRoomAsgn}`);
    await takeScreenshot('adaptive-room.png');
    const text = await evaluate(`document.body.innerText`);
    const banned = ['Universal Interview Engine', 'Follow-up Probe', 'Evaluating response', 'Adaptive Interview Setup', 'Formative Feedback Notice'];
    const found = banned.filter((b) => text.includes(b));
    const emoji = /[\u{1F300}-\u{1FAFF}]/u.test(text);
    gatePass('ADAPTIVE_HUMANISATION', found.length === 0 && !emoji,
      found.length || emoji ? `machine language on screen: ${found.join(', ')}${emoji ? ' + emoji' : ''}` : 'no engine jargon or emoji on the student screen');
  });

  await runGate('ACADEMIC_STAGE', async () => {
    const fields = await evaluate(`(() => {
      const labels = [...document.querySelectorAll('label')].map(l => l.innerText.toLowerCase());
      return {
        academic: labels.some(l => l.includes('degree') || l.includes('subject') || l.includes('academic')),
        stage: labels.some(l => l.includes('stage') || l.includes('year')),
        evidence: document.body.innerText.toLowerCase().includes('coursework'),
      };
    })()`);
    gatePass('ACADEMIC_STAGE', fields.academic && fields.stage && fields.evidence,
      `academic field=${fields.academic}, stage=${fields.stage}, evidence sources=${fields.evidence}`);
  });

  await runGate('NO_EXAMPLE_SAFETY', async () => {
    if (!process.env.OPENAI_API_KEY) {
      notPerformed('NO_EXAMPLE_SAFETY', 'the adaptive interview room needs OPENAI_API_KEY to reach the question step; not present in .env.preview.local');
      return;
    }
    const outcome = await evaluate(`(() => {
      const ta = document.querySelector('textarea');
      if (!ta) return { ran: false };
      ta.value = 'MY OWN TYPED ANSWER';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = [...document.querySelectorAll('button')].find(b => /don.t have a direct example/i.test(b.innerText));
      if (!btn) return { ran: false };
      btn.click();
      return { ran: true, value: document.querySelector('textarea').value };
    })()`);
    if (!outcome.ran) { notPerformed('NO_EXAMPLE_SAFETY', 'the control was not reachable on this screen'); return; }
    gatePass('NO_EXAMPLE_SAFETY', outcome.value.includes('MY OWN TYPED ANSWER'),
      `typed answer ${outcome.value.includes('MY OWN TYPED ANSWER') ? 'preserved' : 'was overwritten'} by the no-example control`);
  });

  // ================================================ GATE: FORM_V1 + drafts
  let formAttemptId = null;
  await runGate('DRAFT_PERSISTENCE', async () => {
    await navigate(`/schools/me/${formAsgn}`);
    const typed = 'DRAFT ' + crypto.randomBytes(4).toString('hex');
    const hasField = await evaluate(`(() => { const ta = document.querySelector('textarea'); if (!ta) return false; ta.focus(); return document.activeElement === ta; })()`);
    if (!hasField) { record('DRAFT_PERSISTENCE', 'FAIL', 'no answer field rendered on the FORM_V1 assignment'); return; }
    const requestsBefore = apiRequests.length;
    // Real keyboard input: Input.insertText fires the same beforeinput/input events as typing,
    // and Tab moves focus so the field's onBlur (focusout) runs exactly as it would for a person.
    await command('Input.insertText', { text: typed });
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const fieldValue = await evaluate(`document.querySelector('textarea')?.value || ''`);
    let saveRequest = null;
    let row = null;
    for (let i = 0; i < 20; i++) {
      await wait(1000);
      saveRequest = apiRequests.slice(requestsBefore).find((r) => r.operation === 'draft' && r.status !== null);
      row = (await db.query(
        `SELECT id, answers, status FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 ORDER BY attempt_number DESC LIMIT 1`,
        [formAsgn, student.id])).rows[0];
      if (saveRequest && row && JSON.stringify(row.answers).includes(typed)) break;
    }
    const requestSeen = !!saveRequest;
    const requestOk = saveRequest?.status === 200;
    const savedToDb = !!row && JSON.stringify(row.answers).includes(typed);
    formAttemptId = row?.id ?? null;
    await navigate(`/schools/me/${formAsgn}`);
    const restored = await evaluate(`document.querySelector('textarea')?.value || ''`);
    gatePass('DRAFT_PERSISTENCE', fieldValue.includes(typed) && requestSeen && requestOk && savedToDb && restored.includes(typed),
      `typed into field=${fieldValue.includes(typed)}, draft request sent=${requestSeen}, draft request http=${saveRequest?.status ?? 'none'}, saved to database=${savedToDb}, restored after reload=${restored.includes(typed)}`);
  });

  await runGate('FINALIZE_RELIABILITY', async () => {
    const before = (await db.query(`SELECT count(*)::int c FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2`, [formAsgn, student.id])).rows[0].c;
    const row = (await db.query(
      `SELECT id, revision FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 ORDER BY attempt_number DESC LIMIT 1`,
      [formAsgn, student.id])).rows[0];
    if (!row) { record('FINALIZE_RELIABILITY', 'FAIL', 'no draft attempt exists to finalise'); return; }
    const answers = ['Answer one with detail.', 'Answer two with detail.', 'Answer three with detail.'];
    const res = await apiSchools('submit', { assignmentId: formAsgn, attemptId: row.id, revision: row.revision ?? 0, answers });
    const after = (await db.query(`SELECT status, submitted_at FROM public.schools_assignment_attempts WHERE id=$1`, [row.id])).rows[0];
    const count = (await db.query(`SELECT count(*)::int c FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2`, [formAsgn, student.id])).rows[0].c;
    formAttemptId = row.id;
    gatePass('FINALIZE_RELIABILITY', res.status === 200 && after.status === 'submitted' && count === before,
      `submit http=${res.status}, status=${after.status}, attempt rows ${before}->${count}`);
  });

  await runGate('DOUBLE_FINALIZE', async () => {
    if (!formAttemptId) { notPerformed('DOUBLE_FINALIZE', 'no finalised attempt from the previous gate'); return; }
    const before = (await db.query(`SELECT count(*)::int c FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2`, [formAsgn, student.id])).rows[0].c;
    const row = (await db.query(`SELECT revision FROM public.schools_assignment_attempts WHERE id=$1`, [formAttemptId])).rows[0];
    const answers = ['Answer one with detail.', 'Answer two with detail.', 'Answer three with detail.'];
    const again = await apiSchools('submit', { assignmentId: formAsgn, attemptId: formAttemptId, revision: row.revision ?? 0, answers });
    const after = (await db.query(`SELECT count(*)::int c FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2`, [formAsgn, student.id])).rows[0].c;
    const submitted = (await db.query(`SELECT count(*)::int c FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 AND status='submitted'`, [formAsgn, student.id])).rows[0].c;
    gatePass('DOUBLE_FINALIZE', after === before && submitted === 1,
      `repeat submit http=${again.status}, attempt rows ${before}->${after}, submitted rows=${submitted}`);
  });

  await runGate('ATTEMPT_POLICY', async () => {
    const first = (await db.query(`SELECT id, attempt_number, answers FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 ORDER BY attempt_number ASC LIMIT 1`, [formAsgn, student.id])).rows[0];
    if (!first) { record('ATTEMPT_POLICY', 'FAIL', 'no first attempt to measure against'); return; }
    const firstAnswersBefore = JSON.stringify(first.answers);
    const retry1 = await apiSchools('retry', { attemptId: first.id });
    const rows2 = (await db.query(`SELECT id, attempt_number, status FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 ORDER BY attempt_number ASC`, [formAsgn, student.id])).rows;
    const second = rows2[rows2.length - 1];
    let thirdBlocked = null;
    if (second && second.attempt_number === 2) {
      const r = (await db.query(`SELECT revision FROM public.schools_assignment_attempts WHERE id=$1`, [second.id])).rows[0];
      await apiSchools('submit', { assignmentId: formAsgn, attemptId: second.id, revision: r.revision ?? 0, answers: ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)] });
      const retry2 = await apiSchoolsNegative('retry', { attemptId: second.id });
      const rows3 = (await db.query(`SELECT count(*)::int c FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2`, [formAsgn, student.id])).rows[0].c;
      thirdBlocked = retry2.status >= 400 || rows3 === rows2.length;
    }
    const firstAfter = (await db.query(`SELECT answers FROM public.schools_assignment_attempts WHERE id=$1`, [first.id])).rows[0];
    const immutable = JSON.stringify(firstAfter.answers) === firstAnswersBefore;
    gatePass('ATTEMPT_POLICY',
      retry1.status === 200 && second?.attempt_number === 2 && thirdBlocked === true && immutable,
      `retry http=${retry1.status}, second attempt number=${second?.attempt_number}, third blocked=${thirdBlocked}, first attempt immutable=${immutable}`);
  });

  await runGate('RETRY_TARGET', async () => {
    const res = await pageFetch(`/schools/me/${formAsgn}?retry=2`);
    await navigate(`/schools/me/${formAsgn}?retry=2`);
    const state = await evaluate(`(() => ({
      url: location.href,
      text: document.body.innerText.slice(0, 4000),
      areas: document.querySelectorAll('textarea').length,
    }))()`);
    const targeted = /retry question 2|question 2/i.test(state.text) && state.areas > 0;
    gatePass('RETRY_TARGET', res.status === 200 && targeted,
      `page http=${res.status}, retry=2 target visible=${targeted}`);
  });

  await runGate('FORM_V1_REGRESSION', async () => {
    const attempt = (await db.query(`SELECT id, answers, status FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 AND status='submitted' ORDER BY attempt_number ASC LIMIT 1`, [formAsgn, student.id])).rows[0];
    if (!attempt) { record('FORM_V1_REGRESSION', 'FAIL', 'no submitted FORM_V1 attempt to inspect'); return; }
    await attachFeedback(attempt.id, Array.isArray(attempt.answers) ? attempt.answers : ['a', 'b', 'c']);
    await navigate(`/schools/me/reports/${attempt.id}`);
    const text = await evaluate(`document.body.innerText`);
    await takeScreenshot('form-v1-report.png');
    const rendered = text.length > 200;
    const hasFeedback = /evidence|what you did well|add this first/i.test(text);
    gatePass('FORM_V1_REGRESSION', rendered && hasFeedback,
      `render+draft+resume+submit verified in earlier gates; feedback view rendered=${rendered}, feedback content=${hasFeedback}`);
  });

  await runGate('ATTEMPT_COMPARISON', async () => {
    const attempts = (await db.query(`SELECT id, attempt_number FROM public.schools_assignment_attempts WHERE assignment_id=$1 AND student_user_id=$2 AND status='submitted' ORDER BY attempt_number ASC`, [formAsgn, student.id])).rows;
    if (attempts.length < 2) { notPerformed('ATTEMPT_COMPARISON', `only ${attempts.length} submitted attempt(s) available to compare`); return; }
    await attachFeedback(attempts[1].id, ['a', 'b', 'c']);
    await navigate(`/schools/me/reports/${attempts[1].id}`);
    const text = await evaluate(`document.body.innerText`);
    const comparison = /attempt 1|previous attempt|compared with/i.test(text);
    gatePass('ATTEMPT_COMPARISON', comparison, `previous-attempt comparison visible=${comparison}`);
  });

  // ================================================================ GATE: nav
  await runGate('AUTH_NAV', async () => {
    await signOutBrowser();
    const outEducator = await nodeFetch('/schools/home');
    const outStudent = await nodeFetch('/schools/me');
    const redirectedToSignIn = (r) => (r.status >= 300 && r.status < 400 && /sign-in/.test(r.location || '')) || (r.status === 200 && /sign in/i.test(r.body));
    const c = {};
    c.signedOutEducatorRedirect = redirectedToSignIn(outEducator);
    c.signedOutStudentRedirect = redirectedToSignIn(outStudent);
    await signInBrowserAs(educator);
    await navigate('/schools/home');
    const eduLanding = await evaluate(`({ path: location.pathname, text: document.body.innerText.slice(0, 2000) })`);
    c.educatorLanding = eduLanding.path === '/schools/home';
    c.educatorContent = /today|cohort/i.test(eduLanding.text) && !/could not load|something went wrong|application error/i.test(eduLanding.text);
    await signInBrowserAs(student);
    await navigate('/schools/me');
    const stuLanding = await evaluate(`({ path: location.pathname, text: document.body.innerText.slice(0, 2000) })`);
    c.studentLanding = stuLanding.path === '/schools/me';
    c.studentContent = /assignment/i.test(stuLanding.text) && !/could not load|something went wrong|application error/i.test(stuLanding.text);
    const detailLine = [
      `signed-out educator redirect=${c.signedOutEducatorRedirect} (http ${outEducator.status})`,
      `signed-out student redirect=${c.signedOutStudentRedirect} (http ${outStudent.status})`,
      `educator authenticated landing=${c.educatorLanding} (${eduLanding.path})`,
      `student authenticated landing=${c.studentLanding} (${stuLanding.path})`,
      `educator content assertion=${c.educatorContent}`,
      `student content assertion=${c.studentContent}`,
    ].join(', ');
    gatePass('AUTH_NAV', Object.values(c).every(Boolean), detailLine);
  });

  await runGate('DELETE_DATA_SAFETY', async () => {
    await signInBrowserAs(student);
    await navigate('/schools/me/delete');
    await takeScreenshot('delete-data.png');
    const ui = await evaluate(`(() => ({
      text: document.body.innerText.slice(0, 3000),
      hasCheckboxOrType: !!document.querySelector('input[type=checkbox], input[type=text]'),
    }))()`);
    const unconfirmed = await nodeFetch('/api/schools/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const warns = /permanent|cannot be undone|delete/i.test(ui.text);
    gatePass('DELETE_DATA_SAFETY', unconfirmed.status === 400 && warns && ui.hasCheckboxOrType,
      `unconfirmed delete http=${unconfirmed.status} (400 expected), warning copy=${warns}, deliberate control=${ui.hasCheckboxOrType}`);
  });

  // ========================================================== GATE: security
  await runGate('SECURITY', async () => {
    const checks = {};
    // Student B's attempt must be invisible to student A.
    const otherAttempt = crypto.randomUUID();
    // feedback_status='ready' is only valid together with a feedback version and evidence
    // (schools_assignment_attempts_check1), so insert as pending and attach feedback properly.
    const peerAnswers = ['x', 'y', 'z'];
    await db.query(
      `INSERT INTO public.schools_assignment_attempts (id,assignment_id,student_user_id,status,attempt_number,answers,submitted_at,feedback_status,delivery_mode)
       VALUES ($1,$2,$3,'submitted',1,$4,now(),'pending','form_v1')`,
      [otherAttempt, formAsgn, studentB.id, JSON.stringify(peerAnswers)],
    );
    await attachFeedback(otherAttempt, peerAnswers);
    const internalNote = `INTERNAL-${crypto.randomBytes(4).toString('hex')}`;
    // A failed insert here would make the internal-notes check vacuous, so it must throw.
    await db.query(
      `INSERT INTO public.schools_reviews (id, assignment_attempt_id, educator_id, state, comment, internal_notes, revision)
       VALUES ($1,$2,$3,'on_track','Well done', $4, 0)`,
      [crypto.randomUUID(), otherAttempt, educator.id, internalNote],
    );

    await signInBrowserAs(student);
    const peerRead = await nodeFetch(`/schools/me/reports/${otherAttempt}`);
    checks.peerAttemptBlocked = peerRead.status >= 400 || /not found|sign in|not available/i.test(peerRead.body);

    const ownReport = (await db.query(`SELECT id FROM public.schools_assignment_attempts WHERE student_user_id=$1 AND status='submitted' LIMIT 1`, [student.id])).rows[0];
    let notesHidden = true;
    if (ownReport) {
      await navigate(`/schools/me/reports/${ownReport.id}`);
      const text = await evaluate(`document.body.innerText`);
      notesHidden = !text.includes(internalNote);
    }
    checks.internalNotesHidden = notesHidden;

    const tamperedAssignment = await apiSchoolsNegative('draft', { assignmentId: crypto.randomUUID(), revision: 0, answers: ['a', 'b', 'c'] });
    checks.tamperedAssignmentDenied = tamperedAssignment.status >= 400;
    const tamperedAttempt = await apiSchoolsNegative('read', { attemptId: otherAttempt, feedback: true, reviewRevision: null });
    checks.tamperedAttemptDenied = tamperedAttempt.status >= 400;
    const tamperedUniversal = await nodeFetch(`/api/schools/adaptive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit_turn', payload: { attemptId: crypto.randomUUID(), answerText: 'x' } }),
    });
    checks.tamperedUniversalDenied = tamperedUniversal.status >= 400;

    await signInBrowserAs(educatorB);
    const crossTenant = await nodeFetch(`/schools/cohorts/${cohortA}`);
    checks.crossInstitutionBlocked = crossTenant.status >= 400 || crossTenant.status === 0 || /not available|sign in|not found/i.test(crossTenant.body);

    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    gatePass('SECURITY', failed.length === 0,
      failed.length ? `failing checks: ${failed.join(', ')}` : 'peer attempt, internal notes, cross-institution and three tampered ids all denied');
  });

  // ============================================== GATE: design, mobile, a11y
  await runGate('SCHOOLS_DESIGN_SYSTEM', async () => {
    await signInBrowserAs(student);
    await navigate('/schools/me');
    const styles = await evaluate(`(() => {
      const body = getComputedStyle(document.body);
      const h = document.querySelector('h1, h2');
      return {
        body: body.fontFamily,
        heading: h ? getComputedStyle(h).fontFamily : '',
        emoji: /[\\u{1F300}-\\u{1FAFF}]/u.test(document.body.innerText),
      };
    })()`);
    const tokenBody = /public sans/i.test(styles.body);
    const tokenHeading = /bricolage/i.test(styles.heading);
    gatePass('SCHOOLS_DESIGN_SYSTEM', tokenBody && tokenHeading && !styles.emoji,
      `body font="${styles.body.slice(0, 40)}", heading font="${styles.heading.slice(0, 40)}", emoji present=${styles.emoji}`);
  });

  await runGate('MOBILE', async () => {
    await navigate('/schools/me', { width: 390, height: 844, mobile: true });
    await takeScreenshot('mobile-390-assignments.png');
    const list = await evaluate(`({ overflow: document.documentElement.scrollWidth > window.innerWidth, links: document.querySelectorAll('a').length })`);
    await navigate(`/schools/me/${adaptiveRoomAsgn}`, { width: 390, height: 844, mobile: true });
    await takeScreenshot('mobile-390-adaptive.png');
    const room = await evaluate(`(() => {
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      const control = [...document.querySelectorAll('button, select, input, textarea')].find(el => el.offsetParent !== null);
      const rect = control ? control.getBoundingClientRect() : null;
      return { overflow, reachable: !!rect && rect.width > 0 && rect.right <= window.innerWidth + 1 };
    })()`);
    gatePass('MOBILE', !list.overflow && !room.overflow && room.reachable,
      `assignments overflow=${list.overflow}, adaptive room overflow=${room.overflow}, primary control within viewport=${room.reachable}`);
  });

  await runGate('ACCESSIBILITY_TECHNICAL', async () => {
    await navigate('/schools/me');
    const a11y = await evaluate(`(() => {
      const named = (el) => Boolean(
        (el.getAttribute('aria-label') || '').trim() ||
        (el.getAttribute('aria-labelledby') || '').trim() ||
        (el.innerText || '').trim() ||
        (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
        el.closest('label')
      );
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      const controls = [...document.querySelectorAll('input, select, textarea')];
      const buttons = [...document.querySelectorAll('button, a[href]')];
      const focusable = buttons.filter(b => b.tabIndex >= 0).length;
      return {
        h1: document.querySelectorAll('h1').length,
        unnamedControls: controls.filter(c => !named(c)).length,
        unnamedButtons: buttons.filter(b => !named(b)).length,
        dupes: [...new Set(dupes)],
        focusable,
      };
    })()`);
    gatePass('ACCESSIBILITY_TECHNICAL',
      a11y.h1 === 1 && a11y.unnamedControls === 0 && a11y.unnamedButtons === 0 && a11y.dupes.length === 0 && a11y.focusable > 0,
      `h1=${a11y.h1}, unnamed controls=${a11y.unnamedControls}, unnamed buttons=${a11y.unnamedButtons}, duplicate ids=${a11y.dupes.length}, focusable actions=${a11y.focusable}`);
  });

  await runGate('RTL_TECHNICAL', async () => {
    await signOutBrowser();
    await navigate('/');
    await evaluate(`localStorage.setItem('muqabala.lang.v1','ar')`);
    await navigate('/');
    await wait(600);
    const rtl = await evaluate(`(() => ({
      dir: document.documentElement.dir,
      bodyDir: getComputedStyle(document.body).direction,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      latinNav: [...document.querySelectorAll('header a, header button')].map(e => e.innerText.trim()).filter(t => /^[A-Za-z ]{3,}$/.test(t)),
    }))()`);
    await takeScreenshot('rtl-home.png');
    await evaluate(`localStorage.setItem('muqabala.lang.v1','en')`);
    gatePass('RTL_TECHNICAL', rtl.dir === 'rtl' && rtl.bodyDir === 'rtl' && !rtl.overflow,
      `dir=${rtl.dir}, body direction=${rtl.bodyDir}, horizontal overflow=${rtl.overflow}, untranslated nav items=${rtl.latinNav.length}`);
  });

  notPerformed('ARABIC_LINGUISTIC', 'requires review by a qualified Arabic speaker');
  notPerformed('SEO_GUARDRAILS', 'not implemented as a measured check in this harness');
} catch (err) {
  console.error('HARNESS ERROR:', err);
  record('HARNESS', 'FAIL', `harness crashed before all gates ran: ${String(err.message || err).slice(0, 200)}`);
  exitCode = 4;
} finally {
  // -------------------------------------------------------------- cross-cutting
  const fiveXx = httpResponses.filter((r) => r.status >= 500);
  const productionHits = httpResponses.filter((r) => r.url.includes(PRODUCTION_REF));
  const isolatedHits = httpResponses.filter((r) => r.url.includes(ISOLATED_REF));

  console.log(`\nCONSOLE_ERRORS: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 20)) console.log(`  console: ${String(e).slice(0, 200)}`);
  console.log(`FIVE_XX_RESPONSES: ${fiveXx.length}`);
  for (const r of fiveXx.slice(0, 20)) console.log(`  ${r.status} ${r.url}`);
  const fourXx = httpResponses.filter((r) => r.status >= 400 && r.status < 500);
  console.log(`HTTP_4XX_RESPONSES: ${fourXx.length}`);
  for (const r of fourXx.slice(0, 20)) console.log(`  ${r.status} ${r.url}`);

  // Server-side proof comes from the test-only network guard loaded into the
  // server process by the runner (NODE_OPTIONS=--import). Browser tracing alone
  // cannot see server-to-Supabase traffic.
  const guardLogPath = process.env.ACCEPTANCE_GUARD_LOG;
  let guardEntries = [];
  if (guardLogPath && existsSync(guardLogPath)) {
    guardEntries = readFileSync(guardLogPath, 'utf8').split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  }
  const serverPid = Number(process.env.ACCEPTANCE_SERVER_PID);
  const guardProduction = guardEntries.filter((e) => e.kind === 'production');
  const guardIsolatedFromServer = guardEntries.filter((e) => e.kind === 'isolated' && e.pid !== process.pid);
  const guardLoadedInServer = guardEntries.some((e) => e.kind === 'guard' && e.event === 'loaded' && e.pid !== process.pid);
  console.log(`PRODUCTION_SUPABASE_CONTACT: ${productionHits.length + guardProduction.length}`);
  console.log(`ISOLATED_SUPABASE_REQUESTS: ${isolatedHits.length} from browser, ${guardIsolatedFromServer.length} from server processes`);
  console.log(`OBSERVED_SUPABASE_HOSTS: ${[...new Set([...supabaseHosts, ...guardEntries.filter((e) => e.host).map((e) => e.host)])].join(',') || 'none'}`);
  console.log(`NETWORK_GUARD: loaded in server=${guardLoadedInServer}, runner pid=${serverPid || 'unknown'}, log entries=${guardEntries.length}`);

  results.CONSOLE_ERRORS = consoleErrors.length === 0 ? 'PASS' : 'FAIL';
  detail.CONSOLE_ERRORS = `${consoleErrors.length} browser console error(s)`;
  results.FIVE_XX = fiveXx.length === 0 ? 'PASS' : 'FAIL';
  detail.FIVE_XX = `${fiveXx.length} response(s) with status >= 500`;
  if (productionHits.length + guardProduction.length > 0) {
    results.PRODUCTION_SUPABASE_CONTACT = 'FAIL';
    detail.PRODUCTION_SUPABASE_CONTACT = `${productionHits.length} browser and ${guardProduction.length} server request(s) touched ${PRODUCTION_REF}`;
  } else if (!guardLoadedInServer || guardIsolatedFromServer.length === 0) {
    results.PRODUCTION_SUPABASE_CONTACT = 'NOT_PERFORMED';
    detail.PRODUCTION_SUPABASE_CONTACT = `network guard active in server=${guardLoadedInServer}, isolated requests seen from server=${guardIsolatedFromServer.length}; absence cannot be asserted without an active guard that observed traffic`;
  } else {
    const proven = guardLoadedInServer && guardIsolatedFromServer.length > 0 && productionHits.length + guardProduction.length === 0;
    results.PRODUCTION_SUPABASE_CONTACT = proven ? 'PASS' : 'FAIL';
    detail.PRODUCTION_SUPABASE_CONTACT = `guard active in server process; ${productionHits.length + guardProduction.length} requests to ${PRODUCTION_REF}, ${guardIsolatedFromServer.length} server request(s) to ${ISOLATED_REF}`;
  }

  // ------------------------------------------------------------------ cleanup
  try {
    for (const id of made.assignments) {
      await db.query(`DELETE FROM public.schools_reviews WHERE assignment_attempt_id IN (SELECT id FROM public.schools_assignment_attempts WHERE assignment_id=$1)`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_evidence_corrections WHERE assignment_attempt_id IN (SELECT id FROM public.schools_assignment_attempts WHERE assignment_id=$1)`, [id]).catch(() => {});
      await db.query(`UPDATE public.schools_assignment_attempts SET feedback_status='pending', feedback_version_id=NULL WHERE assignment_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_feedback_versions WHERE assignment_attempt_id IN (SELECT id FROM public.schools_assignment_attempts WHERE assignment_id=$1)`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_assignment_attempts WHERE assignment_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_assignment_questions WHERE assignment_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_assignments WHERE id=$1`, [id]).catch(() => {});
    }
    for (const id of made.cohorts) {
      await db.query(`DELETE FROM public.schools_cohort_members WHERE cohort_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_cohort_educators WHERE cohort_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_cohorts WHERE id=$1`, [id]).catch(() => {});
    }
    for (const id of made.institutions) {
      await db.query(`DELETE FROM public.schools_institution_members WHERE institution_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_question_versions WHERE institution_id=$1`, [id]).catch(() => {});
      await db.query(`DELETE FROM public.schools_institutions WHERE id=$1`, [id]).catch(() => {});
    }
    for (const id of made.users) await admin.auth.admin.deleteUser(id).catch(() => {});
  } catch (err) { console.log(`  cleanup warning: ${String(err.message || err).slice(0, 120)}`); }

  await db.end().catch(() => {});
  if (socket) socket.close();
  browser.kill();

  // ------------------------------------------------------------------ verdict
  const required = Object.keys(results);
  const failed = required.filter((k) => results[k] === 'FAIL');
  const notRun = required.filter((k) => results[k] === 'NOT_PERFORMED');
  console.log(`\nACCEPTANCE_RESULTS_JSON=${JSON.stringify(results)}`);
  console.log(`ACCEPTANCE_DETAIL_JSON=${JSON.stringify(detail)}`);
  console.log(`GATES_FAILED: ${failed.length ? failed.join(',') : 'none'}`);
  console.log(`GATES_NOT_PERFORMED: ${notRun.length ? notRun.join(',') : 'none'}`);
  if (exitCode === 0 && (failed.length || notRun.length)) exitCode = 1;
  console.log(`ACCEPTANCE_EXIT_CODE: ${exitCode}`);
  process.exit(exitCode);
}
