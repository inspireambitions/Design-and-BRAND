import assert from 'node:assert/strict';
import test from 'node:test';

process.env.INTERVIEW_SECRET = 'test-secret-key-1234567890123456';

import { getOrCreateAdaptiveAssignmentSession } from '../lib/schools/adaptive-adapter.ts';

test('PHASE 8: Adaptive Retry Question Targeting', async () => {
  const assignmentId = '00000000-0000-4000-8000-000000000030';
  const studentUserId = '00000000-0000-4000-8000-000000000002';

  const canonicalQuestions = [
    {
      versionId: '00000000-0000-4000-8000-000000000100',
      questionIndex: 0,
      questionText: 'Question 1: What projects best prepare you for this role?',
      noExampleFollowUp: 'Think about coursework or personal projects.',
      rubric: [{ id: 'r1', label: 'Rubric 1', description: 'desc 1' }],
    },
    {
      versionId: '00000000-0000-4000-8000-000000000101',
      questionIndex: 1,
      questionText: 'Describe a situation where you evaluated complex financial data to make a recommendation?',
      noExampleFollowUp: 'Think about a lab or case study.',
      rubric: [{ id: 'r2', label: 'Rubric 2', description: 'desc 2' }],
    },
    {
      versionId: '00000000-0000-4000-8000-000000000102',
      questionIndex: 2,
      questionText: 'Tell me about a time when you handled a difficult disagreement with team members?',
      noExampleFollowUp: 'Think about a team project conflict.',
      rubric: [{ id: 'r3', label: 'Rubric 3', description: 'desc 3' }],
    },
    {
      versionId: '00000000-0000-4000-8000-000000000103',
      questionIndex: 3,
      questionText: 'What steps are you taking towards your long-term analytical goals?',
      noExampleFollowUp: 'Think about your career aspirations.',
      rubric: [{ id: 'r4', label: 'Rubric 4', description: 'desc 4' }],
    },
  ];

  let attempts = [];

  function createMockSupabase() {
    return {
      from(table) {
        return {
          select(_cols) {
            return {
              eq(_col, _val) {
                if (table === 'schools_assignments') {
                  return {
                    single() {
                      return Promise.resolve({
                        data: {
                          id: assignmentId,
                          cohort_id: 'cohort_1',
                          role_id: 'analyst',
                          job_title: 'Financial Analyst',
                          job_description: 'Analyse financial statements and recommend investments',
                          competencies: [],
                          max_attempts: 3,
                          delivery_mode: 'adaptive_v2',
                          version: 1,
                        },
                        error: null,
                      });
                    },
                  };
                }
                if (table === 'schools_assignment_questions') {
                  return {
                    order(_orderCol) {
                      return Promise.resolve({
                        data: canonicalQuestions.map((q) => ({
                          question_index: q.questionIndex,
                          question_version_id: q.versionId,
                        })),
                        error: null,
                      });
                    },
                  };
                }
                if (table === 'schools_assignment_attempts') {
                  return {
                    eq(_col2, _val2) {
                      return {
                        order(_oCol, _opts) {
                          return Promise.resolve({
                            data: [...attempts],
                            error: null,
                          });
                        },
                      };
                    },
                  };
                }
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: null, error: null });
                  },
                };
              },
              in(_col, _vals) {
                if (table === 'schools_question_versions') {
                  return Promise.resolve({
                    data: canonicalQuestions.map((q) => ({
                      id: q.versionId,
                      question_text: q.questionText,
                      no_example_follow_up: q.noExampleFollowUp,
                      rubric: q.rubric,
                    })),
                    error: null,
                  });
                }
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
          insert(payload) {
            if (table === 'schools_assignment_attempts') {
              attempts.push(payload);
            }
            return Promise.resolve({ data: payload, error: null });
          },
          update(payload) {
            return {
              eq(_col, _val) {
                return Promise.resolve({ data: payload, error: null });
              },
            };
          },
        };
      },
    };
  }

  const mockDb = createMockSupabase();

  // Check 1: Normal initial session starts at Question 1
  const session1 = await getOrCreateAdaptiveAssignmentSession({
    assignmentId,
    studentUserId,
    client: mockDb,
  });

  assert.equal(session1.state.question_number, 1);
  assert.match(session1.state.current_question?.candidate_text || '', /projects best prepare you/);
  assert.equal(session1.canonicalQuestions.length, 4);

  // Submit attempt 1
  attempts[0].status = 'submitted';
  attempts[0].answers = ['Ans 1', 'Ans 2', 'Ans 3', 'Ans 4'];

  // Check 2: Retry targeting Question 3 with targetQuestion: 3
  const sessionRetryQ3 = await getOrCreateAdaptiveAssignmentSession({
    assignmentId,
    studentUserId,
    retry: true,
    targetQuestion: 3,
    client: mockDb,
  });

  assert.equal(sessionRetryQ3.attemptNumber, 2);
  assert.equal(sessionRetryQ3.state.question_number, 3, 'Must start on Question 3');
  assert.match(sessionRetryQ3.state.current_question?.candidate_text || '', /difficult disagreement/);
  // Prior answers up to Question 3 should be preserved
  const attempt2 = attempts.find((a) => a.id === sessionRetryQ3.attemptId);
  assert.equal(attempt2.answers[0], 'Ans 1');
  assert.equal(attempt2.answers[1], 'Ans 2');

  // Submit attempt 2
  attempt2.status = 'submitted';

  // Check 3: Retry passing numeric retry parameter e.g. retry: 2
  const sessionRetryQ2 = await getOrCreateAdaptiveAssignmentSession({
    assignmentId,
    studentUserId,
    retry: 2,
    client: mockDb,
  });

  assert.equal(sessionRetryQ2.state.question_number, 2, 'Must start on Question 2 when passed as numeric retry');
  assert.match(sessionRetryQ2.state.current_question?.candidate_text || '', /complex financial data/);

  // Check 4: Retry targeting Question 1
  const sessionRetryQ1 = await getOrCreateAdaptiveAssignmentSession({
    assignmentId,
    studentUserId,
    retry: true,
    targetQuestion: 1,
    client: mockDb,
  });

  assert.equal(sessionRetryQ1.state.question_number, 1, 'Must start on Question 1');
  assert.match(sessionRetryQ1.state.current_question?.candidate_text || '', /projects best prepare you/);
});
