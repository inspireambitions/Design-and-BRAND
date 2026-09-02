import { limitInterviewPack } from '@/lib/rate-limit';
import {
  MAX_INTERVIEW_PACK_BODY_BYTES,
  parseInterviewPackRequest,
} from '@/lib/landing/interview-pack';

export const runtime = 'nodejs';

function tooLarge(request: Request): boolean {
  const declared = Number(request.headers.get('content-length') ?? '0');
  return Number.isFinite(declared) && declared > MAX_INTERVIEW_PACK_BODY_BYTES;
}

/**
 * Accepts a candidate's request to receive their interview pack by email.
 *
 * TODO: delivery is wired by the practice plan pipeline (`/api/practice-plans`
 * in the open practice-plans PR). Until that lands, this route validates and
 * rate limits the request and stores nothing. The candidate's consent is kept
 * on their device under `muqabala.emailConsent.v1` for the pipeline to read.
 */
export async function POST(request: Request) {
  if (tooLarge(request)) {
    return Response.json(
      { error: { code: 'body_too_large', message: 'Request too large.' } },
      { status: 413 },
    );
  }

  const rateLimit = await limitInterviewPack(request);
  if (rateLimit.limited) {
    return Response.json(
      { error: { code: 'rate_limited', message: 'Too many requests. Please wait a few minutes.' } },
      { status: 429, headers: { 'Retry-After': String(Math.max(60, rateLimit.retryAfterSeconds)) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: { code: 'bad_request', message: 'Invalid request body.' } }, { status: 400 });
  }

  const parsed = parseInterviewPackRequest(raw);
  if (!parsed) {
    return Response.json(
      { error: { code: 'bad_request', message: 'Enter a valid email address.' } },
      { status: 400 },
    );
  }

  return Response.json({ accepted: true });
}
