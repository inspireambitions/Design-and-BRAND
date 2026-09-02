import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.argv[2] || 'http://localhost:3101/practice/universal';
const port = 9237;
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const browserPath = candidates.find((candidate) => existsSync(candidate));

if (!browserPath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH and run again.');

const profile = await mkdtemp(join(tmpdir(), 'muqabala-media-check-'));
const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  target,
], { stdio: 'ignore' });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findPage() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const page = pages.find((item) => item.type === 'page' && item.url.startsWith(target));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Browser startup is still in progress.
    }
    await wait(250);
  }
  throw new Error('The browser page did not become ready.');
}

let socket;
let nextId = 0;
const pending = new Map();

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

try {
  const page = await findPage();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  await command('Runtime.enable');
  await command('Page.enable');
  await command('Page.navigate', { url: target });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const readiness = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `({ href: location.href, ready: document.readyState, content: document.body?.innerText.trim().length || 0 })`,
    });
    const value = readiness.result?.value;
    if (value?.href?.startsWith(target) && value?.ready === 'complete' && value?.content > 0) break;
    await wait(250);
  }
  const evaluation = await command('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const pageHasContent = document.body.innerText.trim().length > 0;
      const errorOverlay = Boolean(document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay'));
      const getUserMediaPresent = typeof navigator.mediaDevices?.getUserMedia === 'function';
      const mediaRecorderPresent = typeof MediaRecorder !== 'undefined';
      if (!window.isSecureContext || !getUserMediaPresent || !mediaRecorderPresent) {
        return { href: location.href, pageHasContent, errorOverlay, secureContext: window.isSecureContext, getUserMediaPresent, mediaRecorderPresent, recordedBytes: 0 };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      await new Promise((resolve, reject) => {
        recorder.onerror = () => reject(new Error('recording_failed'));
        recorder.onstop = resolve;
        recorder.start(100);
        setTimeout(() => recorder.stop(), 750);
      });
      stream.getTracks().forEach((track) => track.stop());
      return {
        href: location.href,
        pageHasContent,
        errorOverlay,
        secureContext: window.isSecureContext,
        getUserMediaPresent,
        mediaRecorderPresent,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
        tracksStopped: stream.getTracks().every((track) => track.readyState === 'ended'),
        recordedBytes: new Blob(chunks).size,
      };
    })()`,
  });
  const result = evaluation.result?.value;
  console.log(JSON.stringify({ target, ...result }, null, 2));
  const passed = result?.pageHasContent
    && !result?.errorOverlay
    && result?.secureContext
    && result?.getUserMediaPresent
    && result?.mediaRecorderPresent
    && result?.audioTracks === 1
    && result?.videoTracks === 1
    && result?.tracksStopped
    && result?.recordedBytes > 0;
  if (!passed) process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    wait(3000),
  ]);
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
