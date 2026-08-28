import assert from 'node:assert/strict';
import test from 'node:test';
import {
  articlePortableText,
  BabyLoveGrowthArticleSchema,
  markdownToPortableText,
  safeArticleSlug,
  sanityDocumentId,
} from '../lib/babylovegrowth.ts';

const article = BabyLoveGrowthArticleSchema.parse({
  id: 10,
  title: 'Test Article for Webhook Integration',
  slug: 'test-article-for-webhook-integration',
  metaDescription: 'Test article to verify webhook integration is working correctly',
  content_html: '<h1>Test Article for Webhook Integration</h1>',
  content_markdown: '# Test Article\n\n## What matters\n\nUse a real example.\n\n- Keep it short\n- Add proof',
  heroImageUrl: 'https://cdn.example.com/hero-image.jpg',
  jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
  faqJsonLd: { '@context': 'https://schema.org', '@type': 'FAQPage' },
  languageCode: 'en',
  publicUrl: 'https://example.com/test-article-webhook',
  createdAt: '2025-03-20T03:41:18.570Z',
});

test('accepts the documented BabyLoveGrowth payload', () => {
  assert.equal(article.id, 10);
  assert.equal(articlePortableText(article).length, 4);
});

test('keeps the title outside Portable Text and maps headings and lists', () => {
  const blocks = markdownToPortableText('# Page title\n\n## Section\n\nText.\n\n1. First');
  assert.deepEqual(blocks.map((block) => [block.style, block.listItem]), [
    ['h2', undefined],
    ['normal', undefined],
    ['normal', 'number'],
  ]);
});

test('creates safe stable slugs and idempotent draft IDs', () => {
  assert.equal(safeArticleSlug('', 'Tell me about yourself: Dubai'), 'tell-me-about-yourself-dubai');
  assert.equal(sanityDocumentId(article, true), 'drafts.guide-babylovegrowth-10');
  assert.equal(sanityDocumentId(article, false), 'guide-babylovegrowth-10');
});
