import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3102';
const port = 9242;
const browserPath = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((candidate) => existsSync(candidate));
if (!browserPath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH and run again.');

const profile = await mkdtemp(join(tmpdir(), 'muqabala-recruiter-suite-'));
const outputDir = new URL('../docs/reviews/assets/recruiter-suite/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findPage() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = pages.find((item) => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await wait(125);
  }
  throw new Error('The browser page did not become ready.');
}

let socket;
let nextId = 0;
const pending = new Map();
const consoleErrors = [];
function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
  return result.result?.value;
}
async function navigate(path, { width = 1280, height = 900, mobile = false, reducedMotion = false } = {}) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }] });
  await command('Page.navigate', { url: `${baseUrl}${path}` });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(`({ state: document.readyState, content: document.body?.innerText.length || 0 })`);
    if (ready?.state === 'complete' && ready.content > 0) break;
    await wait(100);
  }
  await wait(500);
  await evaluate('scrollTo(0, 0)');
}
async function screenshot(name, full = false) {
  const params = { format: 'png', fromSurface: true, captureBeyondViewport: full };
  if (full) {
    const metrics = await command('Page.getLayoutMetrics');
    params.clip = { x: 0, y: 0, width: Math.ceil(metrics.cssContentSize.width), height: Math.ceil(metrics.cssContentSize.height), scale: 1 };
  }
  const shot = await command('Page.captureScreenshot', params);
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
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params?.exceptionDetails?.text || 'Uncaught browser exception');
    if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') consoleErrors.push(message.params.entry.text);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Log.enable');

  await navigate('/dev/recruiter-suite');
  const dashboard = await evaluate(`({
    title: document.title,
    attentionItems: [...document.querySelectorAll('#attention-state article')].filter(item => !item.closest('details:not([open])')).length,
    attentionTotal: document.querySelectorAll('#attention-state article').length,
    attentionLimit: [...document.querySelectorAll('#attention-state article')].filter(item => !item.closest('details:not([open])')).length <= 3,
    hasChatInput: Boolean(document.querySelector('#role-help input, #role-help textarea')),
    hasPrimaryRecruitmentActions: document.body.innerText.includes('Review submissions') && document.body.innerText.includes('Candidate reminders'),
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    overlay: Boolean(document.querySelector('[data-nextjs-dialog], #webpack-dev-server-client-overlay')),
  })`);
  const attentionExpanded = await evaluate(`(() => {
    const summary = [...document.querySelectorAll('#attention-state summary')].find(item => item.textContent.includes('View all attention items'));
    summary?.click();
    return {
      control: Boolean(summary),
      visible: [...document.querySelectorAll('#attention-state article')].filter(item => !item.closest('details:not([open])')).length,
      omittedReachable: document.body.innerText.includes('Restaurant Manager invitation closes soon'),
    };
  })()`);
  await screenshot('dashboard-desktop.png');
  const recruiterHandoff = await evaluate(`(() => {
    const root = document.querySelector('#candidate-questions');
    root.querySelector('details summary')?.click();
    const buttons = [...root.querySelectorAll('button')].map(item => item.textContent.trim());
    const publicDisclosure = [...root.querySelectorAll('details')].find(item => item.querySelector('summary')?.textContent.includes('Prepare public role information'));
    publicDisclosure?.querySelector('summary')?.click();
    return {
      replyAndResolveSeparate: buttons.includes('Save reply') && buttons.includes('Mark resolved'),
      explicitPublication: Boolean(publicDisclosure) && publicDisclosure.querySelectorAll('input, textarea').length === 2,
      noCandidateContactPreloaded: [...publicDisclosure?.querySelectorAll('input, textarea') || []].every(item => item.value === ''),
      candidateSourcesVisible: Boolean(root.querySelector('#candidate-role-fact-salary'))
        && Boolean(root.querySelector('#candidate-role-fact-accommodation'))
        && Boolean(root.querySelector('#candidate-role-fact-interview'))
        && Boolean(root.querySelector('#candidate-role-faq-0')),
    };
  })()`);

  const roleActions = await evaluate(`(() => {
    const clickText = (text) => [...document.querySelectorAll('button')].find(button => button.textContent.includes(text))?.click();
    clickText('Preview reminder');
    clickText('Ask about this role');
    clickText('Edit closing date');
    return true;
  })()`);
  await wait(250);
  const deadlineEditor = await evaluate(`({
    input: Boolean(document.querySelector('#role-help input[type=datetime-local]')),
    timezone: document.querySelector('#role-help')?.innerText.includes('Asia/Dubai'),
    save: [...document.querySelectorAll('#role-help button')].some(button => button.textContent.includes('Save closing date')),
  })`);
  await evaluate(`[...document.querySelectorAll('#role-help button')].find(button => button.textContent.trim() === 'Cancel')?.click()`);
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.includes('Which submissions still need review?'))?.click()`);
  await wait(100);
  const reminder = await evaluate(`({
    preview: document.body.innerText.includes('Review recipients and the exact message'),
    selected: document.querySelectorAll('#role-help input[type=checkbox]:checked').length,
    excluded: document.querySelector('#role-help details')?.textContent.includes('Submission completed.') && document.querySelector('#role-help details')?.textContent.includes('Already reminded within 24 hours.'),
    automationHonest: document.body.innerText.includes('Automated email is not configured'),
    roleHelpAnswer: document.body.innerText.includes('2 submissions still need human review.'),
  })`);
  await evaluate(`document.querySelector('#role-help')?.scrollIntoView({ block: 'start' })`);
  await wait(100);
  await screenshot('reminder-and-role-help-desktop.png');

  const panelOpened = await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes('Review fictional candidate')); button?.scrollIntoView({ block: 'center' }); button?.click(); return Boolean(button); })()`);
  await wait(350);
  const panel = await evaluate(`({
    dialog: Boolean(document.querySelector('[role=dialog]')),
    summaryPoints: document.querySelectorAll('[role=dialog] a[href^="#candidate-answer-"]').length,
    answers: document.querySelectorAll('[role=dialog] details[id^="candidate-answer-"]').length,
    candidateClaims: [...document.querySelectorAll('[role=dialog] p')].some(item => item.textContent.includes('The candidate described')),
    evidenceDisclaimer: document.body.innerText.includes('AI') || document.body.innerText.includes('generated'),
  })`);
  await screenshot('candidate-review-desktop.png');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await wait(200);
  const focusRestored = await evaluate(`document.activeElement?.textContent?.includes('Review fictional candidate') === true`);

  const wizardRole = await evaluate(`(() => {
    const root = document.querySelector('#creation-wizard');
    root?.scrollIntoView({ block: 'start' });
    const set = (labelText, value) => {
      const label = [...root.querySelectorAll('label')].find(item => item.querySelector('span')?.textContent?.trim() === labelText);
      const input = label?.querySelector('input, textarea');
      if (!input) return false;
      const descriptor = Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
      descriptor.set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    };
    set('Company name', 'Harbour Hotel');
    set('Job title', 'Front Office Supervisor');
    set('Role location', 'Dubai Marina');
    [...root.querySelectorAll('button')].find(item => item.textContent.trim() === 'Continue')?.click();
    return true;
  })()`);
  await wait(700);
  await evaluate(`(() => {
    const root = document.querySelector('#creation-wizard');
    const label = [...root.querySelectorAll('label')].find(item => item.textContent.includes('English only'));
    label?.querySelector('input[type=radio]')?.click();
  })()`);
  await wait(100);
  const englishOnlyEditor = await evaluate(`({
    selected: [...document.querySelectorAll('#creation-wizard label')].find(item => item.textContent.includes('English only'))?.querySelector('input[type=radio]')?.checked === true,
    englishQuestions: document.querySelectorAll('#creation-wizard ol li textarea[dir=ltr]').length,
    arabicQuestions: document.querySelectorAll('#creation-wizard ol li textarea[dir=rtl]').length,
  })`);
  await evaluate(`(() => {
    const root = document.querySelector('#creation-wizard');
    const label = [...root.querySelectorAll('label')].find(item => item.textContent.includes('English and Arabic'));
    label?.querySelector('input[type=radio]')?.click();
  })()`);
  await wait(100);
  await evaluate(`(() => {
    const input = document.querySelector('#creation-wizard textarea[dir=ltr]');
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Tell us about a guest complaint you resolved and what changed.');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const questionEditor = await evaluate(`({
    step: document.querySelector('#creation-wizard [aria-current=step]')?.textContent,
    questions: document.querySelectorAll('#creation-wizard ol li textarea[dir=ltr]').length,
    bilingual: document.querySelectorAll('#creation-wizard textarea[dir=rtl]').length >= 3,
    fallbackVisible: document.body.innerText.includes('reviewed templates'),
  })`);
  await evaluate(`(() => { const root = document.querySelector('#creation-wizard'); [...root.querySelectorAll('button')].filter(item => item.textContent.trim() === 'Continue').at(-1)?.click(); })()`);
  await wait(250);
  const wizardPreview = await evaluate(`({
    exactRole: document.querySelector('#creation-wizard #role-facts')?.innerText.includes('Front Office Supervisor'),
    exactLocation: document.querySelector('#creation-wizard #role-facts')?.innerText.includes('Dubai Marina'),
    previewQuestions: document.querySelectorAll('#creation-wizard #role-facts ol li').length,
    previewCustomQuestion: document.querySelector('#creation-wizard #role-facts')?.innerText.includes('guest complaint you resolved'),
    confirmLabel: [...document.querySelectorAll('#creation-wizard button')].some(item => item.textContent.includes('Publish this role and create its invitation')),
  })`);
  await evaluate(`(() => { const element = document.querySelector('#creation-wizard #role-facts'); if (element) scrollTo(0, element.getBoundingClientRect().top + scrollY - 20); })()`);
  await wait(300);
  await screenshot('role-creation-preview-desktop.png');
  await evaluate(`(() => { const root = document.querySelector('#creation-wizard'); [...root.querySelectorAll('button')].find(item => item.textContent.trim() === 'Back')?.click(); })()`);
  await wait(150);
  const draftRetained = await evaluate(`document.querySelector('#creation-wizard textarea[dir=ltr]')?.value.includes('guest complaint you resolved') === true`);
  await evaluate(`(() => { const root = document.querySelector('#creation-wizard'); [...root.querySelectorAll('button')].find(item => item.textContent.trim() === 'Continue')?.click(); })()`);
  await wait(150);
  await evaluate(`(() => { const root = document.querySelector('#creation-wizard'); [...root.querySelectorAll('button')].find(item => item.textContent.includes('Publish this role and create its invitation'))?.click(); })()`);
  await wait(150);
  const publishFailure = await evaluate(`({
    preserved: document.querySelector('#creation-wizard #role-facts')?.innerText.includes('guest complaint you resolved'),
    error: document.querySelector('#creation-wizard [role=alert]')?.textContent,
    stillPreview: document.querySelector('#creation-wizard [aria-current=step]')?.textContent.includes('Preview'),
  })`);

  await evaluate(`localStorage.setItem('muqabala.lang.v1', 'ar')`);
  await navigate('/dev/recruiter-suite', { width: 390, height: 844, mobile: true, reducedMotion: true });
  await evaluate(`(() => {
    const clickText = (text) => [...document.querySelectorAll('button')].find(button => button.textContent.includes(text))?.click();
    clickText('معاينة التذكير');
    document.querySelector('#candidate-questions details > summary')?.click();
  })()`);
  await wait(300);
  const mobileArabic = await evaluate(`({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    bodyDir: document.body.dir,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    arabicReminder: document.body.innerText.includes('راجع المستلمين'),
    arabicCandidateQuestions: document.body.innerText.includes('أسئلة عن هذه الوظيفة'),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    reminderAnimation: getComputedStyle(document.querySelector('#role-help section') || document.body).animationName,
    overlay: Boolean(document.querySelector('[data-nextjs-dialog], #webpack-dev-server-client-overlay')),
  })`);
  await screenshot('mobile-arabic-reduced-motion.png');

  await evaluate(`localStorage.setItem('muqabala.lang.v1', 'en')`);
  await navigate('/dev/recruiter-suite?state=error', { width: 900, height: 700 });
  const errorState = await evaluate(`({
    alert: document.querySelector('#attention-state [role=alert]')?.textContent,
    hasRetry: [...document.querySelectorAll('#attention-state button')].some(item => item.textContent.includes('Retry')),
    inventedZero: document.querySelector('#attention-state [role=alert]')?.textContent.includes('0 items') || false,
  })`);
  await evaluate(`document.querySelector('#attention-state')?.scrollIntoView({ block: 'start' })`);
  await wait(100);
  await screenshot('attention-error-state.png');

  await navigate('/dev/recruiter-suite?state=empty', { width: 900, height: 700 });
  const emptyState = await evaluate(`({
    attentionSection: Boolean(document.querySelector('#attention-state section[aria-labelledby="attention-heading"]')),
    explicitAssertion: document.body.innerText.includes('an empty attention briefing renders no invented zero-state card'),
  })`);

  const result = {
    baseUrl,
    dashboard,
    attentionExpanded,
    recruiterHandoff,
    roleActions,
    deadlineEditor,
    reminder,
    panelOpened,
    panel,
    focusRestored,
    wizardRole,
    englishOnlyEditor,
    questionEditor,
    wizardPreview,
    draftRetained,
    publishFailure,
    mobileArabic,
    errorState,
    emptyState,
    consoleErrors,
  };
  result.passed = dashboard.attentionItems === 3 && dashboard.attentionTotal === 4 && dashboard.attentionLimit
    && attentionExpanded.control && attentionExpanded.visible === 4 && attentionExpanded.omittedReachable && !dashboard.hasChatInput
    && dashboard.hasPrimaryRecruitmentActions && dashboard.scrollWidth <= dashboard.viewport && !dashboard.overlay
    && recruiterHandoff.replyAndResolveSeparate && recruiterHandoff.explicitPublication && recruiterHandoff.noCandidateContactPreloaded && recruiterHandoff.candidateSourcesVisible
    && roleActions && deadlineEditor.input && deadlineEditor.timezone && deadlineEditor.save
    && reminder.preview && reminder.selected === 2 && reminder.excluded && reminder.automationHonest && reminder.roleHelpAnswer
    && panelOpened && panel.dialog && panel.summaryPoints === 2 && panel.answers === 2 && panel.candidateClaims && focusRestored
    && englishOnlyEditor.selected && englishOnlyEditor.englishQuestions === 3 && englishOnlyEditor.arabicQuestions === 0
    && questionEditor.questions === 3 && questionEditor.bilingual && wizardPreview.exactRole && wizardPreview.exactLocation
    && wizardPreview.previewQuestions === 3 && wizardPreview.previewCustomQuestion && wizardPreview.confirmLabel
    && draftRetained && publishFailure.preserved && Boolean(publishFailure.error) && publishFailure.stillPreview
    && mobileArabic.lang === 'ar' && mobileArabic.dir === 'rtl' && mobileArabic.bodyDir === 'rtl'
    && mobileArabic.scrollWidth <= mobileArabic.width && mobileArabic.arabicReminder && mobileArabic.arabicCandidateQuestions
    && mobileArabic.reducedMotion && mobileArabic.reminderAnimation === 'none' && !mobileArabic.overlay
    && Boolean(errorState.alert) && errorState.hasRetry && !errorState.inventedZero
    && !emptyState.attentionSection && emptyState.explicitAssertion && consoleErrors.length === 0;
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => browser.once('exit', resolve)), wait(3000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
