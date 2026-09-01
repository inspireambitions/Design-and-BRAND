import type { AnswerFeedback } from '../scoring';
import type { FeedbackStreamError, FeedbackStreamEvent, PartialFeedback } from '../feedback-stream';

// Kept type-only so this module stays a leaf that Node's test runner can load
// without a path alias. The value must match FEEDBACK_STREAM_CONTENT_TYPE in
// lib/feedback-stream.ts; the transport test asserts that.
const STREAM_CONTENT_TYPE = 'application/x-ndjson';

function encodeEvent(event: FeedbackStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** What a scoring run produced, before it is shaped as JSON or a stream event. */
export type ScoreOutcome = {
  status: number;
  body: Record<string, unknown>;
  headers?: HeadersInit;
};

export type PartialEmitter = (partial: PartialFeedback) => void;

export function jsonResponse(outcome: ScoreOutcome): Response {
  return Response.json(outcome.body, { status: outcome.status, headers: outcome.headers });
}

const GENERIC_FAILURE: FeedbackStreamError = {
  code: 'scoring_temporarily_unavailable',
  message: 'AI scoring is temporarily unavailable. No score was produced.',
  retryable: true,
  retryAfterSeconds: 20,
};

/**
 * Newline-delimited JSON. Readable blocks arrive as they are generated; the
 * final event carries exactly the body the JSON response would have carried.
 * The HTTP status is always 200 because the outcome is only known at the end,
 * so failures travel as an error event with the status they would have had.
 */
export function streamResponse(
  run: (emit: PartialEmitter) => Promise<ScoreOutcome>,
  baseHeaders: HeadersInit = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (event: FeedbackStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // The candidate has gone. Scoring still completes so the stored
          // answer is not left half finished.
          closed = true;
        }
      };
      try {
        const outcome = await run((partial) => write({ type: 'partial', partial }));
        if (outcome.status >= 400) {
          const raw = outcome.body.error;
          const error: FeedbackStreamError = raw && typeof raw === 'object'
            ? (raw as FeedbackStreamError)
            : { code: 'scoring_failed', message: String(raw ?? 'Scoring failed.'), retryable: false, retryAfterSeconds: 0 };
          write({ type: 'error', status: outcome.status, error });
        } else {
          write({
            type: 'final',
            feedback: outcome.body.feedback as AnswerFeedback,
            locked: outcome.body.locked as boolean | undefined,
            saved: outcome.body.saved as boolean | undefined,
          });
        }
      } catch {
        write({ type: 'error', status: 500, error: GENERIC_FAILURE });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a cancelled reader.
        }
      }
    },
  });
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', `${STREAM_CONTENT_TYPE}; charset=utf-8`);
  headers.set('Cache-Control', 'no-cache, no-store, no-transform');
  headers.set('X-Accel-Buffering', 'no');
  return new Response(stream, { status: 200, headers });
}
