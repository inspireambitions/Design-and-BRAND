import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

function uploader(outcomes) {
  const requests = [];
  const timers = [];
  class FakeXHR {
    constructor() { this.upload = {}; this.timeout = 0; requests.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader() {}
    send(body) {
      this.body = body;
      const outcome = outcomes[requests.length - 1] ?? 'hang';
      if (outcome === 'hang') {
        // A real XHR only fires its timeout when a non-zero deadline was set.
        if (this.timeout > 0) timers.push(() => this.ontimeout?.());
      } else {
        timers.push(() => { this.status = outcome; this.onload?.(); });
      }
    }
  }
  const source = readFileSync(new URL('../lib/screening-video-upload.ts', import.meta.url), 'utf8');
  const code = stripTypeScriptTypes(source, { mode: 'transform' }).replace('export async function', 'async function');
  const context = vm.createContext({
    XMLHttpRequest: FakeXHR, FormData, Blob,
    window: { setTimeout: callback => timers.push(callback) },
  });
  vm.runInContext(`${code}\nthis.runUpload = uploadScreeningVideo;`, context);
  return {
    requests,
    run: context.runUpload,
    async drain() {
      for (let turn = 0; turn < 20; turn += 1) {
        timers.shift()?.();
        await Promise.resolve();
        await Promise.resolve();
      }
    },
  };
}

const grant = { path: 'synthetic.webm', signedUrl: 'https://storage.example/synthetic', maxBytes: 1024 };
const blob = new Blob(['synthetic recording'], { type: 'video/webm' });

test('a hung upload retries and eventually rejects so the caller can offer draft recovery', async () => {
  const harness = uploader(['hang', 'hang', 'hang']);
  let settled = false;
  let failure;
  harness.run(grant, blob, blob.type, () => {}).then(
    () => { settled = true; },
    error => { settled = true; failure = error; },
  );
  await harness.drain();
  assert.equal(settled, true, 'an upload without a response must not stay pending forever');
  assert.match(failure?.message ?? '', /still saved on this device/);
  assert.equal(harness.requests.length, 3, 'automatic retries remain bounded');
  assert.ok(harness.requests.every(request => request.timeout > 0 && request.timeout <= 180_000));
  for (const request of harness.requests) {
    assert.equal(await request.body.get('').text(), await blob.text(), 'retry preserves recording bytes');
  }
});

test('a timeout followed by success uploads the same recording and completes normally', async () => {
  const harness = uploader(['hang', 200]);
  const progress = [];
  let settled = false;
  const result = harness.run(grant, blob, blob.type, value => progress.push(value)).then(() => { settled = true; });
  await harness.drain();
  assert.equal(settled, true);
  await result;
  assert.equal(harness.requests.length, 2);
  assert.equal(progress.at(-1), 100);
  assert.equal(await harness.requests[1].body.get('').text(), await blob.text());
});

test('expired permission does not waste retries on the same upload grant', async () => {
  const harness = uploader([403]);
  let failure;
  harness.run(grant, blob, blob.type, () => {}).catch(error => { failure = error; });
  await harness.drain();
  assert.match(failure?.message ?? '', /permission expired/);
  assert.equal(harness.requests.length, 1);
});
