import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const ShareCardPayloadSchema = z
  .object({
    v: z.literal(1),
    stars: z.number().int().min(1).max(5),
    confidence: z.enum(['more', 'same', 'less']),
    questions: z.number().int().min(1).max(12),
    role: z.string().min(1).max(100),
    score: z.number().int().min(0).max(100).nullable(),
  })
  .strict();

export type ShareCardPayload = z.infer<typeof ShareCardPayloadSchema>;

function shareSecret(): string {
  const secret = process.env.FEEDBACK_SHARE_SECRET
    || process.env.REPORT_CLAIM_SECRET
    || process.env.INTERVIEW_SECRET;
  if (!secret || secret.length < 32) throw new Error('Feedback share signing is not configured');
  return secret;
}

function signature(data: string): string {
  return createHmac('sha256', shareSecret())
    .update(`muqabala-rating-share-v1:${data}`, 'utf8')
    .digest('base64url');
}

export function createFeedbackShareToken(payload: ShareCardPayload) {
  const parsed = ShareCardPayloadSchema.parse(payload);
  const data = Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64url');
  return { data, signature: signature(data) };
}

export function verifyFeedbackShareToken(data: string, suppliedSignature: string): ShareCardPayload | null {
  if (!/^[A-Za-z0-9_-]{10,800}$/.test(data) || !/^[A-Za-z0-9_-]{20,100}$/.test(suppliedSignature)) {
    return null;
  }
  const expected = Buffer.from(signature(data), 'utf8');
  const supplied = Buffer.from(suppliedSignature, 'utf8');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const raw = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return ShareCardPayloadSchema.parse(raw);
  } catch {
    return null;
  }
}

export function feedbackShareUrls(origin: string, payload: ShareCardPayload) {
  const token = createFeedbackShareToken(payload);
  const base = `${origin}/api/feedback/share-card?data=${encodeURIComponent(token.data)}&sig=${encodeURIComponent(token.signature)}`;
  return {
    square: `${base}&format=square`,
    wide: `${base}&format=wide`,
  };
}
