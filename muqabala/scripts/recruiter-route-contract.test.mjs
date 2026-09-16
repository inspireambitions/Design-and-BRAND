import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { catalogueInterviewRole } from '../lib/interview-catalogue.ts';
import { CreateInterviewSchema } from '../lib/interviews.ts';
import * as interviewToken from '../lib/interview-token.ts';
import * as recruiterSuite from '../lib/recruiter-suite.ts';
import { ScreeningPackRequestSchema } from '../lib/screening-pack-request.ts';
import { trustedInterviewPlan } from '../lib/interview-plan.ts';
import * as pagination from '../lib/pagination.ts';

const require = createRequire(import.meta.url);
process.env.INTERVIEW_SECRET ||= 'recruiter-route-contract-secret-2026';

async function transpiledExports(path, dependencies) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: id => dependencies[id] ?? require(id),
    Request,
    Response,
    URL,
    AbortSignal,
    Buffer,
    process,
    setTimeout,
    clearTimeout,
  });
  return exports;
}

function createAdminStore() {
  const store = { pack: null, audit: [] };
  const admin = {
    from(table) {
      if (table === 'recruiter_audit_events') return { insert: async row => { store.audit.push(row); return { error: null }; } };
      if (table !== 'screening_packs') throw new Error(`Unexpected table ${table}`);
      const builder = {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        not() { return this; },
        update() { return this; },
        async maybeSingle() { return { data: null, error: null }; },
        insert(row) {
          store.pack = { ...row, id: '11111111-1111-4111-8111-111111111111' };
          return { select: () => ({ single: async () => ({ data: { id: store.pack.id }, error: null }) }) };
        },
      };
      return builder;
    },
  };
  return { store, admin };
}

async function createPackRoute(admin) {
  return (await transpiledExports('app/api/screening/packs/route.ts', {
    'next/server': { after: () => {} },
    '@/app/api/interview/route': { POST: async () => Response.json({ tailored: false }) },
    '@/lib/advert-cache': { ADVERT_CACHE_VERSION: 'test-v1' },
    '@/lib/interview-catalogue': { CATALOGUE_INTERVIEW_VERSION: 'catalogue-v1', catalogueInterviewRole },
    '@/lib/interview-token': interviewToken,
    '@/lib/recruiter-suite': recruiterSuite,
    '@/lib/server/security': { configuredOrigin: () => 'https://preview.example.test', hasTrustedOrigin: () => true },
    '@/lib/rate-limit': { limitInterviewGeneration: async () => ({ limited: false, retryAfterSeconds: 0 }) },
    '@/lib/screening-pack-request': { ScreeningPackRequestSchema },
    '@/lib/sentry-server': { reportOperationalEvent: () => {}, reportOperationalFailure: () => {} },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { currentUser: async () => ({ id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.test', email_confirmed_at: '2026-09-15T00:00:00Z' }) },
  })).POST;
}

async function publicPackLoader(row) {
  const stored = {
    ...row,
    public_code: 'ABCDEF12',
    starts_used: 0,
    question_source: row.question_source,
    questionnaire_language: row.questionnaire_language,
  };
  const builder = {
    update() { return this; }, select() { return this; }, eq() { return this; }, is() { return this; }, not() { return this; },
    async maybeSingle() { return { data: stored, error: null }; },
  };
  const exports = await transpiledExports('lib/screening-pack.ts', {
    'server-only': {},
    react: { cache: fn => fn },
    '@/lib/interview-token': interviewToken,
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => builder }) },
  });
  return exports.getScreeningPack('ABCDEF12');
}

test('real creation route, public loader and start-plan contract support fixed counts 3 through 8', async () => {
  const role = catalogueInterviewRole('Receptionist');
  for (let count = 3; count <= 8; count += 1) {
    const { store, admin } = createAdminStore();
    const post = await createPackRoute(admin);
    const questions = role.questions.slice(0, count).map(({ id, text, textAr }) => ({ id, text, textAr }));
    const response = await post(new Request('https://preview.example.test/api/screening/packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Nour Clinic', jobTitle: 'Receptionist', location: 'Dubai', timezone: 'Asia/Dubai',
        questions, questionnaireLanguage: 'both', maxCandidates: 25, expiryDays: 30,
      }),
    }));
    assert.equal(response.status, 201, `creation count ${count}`);
    assert.equal(store.pack.question_source, 'employer_reviewed');
    assert.equal(store.pack.questionnaire_language, 'both');
    const loaded = await publicPackLoader(store.pack);
    assert.equal(loaded.status, 'active', `loader count ${count}`);
    assert.equal(loaded.role.questions.length, count);
    const plan = trustedInterviewPlan({
      roleId: loaded.role.id,
      roleTitle: loaded.role.title,
      mode: 'screening',
      questions: loaded.role.questions.map(({ id }) => ({ id })),
      interviewToken: loaded.signedToken,
    });
    assert.equal(plan?.questions.length, count, `start count ${count}`);
    assert.deepEqual(
      plan?.questions.map(({ id }) => id),
      loaded.role.questions.map(({ id }) => id),
    );
  }
});

