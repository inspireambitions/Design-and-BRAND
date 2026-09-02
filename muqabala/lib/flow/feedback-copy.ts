/**
 * Feedback blocks are short by contract: two sentences at most. The model is
 * asked for that, and the screen enforces it so a long reply never turns a
 * three block card into an essay.
 */

/**
 * End of sentence marks in English and Arabic, with any closing quote or
 * bracket that follows, when followed by a space or the end of the text.
 */
const SENTENCE_END = /[.!?؟۔]+["'”’»)\]]*(?=\s|$)/g;

export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentences: string[] = [];
  let start = 0;
  for (const match of trimmed.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    const sentence = trimmed.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  }
  const tail = trimmed.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Keeps the first `max` sentences of a block and drops the rest. */
export function limitSentences(text: string, max = 2): string {
  if (max <= 0) return '';
  return splitSentences(text).slice(0, max).join(' ');
}

/**
 * Turns a list of feedback lines into one block of at most `max` sentences.
 * Lines without a closing mark count as one sentence each.
 */
export function limitBlock(items: readonly string[], max = 2): string {
  const joined = items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (/[.!?؟۔]$/.test(item) ? item : `${item}.`))
    .join(' ');
  return limitSentences(joined, max);
}
