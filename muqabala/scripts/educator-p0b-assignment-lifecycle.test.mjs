import test from 'node:test';
import assert from 'node:assert/strict';

function validateAssignmentUpdate({
  existingAssignment,
  hasAttempts,
  payload,
}) {
  if (!hasAttempts) {
    // No student attempts: educator can freely edit everything
    return {
      allowed: true,
      updated: {
        ...existingAssignment,
        ...payload,
      },
    };
  }

  // Attempts exist: check if payload touches protected assessment configuration
  const touchesQuestions = payload.questionIds && JSON.stringify(payload.questionIds) !== JSON.stringify(existingAssignment.questionIds);
  const touchesRole = payload.roleId && payload.roleId !== existingAssignment.roleId;
  const touchesIndustry = payload.industry && payload.industry !== existingAssignment.industry;
  const touchesCompetencies = payload.competencies && JSON.stringify(payload.competencies) !== JSON.stringify(existingAssignment.competencies);
  const touchesMaxAttempts = payload.maxAttempts != null && payload.maxAttempts !== existingAssignment.maxAttempts;
  const touchesJobDescription = payload.jobDescription && payload.jobDescription !== existingAssignment.jobDescription;

  if (touchesQuestions || touchesRole || touchesIndustry || touchesCompetencies || touchesMaxAttempts || touchesJobDescription) {
    throw new Error('Assessment content cannot be modified after student attempts have started. Use duplicate assignment instead.');
  }

  // Safe administrative metadata is allowed
  return {
    allowed: true,
    updated: {
      ...existingAssignment,
      dueAt: payload.dueAt ?? existingAssignment.dueAt,
      instructions: payload.instructions ?? existingAssignment.instructions,
      status: payload.status ?? existingAssignment.status,
    },
  };
}

function duplicateAssignment(existingAssignment, creatorId, newDueAt) {
  return {
    id: 'c0000000-0000-4000-a000-000000000099',
    cohortId: existingAssignment.cohortId,
    roleId: existingAssignment.roleId,
    industry: existingAssignment.industry,
    jobTitle: existingAssignment.jobTitle,
    jobDescription: existingAssignment.jobDescription,
    competencies: [...existingAssignment.competencies],
    questionIds: [...existingAssignment.questionIds],
    maxAttempts: existingAssignment.maxAttempts,
    instructions: existingAssignment.instructions,
    status: 'draft',
    version: existingAssignment.version + 1,
    duplicatedFromId: existingAssignment.id,
    createdBy: creatorId,
    dueAt: newDueAt || new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}

const baseAssignment = {
  id: 'c0000000-0000-4000-a000-000000000001',
  cohortId: 'c0000000-0000-4000-a000-000000000010',
  roleId: 'investment-analyst',
  industry: 'finance',
  jobTitle: 'Investment Analyst',
  jobDescription: 'Evaluate venture investments.',
  competencies: ['financial_modeling', 'due_diligence'],
  questionIds: ['q1', 'q2', 'q3'],
  maxAttempts: 2,
  instructions: 'Review company 10-K filings.',
  status: 'published',
  version: 1,
  dueAt: '2026-10-01T00:00:00Z',
};

test('freely allows complete editing when no student attempts exist', () => {
  const result = validateAssignmentUpdate({
    existingAssignment: baseAssignment,
    hasAttempts: false,
    payload: {
      roleId: 'senior-analyst',
      questionIds: ['q1', 'q2', 'q4', 'q5'],
      maxAttempts: 3,
      instructions: 'Updated instructions',
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.updated.roleId, 'senior-analyst');
  assert.equal(result.updated.questionIds.length, 4);
});

test('strictly blocks assessment content mutations once student attempts exist', () => {
  assert.throws(
    () => validateAssignmentUpdate({
      existingAssignment: baseAssignment,
      hasAttempts: true,
      payload: { questionIds: ['q1', 'q2', 'q9'] },
    }),
    /Assessment content cannot be modified after student attempts have started/
  );

  assert.throws(
    () => validateAssignmentUpdate({
      existingAssignment: baseAssignment,
      hasAttempts: true,
      payload: { competencies: ['marketing'] },
    }),
    /Assessment content cannot be modified after student attempts have started/
  );

  assert.throws(
    () => validateAssignmentUpdate({
      existingAssignment: baseAssignment,
      hasAttempts: true,
      payload: { maxAttempts: 5 },
    }),
    /Assessment content cannot be modified after student attempts have started/
  );
});

test('allows administrative metadata updates (deadline, instructions, status) even after attempts exist', () => {
  const result = validateAssignmentUpdate({
    existingAssignment: baseAssignment,
    hasAttempts: true,
    payload: {
      dueAt: '2026-10-15T00:00:00Z',
      instructions: 'Extended deadline for sports tournament.',
      status: 'closed',
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.updated.dueAt, '2026-10-15T00:00:00Z');
  assert.equal(result.updated.instructions, 'Extended deadline for sports tournament.');
  assert.equal(result.updated.status, 'closed');
  // Content remains untouched
  assert.deepEqual(result.updated.questionIds, ['q1', 'q2', 'q3']);
});

test('safe duplication creates a draft version tied to historical parent assignment', () => {
  const duplicate = duplicateAssignment(baseAssignment, 'u00000000-0000-4000-a000-000000000001', '2026-10-20T00:00:00Z');
  assert.equal(duplicate.status, 'draft');
  assert.equal(duplicate.version, 2);
  assert.equal(duplicate.duplicatedFromId, baseAssignment.id);
  assert.equal(duplicate.roleId, baseAssignment.roleId);
  assert.equal(duplicate.questionIds.length, 3);
});