async function runInterviewPost({ questionSource }) {
  const role = catalogueInterviewRole('Receptionist');
  const questions = role.questions.slice(0, 4);
  const interviewToken = interviewTokenModule.signProofPack({
    title: role.title,
    industry: role.industry,
    level: role.level,
    competencies: role.competencies,
    questions,
    workplace: 'Nour Clinic',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  const calls = { brain: 0, snapshots: [], cookies: [] };
  const admin = {
    from(table) {
      assert.equal(table, 'screening_packs');
      const builder = { select() { return this; }, eq() { return this; }, not() { return this; }, gt() { return this; }, async maybeSingle() { return { data: { id: 'pack-id', question_source: questionSource }, error: null }; } };
      return builder;
    },
    async rpc(name, args) {
      assert.equal(name, 'start_screening_interview');
      calls.snapshots.push(args.p_question_snapshot);
      return { data: { status: 'started', interview_id: 'interview-id' }, error: null };
    },
  };
  const post = (await transpiledExports('app/api/interviews/route.ts', {
    'node:crypto': { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    'next/headers': { cookies: async () => ({ set: (...args) => calls.cookies.push(args) }) },
    '@/lib/interviews': { CreateInterviewSchema },
    '@/lib/interview-plan': { trustedInterviewPlan },
    '@/lib/universal-interview/api': { universalInterviewEnabled: () => true },
    '@/lib/universal-interview/employer': {
      createEmployerBrainState: () => { calls.brain += 1; return { interview_id: 'interview-id', screening: {}, current_question: { question_id: 'adaptive-question' } }; },
      employerBrainQuestionSnapshot: () => ({ id: 'adaptive-replacement' }),
      publicEmployerBrainState: () => ({ adaptive: true }),
    },
    '@/lib/universal-interview/repository': { createStoredInterview: async () => {}, discardStoredInterview: async () => {}, loadStoredInterview: async () => null },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { currentUser: async () => ({ id: 'candidate-id', email: 'candidate@example.test', email_confirmed_at: '2026-09-15T00:00:00Z' }) },
    '@/lib/server/security': {
      ATTEMPT_COOKIE: 'attempt', hasTrustedOrigin: () => true, newOpaqueToken: () => 'opaque-token', privateNoStoreHeaders: () => ({}),
      screeningAttemptCookie: id => `attempt-${id}`, screeningPackAttemptCookie: id => `pack-${id}`, tokenHash: value => `hash-${value}`,
    },
  })).POST;
  const response = await post(new Request('https://preview.example.test/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roleId: 'custom',
      roleTitle: role.title,
      language: 'en',
      mode: 'screening',
      questions,
      interviewToken,
      candidateName: 'Test Candidate',
      adaptive: true,
    }),
  }));
  return { response, calls, questions };
}

const interviewTokenModule = interviewToken;

test('real interview POST cannot switch employer-reviewed questions to adaptive mode', async () => {
  const fixed = await runInterviewPost({ questionSource: 'employer_reviewed' });
  assert.equal(fixed.response.status, 201, JSON.stringify(await fixed.response.clone().json()));
  assert.equal(fixed.calls.brain, 0);
  assert.deepEqual(fixed.calls.snapshots[0].map(({ id }) => id), fixed.questions.map(({ id }) => id));

  const catalogue = await runInterviewPost({ questionSource: 'catalogue' });
  assert.equal(catalogue.response.status, 201);
  assert.equal(catalogue.calls.brain, 1);
  assert.equal(JSON.stringify(catalogue.calls.snapshots[0]), JSON.stringify([{ id: 'adaptive-replacement' }]));
});

test('real reminder preview GET reaches invitation 501 through authorized pagination', async () => {
  const role = catalogueInterviewRole('Receptionist');
  const signedToken = interviewToken.signProofPack({
    title: role.title, industry: role.industry, level: role.level, competencies: role.competencies,
    questions: role.questions.slice(0, 3), workplace: 'Nour Clinic', expiresAt: '2099-01-01T00:00:00.000Z',
  });
  const invitations = Array.from({ length: 501 }, (_, index) => ({
    id: `invite-${index}`, name: `Candidate ${index}`, email: `candidate-${index}@example.test`, status: 'invited',
    contact_allowed: true, opted_out_at: null, withdrawn_at: null, deleted_at: null, last_manual_reminder_at: null,
    first_reminder_at: null, second_reminder_at: null, completion_reminder_at: null,
  }));
  const employerClient = {
    from(table) {
      if (table === 'screening_packs') {
        return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: 'role-id', public_code: 'ABCDEF12', workplace: 'Nour Clinic', signed_token: signedToken, expires_at: '2099-01-01T00:00:00.000Z', reminders_enabled: true, timezone: 'Asia/Dubai' }, error: null }; } };
      }
      assert.equal(table, 'role_invites');
      let from = 0; let to = 99;
      const builder = {
        select() { return this; }, eq() { return this; }, order() { return this; }, range(nextFrom, nextTo) { from = nextFrom; to = nextTo; return this; },
        then(resolve, reject) { return Promise.resolve({ data: invitations.slice(from, to + 1), error: null, count: invitations.length }).then(resolve, reject); },
      };
      return builder;
    },
  };
  const admin = { from: () => ({ select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [] }); } }) };
  const get = (await transpiledExports('app/api/employer/roles/[roleId]/reminders/route.ts', {
    'next/server': { after: () => {} },
    '@/lib/interview-token': interviewToken,
    '@/lib/pagination': pagination,
    '@/lib/recruiter-suite': recruiterSuite,
    '@/lib/server/employer-messages': { employerEmailConfigured: () => false, processEmployerMessages: async () => ({}) },
    '@/lib/server/security': { hasTrustedOrigin: () => true, privateNoStoreHeaders: () => ({}) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { createClient: async () => employerClient, currentUser: async () => ({ id: 'owner-id', email_confirmed_at: '2026-09-15T00:00:00Z' }) },
  })).GET;
  const response = await get(new Request('https://preview.example.test/api/employer/roles/role-id/reminders?page=6'), { params: Promise.resolve({ roleId: 'role-id' }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.recipients.length, 1);
  assert.equal(body.recipients[0].id, 'invite-500');
  assert.deepEqual(body.pagination, { page: 6, pageSize: 100, total: 501, totalPages: 6 });
});
