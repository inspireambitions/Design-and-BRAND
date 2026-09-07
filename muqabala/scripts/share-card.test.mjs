import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderShareCard,
  shareCardFileName,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_JADE,
  SHARE_CARD_WIDTH,
} from '../lib/share-card.ts';

/** Records every drawing call so tests can inspect exactly what reached the canvas. */
function stubCanvas() {
  const calls = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    measureText(text) {
      return { width: text.length * 34 };
    },
  };
  for (const name of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'fill', 'stroke', 'fillRect', 'fillText']) {
    ctx[name] = (...args) => {
      calls.push({ name, args, font: ctx.font, fillStyle: ctx.fillStyle, direction: ctx.direction, textAlign: ctx.textAlign });
    };
  }
  const canvas = { width: 0, height: 0, getContext: (kind) => (kind === '2d' ? ctx : null) };
  return { canvas, ctx, calls, texts: () => calls.filter((c) => c.name === 'fillText') };
}

const input = {
  roleTitle: 'Front office agent',
  score: 63,
  questionsPractised: 5,
  questionsTotal: 8,
  lang: 'en',
};

test('draws at exactly 1080 by 1350', () => {
  const { canvas } = stubCanvas();
  canvas.width = 300;
  canvas.height = 150;
  renderShareCard(canvas, input);
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1350);
  assert.equal(SHARE_CARD_WIDTH, 1080);
  assert.equal(SHARE_CARD_HEIGHT, 1350);
});

test('shows the mark, wordmark, role, score, questions line and site', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, input);
  const drawn = texts().map((c) => c.args[0]);
  assert.ok(drawn.includes('م'));
  assert.ok(drawn.includes('Muqabala'));
  assert.ok(drawn.includes('Front office agent'));
  assert.ok(drawn.includes('63'));
  assert.ok(drawn.includes('Questions practised: 5 of 8'));
  assert.ok(drawn.includes('trymuqabala.com'));
});

test('the mark is drawn in brand jade', () => {
  const { canvas, calls } = stubCanvas();
  renderShareCard(canvas, input);
  assert.equal(SHARE_CARD_JADE, '#0B7A6B');
  const markIndex = calls.findIndex((c) => c.name === 'fillText' && c.args[0] === 'م');
  assert.ok(markIndex > 0);
  // The tile fill immediately before the letter is jade.
  const tileFill = calls.slice(0, markIndex).reverse().find((c) => c.name === 'fill');
  assert.equal(tileFill.fillStyle, '#0B7A6B');
});

test('never draws anything that is not a role title, a number, a label or the site', () => {
  const { canvas, texts } = stubCanvas();
  const leaky = {
    ...input,
    // Fields the type forbids, smuggled in at runtime. None may reach the canvas.
    name: 'Fatima Al Sayed',
    candidateName: 'Fatima',
    transcript: 'Last year at the hotel a guest lost his passport and I called the embassy.',
    answers: [{ transcript: 'I apologised and offered a free upgrade.' }],
    photo: 'data:image/png;base64,AAAA',
  };
  renderShareCard(canvas, leaky);
  const drawn = texts().map((c) => c.args[0]).join('\n');
  for (const secret of ['Fatima', 'passport', 'embassy', 'apologised', 'upgrade', 'data:image']) {
    assert.ok(!drawn.includes(secret), `card leaked "${secret}"`);
  }
  const allowed = new Set(['م', 'Muqabala', 'PRACTICE COVERAGE', 'Front office agent', '63', '/ 100', 'Questions practised: 5 of 8', 'trymuqabala.com']);
  for (const text of texts().map((c) => c.args[0])) assert.ok(allowed.has(text), `unexpected text "${text}"`);
});

test('Arabic cards are laid out right to left with the Arabic font family first', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, {
    ...input,
    lang: 'ar',
    roleTitle: 'موظف استقبال',
    fonts: { arabic: '__IBM_Plex_Sans_Arabic_abc123' },
  });
  const title = texts().find((c) => c.args[0] === 'موظف استقبال');
  assert.ok(title, 'role title drawn');
  assert.equal(title.direction, 'rtl');
  assert.equal(title.textAlign, 'right');
  assert.equal(title.args[1], 1080 - 96);
  assert.match(title.font, /^800 66px "__IBM_Plex_Sans_Arabic_abc123", "IBM Plex Sans Arabic"/);
  const drawn = texts().map((c) => c.args[0]);
  assert.ok(drawn.includes('مقابلة'));
  assert.ok(drawn.includes('الأسئلة التي تدرّبت عليها: 5 من 8'));
  assert.ok(drawn.includes('trymuqabala.com'));
});

test('falls back to the named Arabic family and system fonts when nothing is loaded', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, { ...input, lang: 'ar', roleTitle: 'ممرض' });
  const title = texts().find((c) => c.args[0] === 'ممرض');
  assert.match(title.font, /^800 66px "IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif$/);
});

test('English cards use the display family when the page has it loaded', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, { ...input, fonts: { display: "'__Bricolage_Grotesque_1a2b3c', '__Bricolage_Grotesque_Fallback_1a2b3c'" } });
  const title = texts().find((c) => c.args[0] === 'Front office agent');
  assert.equal(title.direction, 'ltr');
  assert.equal(title.textAlign, 'left');
  assert.equal(title.args[1], 96);
  assert.match(title.font, /^800 66px '__Bricolage_Grotesque_1a2b3c', '__Bricolage_Grotesque_Fallback_1a2b3c', "Bricolage Grotesque"/);
});

test('translated labels override the defaults', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, {
    ...input,
    labels: { wordmark: 'Muqabala', readiness: 'Ready?', questions: '{practised}/{total} done', site: 'trymuqabala.com' },
  });
  const drawn = texts().map((c) => c.args[0]);
  assert.ok(drawn.includes('READY?'));
  assert.ok(drawn.includes('5/8 done'));
});

test('score is clamped and rounded, and questions never exceed the total', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, { ...input, score: 137.6, questionsPractised: 9, questionsTotal: 8 });
  const drawn = texts().map((c) => c.args[0]);
  assert.ok(drawn.includes('100'));
  assert.ok(drawn.includes('Questions practised: 9 of 9'));

  const zero = stubCanvas();
  renderShareCard(zero.canvas, { ...input, score: -4 });
  assert.ok(zero.texts().map((c) => c.args[0]).includes('0'));
});

test('long role titles wrap to at most two lines', () => {
  const { canvas, texts } = stubCanvas();
  renderShareCard(canvas, {
    ...input,
    roleTitle: 'Senior guest relations and front office night operations supervisor for a five star resort',
  });
  const numbers = new Set(['63', '/ 100']);
  const lines = texts().filter((c) => c.font.startsWith('800 66px') && !numbers.has(c.args[0]));
  assert.equal(lines.length, 2);
  assert.ok(lines[1].args[0].endsWith('…'));
});

test('throws rather than silently drawing nothing when the context is unavailable', () => {
  assert.throws(() => renderShareCard({ width: 0, height: 0, getContext: () => null }, input), /2d canvas context/);
});

test('file name is role scoped and safe', () => {
  assert.equal(shareCardFileName('front-office-agent'), 'muqabala-readiness-front-office-agent.png');
  assert.equal(shareCardFileName('Custom Role!'), 'muqabala-readiness-custom-role.png');
  assert.equal(shareCardFileName('///'), 'muqabala-readiness-role.png');
});
