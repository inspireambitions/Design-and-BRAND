import { revalidatePath } from 'next/cache';
import { SIGNATURE_HEADER_NAME, isValidSignature } from '@sanity/webhook';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * Sanity calls this when a guide is published, updated or deleted, so the
 * guide pages can be fully static between edits instead of re-rendering on a
 * timer. Configure in Sanity under API, Webhooks:
 *
 *   URL:        https://trymuqabala.com/api/revalidate
 *   Trigger on: create, update, delete
 *   Filter:     _type == "guide"
 *   Projection: { _type, "slug": slug.current }
 *   Secret:     the value of SANITY_REVALIDATE_SECRET
 *
 * The request body is verified against that secret before anything is
 * revalidated. The body is a projection of the document, never anything a
 * candidate typed, and it is not logged.
 */

const MAX_BODY_BYTES = 16 * 1024;

const WebhookBody = z
  .object({
    _type: z.string().max(64).optional(),
    slug: z.string().regex(/^[a-z0-9-]{1,80}$/).nullable().optional(),
  })
  .passthrough();

function bodyTooLarge(request: Request): boolean {
  const declared = Number(request.headers.get('content-length') ?? '0');
  return Number.isFinite(declared) && declared > MAX_BODY_BYTES;
}

export async function POST(request: Request) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret || secret.trim().length < 16) {
    console.error('Sanity revalidation webhook is not configured.');
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  const signature = request.headers.get(SIGNATURE_HEADER_NAME);
  if (!signature) {
    return Response.json({ error: 'missing_signature' }, { status: 401 });
  }

  if (bodyTooLarge(request)) {
    return Response.json({ error: 'body_too_large' }, { status: 413 });
  }

  // Verify the raw text. Re-encoding parsed JSON can change the bytes and
  // make a genuine signature fail.
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return Response.json({ error: 'body_too_large' }, { status: 413 });
  }
  if (!(await isValidSignature(text, signature, secret.trim()))) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let raw: unknown = null;
  try {
    raw = text.trim() ? JSON.parse(text) : null;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = WebhookBody.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const slug = parsed.data.slug ?? null;
  const revalidated = ['/guides', '/sitemap.xml'];
  revalidatePath('/guides');
  revalidatePath('/sitemap.xml');
  if (slug) {
    revalidatePath(`/guides/${slug}`);
    revalidated.push(`/guides/${slug}`);
  } else {
    // No slug in the projection (or a deleted document whose slug is gone):
    // refresh every guide page rather than risk leaving one stale.
    revalidatePath('/guides/[slug]', 'page');
    revalidated.push('/guides/[slug]');
  }

  return Response.json({ revalidated, now: Date.now() });
}
