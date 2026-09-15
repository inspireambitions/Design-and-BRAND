import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3101';
const port = 9239;
const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const browserPath = candidates.find((candidate) => existsSync(candidate));
if (!browserPath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH and run again.');

const profile = await mkdtemp(join(tmpdir(), 'muqabala-interactions-'));
const outputDir = new URL('../docs/reviews/assets/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = spawn(browserPath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-background-networking',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findPage() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const page = pages.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Browser startup is still in progress.
    }
    await wait(125);
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

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result?.value;
}

async function navigate(path, { width, height, mobile = false, reducedMotion = false }) {
  await command('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
  await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
  });
  await command('Page.navigate', { url: `${baseUrl}${path}` });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(`({ state: document.readyState, content: document.body?.innerText.length || 0 })`);
    if (ready?.state === 'complete' && ready.content > 0) break;
    await wait(125);
  }
  await wait(250);
}

async function screenshot(name) {
  const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(new URL(name, outputDir), Buffer.from(shot.data, 'base64'));
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

  await navigate('/faq', { width: 390, height: 844, mobile: true });
  const faq = await evaluate(`(() => {
    const sections = [...document.querySelectorAll('.info-section-disclosure')];
    const first = sections[0]?.querySelector('details');
    const directAnswers = sections.map(section => section.querySelector('.info-answer > p')?.textContent?.trim() || '');
    first?.querySelector('summary')?.click();
    return {
      title: document.title,
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sections: sections.length,
      directAnswersVisible: directAnswers.every(Boolean),
      firstDisclosureOpened: Boolean(first?.open),
      consoleOverlay: Boolean(document.querySelector('[data-nextjs-dialog], #webpack-dev-server-client-overlay')),
    };
  })()`);
  await wait(250);
  await screenshot('faq-mobile-en.png');

  await navigate('/faq', { width: 390, height: 844, mobile: true, reducedMotion: true });
  const reduced = await evaluate(`({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    standardToken: getComputedStyle(document.documentElement).getPropertyValue('--motion-standard').trim(),
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
  })`);
  await screenshot('faq-mobile-reduced-motion.png');

  await evaluate(`localStorage.setItem('muqabala.lang.v1', 'ar')`);
  await navigate('/faq', { width: 390, height: 844, mobile: true });
  const rtl = await evaluate(`({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    bodyDir: document.body.dir,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    arabicDisclosure: document.querySelector('.info-section-disclosure summary')?.textContent?.trim(),
  })`);
  await screenshot('faq-mobile-ar.png');

  await evaluate(`localStorage.setItem('muqabala.lang.v1', 'en')`);
  await navigate('/practice/front-office-agent', { width: 1280, height: 900 });
  const practice = await evaluate(`({
    title: document.title,
    hasModeChoices: document.body.innerText.includes('Full interview') && document.body.innerText.includes('Quick guided practice'),
    hasAnswerChoices: document.body.innerText.includes('Type') && document.body.innerText.includes('Speak') && document.body.innerText.includes('Video'),
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    consoleOverlay: Boolean(document.querySelector('[data-nextjs-dialog], #webpack-dev-server-client-overlay')),
  })`);
  await screenshot('practice-desktop-en.png');

  const result = {
    baseUrl,
    faq,
    reduced,
    rtl,
    practice,
    passed: faq?.sections === 6
      && faq?.directAnswersVisible
      && faq?.firstDisclosureOpened
      && !faq?.consoleOverlay
      && faq?.scrollWidth <= faq?.viewport
      && reduced?.reduced
      && reduced?.standardToken === '1ms'
      && reduced?.scrollWidth <= reduced?.viewport
      && rtl?.lang === 'ar'
      && rtl?.dir === 'rtl'
      && rtl?.bodyDir === 'rtl'
      && rtl?.scrollWidth <= rtl?.viewport
      && practice?.hasModeChoices
      && practice?.hasAnswerChoices
      && !practice?.consoleOverlay
      && practice?.scrollWidth <= practice?.viewport,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => browser.once('exit', resolve)), wait(3000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
