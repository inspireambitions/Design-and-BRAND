import { timingSafeEqual } from 'node:crypto';
import {
  articlePortableText,
  BabyLoveGrowthArticleSchema,
  safeArticleSlug,
  sanityDocumentId,
} from '@/lib/babylovegrowth';
import { sanityApiVersion, sanityDataset, sanityProjectId } from '@/lib/sanity/env';

export const runtime = 'nodejs';
export const maxDuration = 10;

const MAX_BODY_BYTES = 1024 * 1024;

function authorised(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const suppliedBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function bodyTooLarge(request: Request): boolean {
  const declared = Number(request.headers.get('content-length') ?? '0');
  return Number.isFinite(declared) && declared > MAX_BODY_BYTES;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.BABYLOVEGROWTH_WEBHOOK_SECRET;
  const sanityWriteToken = process.env.SANITY_API_WRITE_TOKEN;
  if (!webhookSecret || !sanityWriteToken) {
    console.error('BabyLoveGrowth webhook is missing server credentials.');
    return Response.json({ error: 'integration_not_configured' }, { status: 503 });
  }

  if (!authorised(request, webhookSecret)) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }

  if (bodyTooLarge(request)) {
    return Response.json({ error: 'body_too_large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      return Response.json({ error: 'body_too_large' }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = BabyLoveGrowthArticleSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_article' }, { status: 400 });
  }

  const article = parsed.data;
  const slug = safeArticleSlug(article.slug, article.title);
  if (!slug) {
    return Response.json({ error: 'invalid_slug' }, { status: 400 });
  }

  const body = articlePortableText(article);
  if (!body.length) {
    return Response.json({ error: 'empty_article' }, { status: 400 });
  }

  const publishImmediately = process.env.BABYLOVEGROWTH_PUBLISH_MODE === 'published';
  const documentId = sanityDocumentId(article, !publishImmediately);
  const document = {
    _id: documentId,
    _type: 'guide',
    title: article.title,
    slug: { _type: 'slug', current: slug },
    excerpt: article.metaDescription,
    metaDescription: article.metaDescription,
    body,
    practiceHref: '/practice',
    heroImageUrl: article.heroImageUrl || undefined,
    jsonLdRaw: article.jsonLd ? JSON.stringify(article.jsonLd) : undefined,
    faqJsonLdRaw: article.faqJsonLd ? JSON.stringify(article.faqJsonLd) : undefined,
    babyLoveGrowthId: String(article.id),
    sourceUrl: article.publicUrl || undefined,
    languageCode: article.languageCode || 'en',
    sourceCreatedAt: article.createdAt || undefined,
  };

  const response = await fetch(
    `https://${sanityProjectId}.api.sanity.io/v${sanityApiVersion}/data/mutate/${sanityDataset}?returnIds=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sanityWriteToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mutations: [{ createOrReplace: document }] }),
      signal: AbortSignal.timeout(4_500),
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!response?.ok) {
    console.error('BabyLoveGrowth webhook could not write the Sanity document.', response?.status ?? 'network');
    return Response.json({ error: 'sanity_write_failed' }, { status: 502 });
  }

  return Response.json({
    ok: true,
    id: documentId,
    slug,
    status: publishImmediately ? 'published' : 'draft',
  });
}
