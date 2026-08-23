import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildFeedbackEmail } from '@/lib/feedback-email';
import { limitFeedback } from '@/lib/feedback-rate-limit';
import { RatingFeedbackSchema } from '@/lib/rating-feedback';
import { feedbackShareUrls } from '@/lib/feedback-share';
import { getRole } from '@/lib/roles';

export const runtime = 'nodejs';
export const maxDuration = 10;

const MAX_BODY_BYTES = 2_000;
const FEEDBACK_TO = 'hello@trymuqabala.com';
const FEEDBACK_FROM = 'Muqabala feedback <ratings@auth.trymuqabala.com>';

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Feedback is too large.' }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Feedback is too large.' }, { status: 413 });
  }

  let parsed: ReturnType<typeof RatingFeedbackSchema.safeParse>;
  try {
    parsed = RatingFeedbackSchema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Invalid feedback.' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid feedback.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_FEEDBACK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Feedback email is not configured.' }, { status: 503 });
  }

  const rate = await limitFeedback(request, parsed.data.attemptId);
  if (!rate.configured) {
    return NextResponse.json({ error: 'Feedback email is not available.' }, { status: 503 });
  }
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many feedback requests.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  const role = getRole(parsed.data.roleId);
  const roleLabel = parsed.data.roleId === 'custom' ? 'Custom job advert' : role?.title || parsed.data.roleId;
  const sentAt = new Date().toISOString();
  const idempotencyHash = createHash('sha256')
    .update(
      `${parsed.data.attemptId}:${parsed.data.stars}:${parsed.data.confidence}:${parsed.data.publicConsent}:${parsed.data.suggestion ?? ''}`,
    )
    .digest('hex')
    .slice(0, 32);
  let shareUrls: { square: string; wide: string } | undefined;
  if (parsed.data.publicConsent) {
    try {
      shareUrls = feedbackShareUrls(new URL(request.url).origin, {
        v: 1,
        stars: parsed.data.stars,
        confidence: parsed.data.confidence,
        questions: parsed.data.questionsAnswered,
        role: roleLabel,
        score: parsed.data.overallScore,
      });
    } catch {
      // The rating email still arrives if share-card signing is unavailable.
    }
  }
  const email = buildFeedbackEmail({ rating: parsed.data, roleLabel, receivedAt: sentAt, shareUrls });

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `rating_${idempotencyHash}`,
      },
      body: JSON.stringify({
        from: FEEDBACK_FROM,
        to: [FEEDBACK_TO],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(7_000),
    });
  } catch {
    return NextResponse.json({ error: 'Feedback email could not be sent.' }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: 'Feedback email could not be sent.' }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
