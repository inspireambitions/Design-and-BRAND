import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScreeningTranscript } from '../lib/screening-transcription.ts';

const empty = { transcript: '', transcriptSegments: [], transcriptTimingVersion: null };
const audio = new Blob(['synthetic audio'], { type: 'audio/mp4' });
const json = (body, status = 200) => Response.json(body, { status });

test('a service failure can retry the exact retained audio without a new recording', async () => {
  const bodies = [];
  const request = async (_url, init) => {
    bodies.push(await init.body.get('audio').text());
    assert.equal(init.body.get('timestamps'), 'segment');
    assert.equal(init.body.get('audio').type, 'audio/mp4');
    return bodies.length === 1 ? json({ error: {} }, 503)
      : json({ transcript: 'I called the supervisor and solved the problem', segments: [{ id: 'S001' }], timingVersion: 'openai-whisper-segment-v1' });
  };
  assert.deepEqual(await resolveScreeningTranscript(audio, empty, 'en', true, request), { ok: false, reason: 'service' });
  const result = await resolveScreeningTranscript(audio, empty, 'en', true, request);
  assert.equal(result.ok, true);
  assert.equal(result.value.transcriptTimingVersion, 'openai-whisper-segment-v1');
  assert.deepEqual(bodies, ['synthetic audio', 'synthetic audio']);
  assert.equal(await audio.text(), 'synthetic audio');
});

test('empty and short successful transcripts are distinct from missing audio and service errors', async () => {
  for (const transcript of ['', 'Thank you']) {
    assert.deepEqual(await resolveScreeningTranscript(audio, empty, 'en', true, async () => json({ transcript })), { ok: false, reason: 'short_transcript' });
  }
  assert.deepEqual(await resolveScreeningTranscript(null, empty, 'en', true, async () => assert.fail('must not send video')), { ok: false, reason: 'missing_audio' });
  for (const request of [async () => { throw new Error('offline'); }, async () => new Response('<html>'), async () => json({})]) {
    assert.deepEqual(await resolveScreeningTranscript(audio, empty, 'en', true, request), { ok: false, reason: 'service' });
  }
});

test('untimed browser words cannot silently create an answer that blocks the report', async () => {
  const fallback = { ...empty, transcript: 'I asked my manager for help and resolved it' };
  for (const source of [audio, null]) {
    const result = await resolveScreeningTranscript(source, fallback, 'en', true, async () => json({}, 429));
    assert.deepEqual(result, { ok: false, reason: source ? 'service' : 'missing_audio' });
  }
});

test('a successful untimed response retains audio for a timed retry', async () => {
  const fallback = { ...empty, transcript: 'I asked my manager for help and resolved it' };
  const bodies = [];
  const request = async (_url, init) => {
    bodies.push(await init.body.get('audio').text());
    return json({ transcript: fallback.transcript, segments: bodies.length === 1 ? [] : [{ id: 'S001' }],
      timingVersion: bodies.length === 1 ? null : 'openai-whisper-segment-v1' });
  };
  assert.deepEqual(await resolveScreeningTranscript(audio, fallback, 'en', true, request), { ok: false, reason: 'service' });
  assert.equal((await resolveScreeningTranscript(audio, fallback, 'en', true, request)).ok, true);
  assert.deepEqual(bodies, ['synthetic audio', 'synthetic audio']);
});

test('fixed-question interviews keep their existing optional transcription behaviour', async () => {
  assert.deepEqual(await resolveScreeningTranscript(audio, empty, 'ar', false, async (_url, init) => {
    assert.equal(init.body.get('lang'), 'ar'); return json({}, 503);
  }), { ok: true, value: empty });
});
