import type { Lang } from './i18n';

/**
 * The shareable progress card: a portrait image a candidate can post or send.
 *
 * Privacy boundary, enforced by the input type: the card carries a role title,
 * a readiness number, a questions count and the site name. It has no field for
 * a name, a photo or an answer, so nothing a candidate said can ever be drawn.
 */

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

/** Brand jade, fixed rather than read from CSS so the card looks the same in dark mode. */
export const SHARE_CARD_JADE = '#0B7A6B';
const INK = '#16241F';
const INK_SOFT = '#536860';
const GROUND = '#F2F5F2';
const SURFACE = '#FFFFFF';
const TRACK = '#E8EDE9';
const GOLD = '#B9892E';

export type ShareCardLabels = {
  wordmark: string;
  readiness: string;
  /** May contain {practised} and {total}. */
  questions: string;
  site: string;
};

const DEFAULT_LABELS: Record<Lang, ShareCardLabels> = {
  en: {
    wordmark: 'Muqabala',
    readiness: 'Practice coverage',
    questions: 'Questions practised: {practised} of {total}',
    site: 'trymuqabala.com',
  },
  ar: {
    wordmark: 'مقابلة',
    readiness: 'تغطية التدريب',
    questions: 'الأسئلة التي تدرّبت عليها: {practised} من {total}',
    site: 'trymuqabala.com',
  },
};

export type ShareCardInput = {
  roleTitle: string;
  /** 0-100. */
  score: number;
  questionsPractised: number;
  questionsTotal: number;
  lang: Lang;
  /** Translated labels. Defaults to the built-in strings for the language. */
  labels?: ShareCardLabels;
  /**
   * Font family names already loaded in the page, typically read from the
   * next/font CSS variables. Falls back to the named families, then system fonts.
   */
  fonts?: { display?: string; arabic?: string };
};

/** The subset of CanvasRenderingContext2D the card needs, so tests can pass a stub. */
export type ShareCardContext = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
};

export type ShareCardCanvas = {
  width: number;
  height: number;
  getContext(contextId: '2d'): ShareCardContext | null;
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

function quote(family: string): string {
  const trimmed = family.trim();
  if (!trimmed) return '';
  // Already a comma list of quoted names (the shape next/font variables take).
  if (trimmed.includes(',') || /^["']/.test(trimmed)) return trimmed;
  return `"${trimmed}"`;
}

function fontStack(lang: Lang, fonts: ShareCardInput['fonts']): string {
  const custom = quote(lang === 'ar' ? fonts?.arabic ?? '' : fonts?.display ?? '');
  const named =
    lang === 'ar'
      ? '"IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif'
      : '"Bricolage Grotesque", "Public Sans", "Trebuchet MS", system-ui, sans-serif';
  return custom ? `${custom}, ${named}` : named;
}

/** The mark itself is Arabic script whatever the card language. */
function markFontStack(fonts: ShareCardInput['fonts']): string {
  return fontStack('ar', fonts);
}

function font(weight: number, size: number, stack: string): string {
  return `${weight} ${size}px ${stack}`;
}

function roundedRect(ctx: ShareCardContext, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Greedy word wrap to at most `maxLines`, with an ellipsis on the last line if needed. */
function wrap(ctx: ShareCardContext, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Draws the 1080 x 1350 card onto `canvas`. Pure apart from the canvas it is
 * given: no DOM, no fetches, no randomness. Arabic cards lay out right to left.
 */
export function renderShareCard(canvas: ShareCardCanvas, input: ShareCardInput): void {
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('share card: 2d canvas context unavailable');

  const W = SHARE_CARD_WIDTH;
  const H = SHARE_CARD_HEIGHT;
  const margin = 96;
  const rtl = input.lang === 'ar';
  const labels = input.labels ?? DEFAULT_LABELS[input.lang] ?? DEFAULT_LABELS.en;
  const text = fontStack(input.lang, input.fonts);
  const score = clampScore(input.score);
  const practised = Math.max(0, Math.floor(input.questionsPractised));
  const total = Math.max(practised, Math.floor(input.questionsTotal));
  const edgeX = rtl ? W - margin : margin;

  ctx.save();
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';

  // Ground and card surface.
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = SURFACE;
  roundedRect(ctx, 40, 40, W - 80, H - 80, 48);
  ctx.fill();

  // Mark: jade tile with the letter م, and a gold dot as in the app icon.
  const tile = 112;
  const tileX = rtl ? W - margin - tile : margin;
  const tileY = margin;
  ctx.fillStyle = SHARE_CARD_JADE;
  roundedRect(ctx, tileX, tileY, tile, tile, 30);
  ctx.fill();
  ctx.fillStyle = SURFACE;
  ctx.font = font(700, 74, markFontStack(input.fonts));
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText('م', tileX + tile / 2, tileY + tile * 0.72);
  ctx.beginPath();
  ctx.arc(tileX + tile - 22, tileY + 22, 9, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.direction = rtl ? 'rtl' : 'ltr';

  // Wordmark beside the mark.
  ctx.fillStyle = INK;
  ctx.font = font(800, 60, text);
  ctx.textAlign = rtl ? 'right' : 'left';
  const wordX = rtl ? tileX - 28 : tileX + tile + 28;
  ctx.fillText(labels.wordmark, wordX, tileY + tile * 0.66);

  // Eyebrow and role title.
  ctx.fillStyle = INK_SOFT;
  ctx.font = font(700, 30, text);
  ctx.fillText(rtl ? labels.readiness : labels.readiness.toUpperCase(), edgeX, 330);

  ctx.fillStyle = INK;
  ctx.font = font(800, 66, text);
  const titleLines = wrap(ctx, input.roleTitle, W - margin * 2, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, edgeX, 418 + index * 80));

  // Readiness ring.
  const cx = W / 2;
  const cy = 800;
  const radius = 232;
  const start = -Math.PI / 2;
  ctx.lineCap = 'round';
  ctx.lineWidth = 30;
  ctx.strokeStyle = TRACK;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  if (score > 0) {
    ctx.strokeStyle = SHARE_CARD_JADE;
    ctx.beginPath();
    const sweep = (Math.PI * 2 * score) / 100;
    // In Arabic the ring fills anticlockwise so it reads in the same direction as the text.
    ctx.arc(cx, cy, radius, start, rtl ? start - sweep : start + sweep, rtl);
    ctx.stroke();
  }

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.font = font(800, 220, text);
  ctx.fillText(String(score), cx, cy + 74);
  ctx.fillStyle = INK_SOFT;
  ctx.font = font(600, 40, text);
  ctx.fillText('/ 100', cx, cy + 140);
  ctx.direction = rtl ? 'rtl' : 'ltr';

  // Questions line.
  ctx.fillStyle = INK;
  ctx.font = font(600, 40, text);
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillText(fill(labels.questions, { practised, total }), edgeX, 1128);

  // Footer rule and site.
  ctx.fillStyle = TRACK;
  ctx.fillRect(margin, 1178, W - margin * 2, 3);
  ctx.fillStyle = SHARE_CARD_JADE;
  ctx.font = font(700, 38, text);
  ctx.direction = 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillText(labels.site, edgeX, 1246);

  ctx.restore();
}

/** Stable, role-scoped file name for the saved PNG. */
export function shareCardFileName(roleId: string): string {
  const safe = roleId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'role';
  return `muqabala-readiness-${safe}.png`;
}
