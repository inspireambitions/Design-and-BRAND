import type { JDQualityResult, PrecheckResult } from './types.ts';

const INJECTION_PATTERNS: Array<{ label: string; pattern: RegExp; replacement?: string }> = [
  { label: 'ignore_previous', pattern: /\bignore\s+(?:all\s+)?previous(?:\s+instructions?)?\b/gi },
  { label: 'system_prompt', pattern: /\bsystem\s+prompt\b/gi },
  { label: 'you_are_now', pattern: /\byou\s+are\s+now\b/gi },
  { label: 'rate_this', pattern: /\brate\s+this\b/gi },
  { label: 'score_this', pattern: /\bscore\s+this\b/gi },
  { label: 'deep_markdown_heading', pattern: /^#{4,}\s*/gm },
  { label: 'zero_width', pattern: /[\u200B-\u200D\u2060\uFEFF]/g, replacement: '' },
  { label: 'url', pattern: /\b(?:https?:\/\/|www\.)\S+/gi },
];

const BOILERPLATE = [
  /\bteam player\b/i,
  /\bfast[- ]paced\b/i,
  /\bpassionate\b/i,
  /\bdynamic\b/i,
];

const VERB_STARTS = new Set([
  'achieve', 'analyse', 'analyze', 'assist', 'build', 'collaborate', 'coordinate',
  'create', 'deliver', 'design', 'develop', 'drive', 'ensure', 'handle', 'implement',
  'improve', 'lead', 'maintain', 'manage', 'monitor', 'operate', 'organise', 'organize',
  'own', 'perform', 'prepare', 'provide', 'resolve', 'review', 'sell', 'serve', 'support',
  'track', 'train', 'troubleshoot', 'work',
]);

function words(value: string): string[] {
  return value.trim().match(/[\p{L}\p{N}'’-]+/gu) ?? [];
}

export function stripInjection(value: string): { cleaned: string; hits: string[] } {
  let cleaned = value.normalize('NFKC');
  const hits: string[] = [];
  for (const rule of INJECTION_PATTERNS) {
    if (rule.pattern.test(cleaned)) {
      hits.push(rule.label);
      rule.pattern.lastIndex = 0;
      cleaned = cleaned.replace(rule.pattern, rule.replacement ?? '[removed]');
    }
    rule.pattern.lastIndex = 0;
  }
  return { cleaned: cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), hits };
}

function isProbablyEnglish(value: string): boolean {
  const letters = value.match(/\p{L}/gu) ?? [];
  if (letters.length < 20) return false;
  const latin = value.match(/[A-Za-z\u00C0-\u024F]/g) ?? [];
  return latin.length / letters.length >= 0.85;
}

function contentLines(value: string): string[] {
  const explicit = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (explicit.length >= 3) return explicit;
  return value.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
}

function responsibilityCount(lines: string[]): number {
  return lines.filter((line) => {
    const first = line.replace(/^[•*\-–—\d.)\s]+/, '').match(/^[A-Za-z]+/)?.[0]?.toLowerCase();
    return Boolean(first && VERB_STARTS.has(first));
  }).length;
}

function detectTitles(lines: string[]): string[] {
  const titles = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^(?:job\s+title|position|role)\s*:\s*(.{2,100})$/i);
    if (!match) continue;
    for (const title of match[1].split(/\s*(?:\/|\||\band\b)\s*/i)) {
      const clean = title.trim();
      if (clean) titles.add(clean);
    }
  }
  return [...titles];
}

function truncateJD(value: string): string {
  const lines = value.split(/\r?\n/);
  const sections: string[] = [];
  let keep = false;
  for (const line of lines) {
    if (/^\s*(?:responsibilities|duties|what you(?:'|’)ll do|requirements|qualifications|what we(?:'|’)re looking for)\s*:?[\s]*$/i.test(line)) {
      keep = true;
      sections.push(line);
      continue;
    }
    if (keep && /^\s*[A-Z][A-Za-z &/-]{2,40}:?\s*$/.test(line) && !/responsibil|dut|require|qualif/i.test(line)) {
      keep = false;
    }
    if (keep) sections.push(line);
  }
  const selected = sections.join('\n').trim() || value;
  return words(selected).slice(0, 1500).join(' ');
}

export function assessJobDescription(raw: string): JDQualityResult {
  const stripped = stripInjection(raw);
  const initialWords = words(stripped.cleaned);
  const truncated = initialWords.length > 1500;
  const cleaned = truncated ? truncateJD(stripped.cleaned) : stripped.cleaned;
  const wordCount = words(cleaned).length;
  const lines = contentLines(cleaned);
  const responsibilities = responsibilityCount(lines);
  const boilerplateLines = lines.filter((line) => BOILERPLATE.some((pattern) => pattern.test(line))).length;
  const boilerplateRatio = lines.length ? boilerplateLines / lines.length : 0;
  const detectedTitles = detectTitles(lines);
  let score = 100;
  let reason: string | null = null;

  if (wordCount < 80) {
    score = 0;
    reason = 'The job description has fewer than 80 words.';
  } else if (!isProbablyEnglish(cleaned)) {
    score = 0;
    reason = 'Only English job descriptions are supported in this MVP.';
  } else {
    if (responsibilities < 3) score -= 30;
    if (boilerplateRatio > 0.4) score -= 30;
    if (detectedTitles.length > 1) {
      score = Math.min(score, 39);
      reason = 'More than one job title was detected.';
    }
  }

  const bounded = Math.max(0, Math.min(100, score));
  return {
    outcome: bounded >= 60 ? 'PASS' : bounded >= 40 ? 'WEAK' : 'FAIL',
    score: bounded,
    cleaned_text: cleaned,
    word_count: wordCount,
    responsibility_lines: responsibilities,
    boilerplate_ratio: Number(boilerplateRatio.toFixed(3)),
    detected_titles: detectedTitles,
    stripped_patterns: stripped.hits,
    truncated,
    reason,
  };
}

const NO_EXAMPLE = /\b(?:i don['’]?t know|no example|never happened to me)\b/i;
const REPHRASE = /^(?:(?:please|could you)\s+)?(?:repeat|rephrase)(?:\s+(?:that|the question|it))?[?.!]*$|^what do you mean[?.!]*$/i;
const SKIP = /^(?:please\s+)?(?:skip|next question)[?.!]*$/i;

export function precheckAnswer(raw: string): PrecheckResult {
  const stripped = stripInjection(raw);
  const answerWords = words(stripped.cleaned);
  const truncated = answerWords.length > 600;
  const cleanedAnswer = truncated
    ? `${answerWords.slice(0, 600).join(' ')} [Answer truncated after 600 words.]`
    : stripped.cleaned;
  const kind = NO_EXAMPLE.test(cleanedAnswer)
    ? 'NO_EXAMPLE'
    : REPHRASE.test(cleanedAnswer)
      ? 'REPHRASE_REQUEST'
      : SKIP.test(cleanedAnswer)
        ? 'SKIP_REQUEST'
        : 'NONE';
  return {
    kind,
    cleaned_answer: cleanedAnswer,
    short_answer: answerWords.length < 15,
    truncated,
    stripped_patterns: stripped.hits,
  };
}

export const boilerplateCompetencyNames = new Set([
  'passionate', 'dynamic', 'team player', 'fast-paced', 'enthusiastic', 'motivated', 'driven', 'proactive',
]);
