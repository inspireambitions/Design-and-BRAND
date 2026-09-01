import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeFeedbackStreamChunk, FEEDBACK_STREAM_CONTENT_TYPE } from '../lib/feedback-stream.ts';
import { jsonResponse, streamResponse } from '../lib/server/feedback-stream-response.ts';

const feedback = {
  questionId: 'angry_guest',
  score: 70,
  status: 'scored',
  headline: 'Clear story, missing result',
  competencies: [{ id: 'service', label: 'Guest service', score: 7, evidence: 'I called housekeeping.' }],
  strengths: ['You said what you did first.'],
  improvements: ['Say how long the fix took.'],
  coachTip: 'End with the result.',
  source: 'ai',
};

async function readEvents(response) {
  const text = await response.text();
  return decodeFeedbackStreamChunk(text).events;
}

test('partials arrive before the final event and the final carries the JSON body', async () => {
  const response = streamResponse(async (emit) => {
    emit({ headline: 'Clear story, missing result' });
    emit({ headline: 'Clear story, missing result', strengths: ['You said what you did first.'] });
    return { status: 200, body: { feedback } };
  }, { 'Cache-Control': 'private, no-store' });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), new RegExp(FEEDBACK_STREAM_CONTENT_TYPE));
  assert.equal(response.headers.get('x-accel-buffering'), 'no');

  const events = await readEvents(response);
  assert.deepEqual(events.map((event) => event.type), ['partial', 'partial', 'final']);
  assert.deepEqual(events[1].partial.strengths, ['You said what you did first.']);
  assert.deepEqual(events[2].feedback, feedback);
  assert.equal(events[2].locked, undefined);
});

test('a timeout becomes a retryable error event, not a hung stream', async () => {
  const response = streamResponse(async () => ({
    status: 504,
    body: {
      error: {
        code: 'scoring_timeout',
        message: 'Feedback is taking longer than usual.',
        retryable: true,
        retryAfterSeconds: 0,
      },
    },
  }));
  const events = await readEvents(response);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  assert.equal(events[0].status, 504);
  assert.equal(events[0].error.code, 'scoring_timeout');
  assert.equal(events[0].error.message, 'Feedback is taking longer than usual.');
});

test('a thrown failure still closes the stream with an error event', async () => {
  const response = streamResponse(async () => {
    throw new Error('boom');
  });
  const events = await readEvents(response);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  assert.equal(events[0].status, 500);
  assert.equal(events[0].error.retryable, true);
});

test('locked answers stream no partials and the final says so', async () => {
  const response = streamResponse(async () => ({
    status: 200,
    body: { locked: true, feedback: { ...feedback, status: 'unscored', strengths: [], improvements: [] } },
  }));
  const events = await readEvents(response);
  assert.deepEqual(events.map((event) => event.type), ['final']);
  assert.equal(events[0].locked, true);
});

test('the JSON path is unchanged for clients that do not ask for a stream', async () => {
  const response = jsonResponse({ status: 503, body: { error: { code: 'x' } }, headers: { 'Retry-After': '5' } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '5');
  assert.deepEqual(await response.json(), { error: { code: 'x' } });
});
