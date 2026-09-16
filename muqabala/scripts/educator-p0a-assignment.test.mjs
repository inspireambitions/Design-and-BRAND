import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { INSTITUTIONAL_INDUSTRIES } from '../lib/schools/types.ts';

const uuid = z.string().uuid();
const assignmentSchema = z.object({
  cohortId: uuid,
  roleId: z.string().min(1).max(100),
  questionIds: z.array(uuid).min(3).max(8).refine((ids) => new Set(ids).size === ids.length, {
    message: 'Question IDs must be unique',
  }),
  dueAt: z.string().datetime({ offset: true }),
  industry: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(160).optional(),
  jobDescription: z.string().trim().max(50000).optional(),
  competencies: z.array(z.string().trim().max(100)).max(20).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
});

test('assignment contract accepts 3 through 8 unique questions', () => {
  const cohortId = 'c0000000-0000-4000-a000-000000000001';
  const dueAt = '2026-10-01T23:59:00Z';

  for (let count = 3; count <= 8; count++) {
    const questionIds = Array.from({ length: count }, (_, i) =>
      `q0000000-0000-4000-a000-00000000000${i + 1}`.replace('q', 'a')
    );

    const parsed = assignmentSchema.safeParse({
      cohortId,
      roleId: 'software-engineer',
      questionIds,
      dueAt,
      industry: 'technology',
      jobTitle: 'Junior Full-Stack Engineer',
      competencies: ['Problem Solving', 'Data Structures', 'Code Quality'],
      maxAttempts: 3,
    });

    assert.equal(parsed.success, true, `Count ${count} should be valid: ${JSON.stringify(parsed.error)}`);
  }
});

test('assignment contract rejects fewer than 3 or more than 8 questions', () => {
  const cohortId = 'c0000000-0000-4000-a000-000000000001';
  const dueAt = '2026-10-01T23:59:00Z';

  // 2 questions (too few)
  const twoQuestions = [
    'a0000000-0000-4000-a000-000000000001',
    'a0000000-0000-4000-a000-000000000002',
  ];
  const parsedTwo = assignmentSchema.safeParse({
    cohortId,
    roleId: 'accountant',
    questionIds: twoQuestions,
    dueAt,
  });
  assert.equal(parsedTwo.success, false);

  // 9 questions (too many)
  const nineQuestions = Array.from({ length: 9 }, (_, i) =>
    `a0000000-0000-4000-a000-00000000000${i + 1}`
  );
  const parsedNine = assignmentSchema.safeParse({
    cohortId,
    roleId: 'accountant',
    questionIds: nineQuestions,
    dueAt,
  });
  assert.equal(parsedNine.success, false);
});

test('assignment contract rejects duplicate question IDs', () => {
  const cohortId = 'c0000000-0000-4000-a000-000000000001';
  const dueAt = '2026-10-01T23:59:00Z';

  const duplicateQuestions = [
    'a0000000-0000-4000-a000-000000000001',
    'a0000000-0000-4000-a000-000000000002',
    'a0000000-0000-4000-a000-000000000001', // duplicate
  ];

  const parsed = assignmentSchema.safeParse({
    cohortId,
    roleId: 'finance-analyst',
    questionIds: duplicateQuestions,
    dueAt,
  });

  assert.equal(parsed.success, false);
});

test('supports multi-industry definitions without hardcoded teaching/hospitality bias', () => {
  assert.ok(INSTITUTIONAL_INDUSTRIES.length >= 8);
  const industryIds = INSTITUTIONAL_INDUSTRIES.map((i) => i.id);

  assert.ok(industryIds.includes('finance'));
  assert.ok(industryIds.includes('engineering'));
  assert.ok(industryIds.includes('technology'));
  assert.ok(industryIds.includes('healthcare'));
  assert.ok(industryIds.includes('retail'));
  assert.ok(industryIds.includes('government'));
});
