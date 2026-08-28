import { z } from 'zod';

const MAX_CONTENT_CHARS = 750_000;

export const BabyLoveGrowthArticleSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).optional().default(''),
    metaDescription: z.string().trim().max(500).optional().default(''),
    content_html: z.string().max(MAX_CONTENT_CHARS).optional().default(''),
    content_markdown: z.string().max(MAX_CONTENT_CHARS).optional().default(''),
    heroImageUrl: z.string().url().max(2_000).optional().or(z.literal('')).default(''),
    jsonLd: z.record(z.string(), z.unknown()).optional().nullable(),
    faqJsonLd: z.record(z.string(), z.unknown()).optional().nullable(),
    languageCode: z.string().trim().max(20).optional().default('en'),
    publicUrl: z.string().url().max(2_000).optional().or(z.literal('')).default(''),
    createdAt: z.string().datetime().optional(),
  })
  .passthrough()
  .refine((article) => article.content_markdown || article.content_html, {
    message: 'Article content is required.',
  });

export type BabyLoveGrowthArticle = z.infer<typeof BabyLoveGrowthArticleSchema>;

type PortableTextSpan = {
  _type: 'span';
  _key: string;
  text: string;
  marks: string[];
};

export type PortableTextBlock = {
  _type: 'block';
  _key: string;
  style: 'normal' | 'h2' | 'h3';
  markDefs: never[];
  children: PortableTextSpan[];
  listItem?: 'bullet' | 'number';
  level?: number;
};

function plainInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|[^\\])[*_~`]{1,3}/g, '$1')
    .replace(/\\([\\`*_{}\[\]()#+.!~-])/g, '$1')
    .trim();
}

function portableBlock(
  index: number,
  text: string,
  style: PortableTextBlock['style'] = 'normal',
  listItem?: PortableTextBlock['listItem'],
): PortableTextBlock {
  const key = `blg-${index}`;
  return {
    _type: 'block',
    _key: key,
    style,
    markDefs: [],
    children: [{ _type: 'span', _key: `${key}-span`, text: plainInlineMarkdown(text), marks: [] }],
    ...(listItem ? { listItem, level: 1 } : {}),
  };
}

export function markdownToPortableText(markdown: string): PortableTextBlock[] {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const blocks: PortableTextBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    paragraph = [];
    if (text) blocks.push(portableBlock(blocks.length, text));
  };

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      // The article title is already the page H1. Preserve lower headings only.
      if (heading[1].length > 1) {
        blocks.push(portableBlock(blocks.length, heading[2], heading[1].length === 2 ? 'h2' : 'h3'));
      }
      continue;
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push(portableBlock(blocks.length, bullet[1], 'normal', 'bullet'));
      continue;
    }

    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph();
      blocks.push(portableBlock(blocks.length, numbered[1], 'normal', 'number'));
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(h[1-3]|p|li|blockquote|div)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

export function articlePortableText(article: BabyLoveGrowthArticle): PortableTextBlock[] {
  const markdown = article.content_markdown.trim();
  return markdownToPortableText(markdown || htmlToPlainText(article.content_html));
}

export function safeArticleSlug(value: string, title: string): string {
  const source = value || title;
  return source
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function sanityDocumentId(article: BabyLoveGrowthArticle, draft: boolean): string {
  const sourceId = String(article.id).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80);
  const stableId = `guide-babylovegrowth-${sourceId || safeArticleSlug(article.slug, article.title)}`;
  return draft ? `drafts.${stableId}` : stableId;
}
