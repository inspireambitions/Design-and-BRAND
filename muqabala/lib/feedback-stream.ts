import type { AnswerFeedback } from '@/lib/scoring';

/**
 * Fields the candidate can safely read before scoring has finished. Scores and
 * competency evidence are withheld until the whole response has passed the
 * integrity gate, so a partial view can never look like a verdict.
 */
export type PartialFeedback = {
  headline?: string;
  strengths?: string[];
  improvements?: string[];
  coachTip?: string;
};

export type FeedbackStreamError = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds: number;
};

/** One newline-delimited JSON event on the streamed feedback response. */
export type FeedbackStreamEvent =
  | { type: 'partial'; partial: PartialFeedback }
  | { type: 'final'; feedback: AnswerFeedback; locked?: boolean; saved?: boolean }
  | { type: 'error'; status: number; error: FeedbackStreamError };

export const FEEDBACK_STREAM_CONTENT_TYPE = 'application/x-ndjson';

/** Server side budget for a streamed score, including model thinking time. */
export const FEEDBACK_STREAM_TIMEOUT_MS = 12_000;

const STREAMED_KEYS = new Set(['headline', 'strengths', 'improvements', 'coach_tip']);

function skipWhitespace(text: string, index: number): number {
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

/** Returns the index after a complete JSON string, or -1 when it is still open. */
function scanString(text: string, index: number): number {
  if (text[index] !== '"') return -1;
  index += 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '"') return index + 1;
    index += 1;
  }
  return -1;
}

/** Returns the index after a complete JSON value, or -1 when it is still open. */
function scanValue(text: string, index: number): number {
  index = skipWhitespace(text, index);
  if (index >= text.length) return -1;
  const first = text[index];
  if (first === '"') return scanString(text, index);
  if (first === '{' || first === '[') {
    let depth = 0;
    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        const end = scanString(text, index);
        if (end < 0) return -1;
        index = end;
        continue;
      }
      if (character === '{' || character === '[') depth += 1;
      if (character === '}' || character === ']') {
        depth -= 1;
        if (depth === 0) return index + 1;
      }
      index += 1;
    }
    return -1;
  }
  // Numbers, booleans and null end at the next separator. A separator must
  // exist for the value to count as complete.
  let end = index;
  while (end < text.length && !/[,}\]\s]/.test(text[end])) end += 1;
  return end < text.length ? end : -1;
}

/**
 * Reads the top-level fields that have fully arrived in a JSON object that is
 * still being generated. Keys are matched at depth one only, so a word like
 * "strengths" inside a quoted sentence is never mistaken for a field.
 */
export function extractPartialFeedback(text: string): PartialFeedback {
  const partial: PartialFeedback = {};
  let index = skipWhitespace(text, 0);
  if (text[index] !== '{') return partial;
  index += 1;

  while (index < text.length) {
    index = skipWhitespace(text, index);
    if (text[index] === '}') break;
    if (text[index] === ',') {
      index += 1;
      continue;
    }
    const keyEnd = scanString(text, index);
    if (keyEnd < 0) break;
    let key: string;
    try {
      key = JSON.parse(text.slice(index, keyEnd)) as string;
    } catch {
      break;
    }
    index = skipWhitespace(text, keyEnd);
    if (text[index] !== ':') break;
    const valueStart = skipWhitespace(text, index + 1);
    const valueEnd = scanValue(text, valueStart);
    if (valueEnd < 0) break;
    if (STREAMED_KEYS.has(key)) {
      let value: unknown;
      try {
        value = JSON.parse(text.slice(valueStart, valueEnd));
      } catch {
        break;
      }
      if (key === 'headline' && typeof value === 'string') partial.headline = value;
      if (key === 'coach_tip' && typeof value === 'string') partial.coachTip = value;
      if ((key === 'strengths' || key === 'improvements') && Array.isArray(value)) {
        partial[key] = value.filter((item): item is string => typeof item === 'string');
      }
    }
    index = valueEnd;
  }
  return partial;
}

export function partialFeedbackChanged(previous: PartialFeedback, next: PartialFeedback): boolean {
  return (
    previous.headline !== next.headline
    || previous.coachTip !== next.coachTip
    || (previous.strengths?.length ?? -1) !== (next.strengths?.length ?? -1)
    || (previous.improvements?.length ?? -1) !== (next.improvements?.length ?? -1)
  );
}

export function encodeFeedbackStreamEvent(event: FeedbackStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Splits a chunked NDJSON body into events. The remainder is whatever trailing
 * text has not yet reached its newline, and must be fed back in with the next
 * chunk.
 */
export function decodeFeedbackStreamChunk(
  buffer: string,
): { events: FeedbackStreamEvent[]; remainder: string } {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';
  const events: FeedbackStreamEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as FeedbackStreamEvent;
      if (parsed && typeof parsed === 'object' && 'type' in parsed) events.push(parsed);
    } catch {
      // A malformed line is dropped rather than aborting the whole stream.
    }
  }
  return { events, remainder };
}
