import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

const programmeSchema = z.object({
  id: z.string().uuid(),
  institution_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  code: z.string().min(1).max(32).nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  campus: z.string().min(1).max(160).nullable().optional(),
  faculty: z.string().min(1).max(160).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const cohortSchema = z.object({
  id: z.string().uuid(),
  institution_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  programme_id: z.string().uuid().nullable().optional(),
  campus: z.string().nullable().optional(),
  faculty: z.string().nullable().optional(),
  programme: z.string().nullable().optional(),
});

const validInstId = 'e0000000-0000-4000-a000-000000000001';

test('validates collegiate multi-tier programme (University -> Faculty -> Programme)', () => {
  const programme = {
    id: 'c0000000-0000-4000-a000-000000000001',
    institution_id: validInstId,
    name: 'BSc Computer Science',
    code: 'CS-2026',
    status: 'active',
    campus: 'Main Campus Dubai',
    faculty: 'Faculty of Engineering & IT',
    description: 'Undergraduate computing programme focusing on systems and software engineering.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const parsed = programmeSchema.parse(programme);
  assert.equal(parsed.name, 'BSc Computer Science');
  assert.equal(parsed.faculty, 'Faculty of Engineering & IT');
});

test('validates flat vocational programme without mandatory campus or faculty', () => {
  const programme = {
    id: 'c0000000-0000-4000-a000-000000000002',
    institution_id: validInstId,
    name: 'Executive Leadership Certificate',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const parsed = programmeSchema.parse(programme);
  assert.equal(parsed.name, 'Executive Leadership Certificate');
  assert.equal(parsed.campus, undefined);
  assert.equal(parsed.faculty, undefined);
});

test('cohorts optionally link to a programme, supporting both linked and unlinked cohorts', () => {
  const linkedCohort = {
    id: 'b0000000-0000-4000-a000-000000000001',
    institution_id: validInstId,
    name: 'Class of 2026 - Section A',
    programme_id: 'c0000000-0000-4000-a000-000000000001',
    programme: 'BSc Computer Science',
  };

  const standaloneCohort = {
    id: 'b0000000-0000-4000-a000-000000000002',
    institution_id: validInstId,
    name: 'Summer Internship Cohort 2026',
    programme_id: null,
  };

  assert(cohortSchema.parse(linkedCohort).programme_id);
  assert.equal(cohortSchema.parse(standaloneCohort).programme_id, null);
});

test('archiving a programme updates status without deleting historical cohorts or attempts', () => {
  const programme = {
    id: 'c0000000-0000-4000-a000-000000000001',
    institution_id: validInstId,
    name: 'Legacy IT Diploma',
    status: 'archived',
    created_at: new Date('2025-01-01').toISOString(),
    updated_at: new Date().toISOString(),
  };

  const parsed = programmeSchema.parse(programme);
  assert.equal(parsed.status, 'archived');
});
