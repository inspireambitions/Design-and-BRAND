import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { catalogueInterviewRole } from '../lib/interview-catalogue.ts';
import * as interviewToken from '../lib/interview-token.ts';
import * as recruiterSuite from '../lib/recruiter-suite.ts';
import { ScreeningPackRequestSchema } from '../lib/screening-pack-request.ts';
import { trustedInterviewPlan } from '../lib/interview-plan.ts';

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
