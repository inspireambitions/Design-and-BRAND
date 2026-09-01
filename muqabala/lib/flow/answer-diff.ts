/**
 * Word level difference between a first and a second answer to the same
 * question. Used to highlight what the candidate added, so it only ever looks
 * at the words of the answers themselves.
 */
export type DiffSegment = {
  text: string;
  /** True when this run of words appears in the new answer but not the first. */
  added: boolean;
};

type Token = { text: string; key: string | null };

const PUNCTUATION = /[\p{P}\p{S}]+/gu;

function normalise(word: string): string {
  return word
    .normalize('NFKC')
    .toLocaleLowerCase()
    // Arabic diacritics and tatweel change nothing about the word chosen.
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(PUNCTUATION, '');
}

type SegmenterLike = {
  segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
};

function wordSegmenter(locale: string): SegmenterLike | null {
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locale: string, options: { granularity: 'word' }) => SegmenterLike;
  }).Segmenter;
  if (!Segmenter) return null;
  try {
    return new Segmenter(locale, { granularity: 'word' });
  } catch {
    return null;
  }
}

/**
 * Splits text into tokens that keep every character, so the highlighted answer
 * reads back exactly as written. Word tokens carry a comparison key; spaces and
 * punctuation carry none and are never highlighted on their own.
 */
export function tokenise(text: string, locale = 'en'): Token[] {
  const segmenter = wordSegmenter(locale);
  if (segmenter) {
    const tokens: Token[] = [];
    for (const part of segmenter.segment(text)) {
      const key = part.isWordLike ? normalise(part.segment) : '';
      tokens.push({ text: part.segment, key: key || null });
    }
    return tokens;
  }
  const tokens: Token[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    const key = /\s/.test(part) ? '' : normalise(part);
    tokens.push({ text: part, key: key || null });
  }
  return tokens;
}

/**
 * Marks the words of `next` that do not appear anywhere in `first`. Runs of
 * added words, and the spaces between them, are merged into one segment so a
 * whole new phrase gets one highlight.
 */
export function diffAddedWords(first: string, next: string, locale = 'en'): DiffSegment[] {
  const known = new Set(
    tokenise(first, locale)
      .map((token) => token.key)
      .filter((key): key is string => Boolean(key)),
  );
  const tokens = tokenise(next, locale);
  const segments: DiffSegment[] = [];
  const push = (text: string, added: boolean) => {
    const last = segments[segments.length - 1];
    if (last && last.added === added) last.text += text;
    else segments.push({ text, added });
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.key) {
      push(token.text, !known.has(token.key));
      continue;
    }
    // Whitespace between two added words belongs to the highlighted phrase.
    const previous = segments[segments.length - 1];
    const following = tokens.slice(index + 1).find((item) => item.key);
    const bridges = Boolean(previous?.added)
      && /^\s+$/.test(token.text)
      && Boolean(following && !known.has(following.key as string));
    push(token.text, bridges);
  }
  return segments;
}

/** True when at least one word was added. */
export function hasAddedWords(segments: readonly DiffSegment[]): boolean {
  return segments.some((segment) => segment.added && /\S/.test(segment.text));
}
