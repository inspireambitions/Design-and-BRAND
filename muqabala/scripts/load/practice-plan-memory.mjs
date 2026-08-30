import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const { MemoryEmailProvider } = await import('../../lib/practice-plan/email-provider.ts');
const { buildSevenDayPlan } = await import('../../lib/practice-plan/plan.ts');
const { SevenDayPlanSchema } = await import('../../lib/practice-plan/schema.ts');

const iterations = Number(process.env.PRACTICE_PLAN_LOAD_ITERATIONS ?? 2_000);
assert.ok(Number.isInteger(iterations) && iterations > 0 && iterations <= 100_000);

const feedback = {
  questionId: 'q1', score: 70, status: 'scored', headline: 'Useful structure', competencies: [],
  strengths: ['Clear personal action.'], improvements: ['Add a measurable result.'],
  coachTip: 'End with what changed.', source: 'ai',
};
const provider = new MemoryEmailProvider();
const started = performance.now();

for (let index = 0; index < iterations; index += 1) {
  const plan = SevenDayPlanSchema.parse(buildSevenDayPlan(index % 2 ? 'ar' : 'en', 'Test role', [
    { questionText: 'Test question', feedback },
  ]));
  await provider.send({
    to: 'delivered@resend.dev',
    from: 'Muqabala Practice <practice@trymuqabala.com>',
    subject: plan.summary,
    html: '<p>mock</p>',
    text: 'mock',
    idempotencyKey: `practice-plan/load-${index}/v1`,
  });
}

assert.equal(provider.messages.length, iterations);
const elapsedMs = performance.now() - started;
console.log(JSON.stringify({ event: 'practice_plan_load_complete', transport: 'memory', iterations, elapsedMs: Math.round(elapsedMs), operationsPerSecond: Math.round(iterations / (elapsedMs / 1_000)) }));
