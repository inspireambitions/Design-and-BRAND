import { defineField, defineType } from 'sanity';

export const guideType = defineType({
  name: 'guide',
  title: 'Guide',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title (English)',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'titleAr',
      title: 'Title (Arabic)',
      type: 'string',
      validation: (rule) => rule.max(160),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 80 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Short intro (English)',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(280),
    }),
    defineField({
      name: 'excerptAr',
      title: 'Short intro (Arabic)',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(360),
    }),
    defineField({
      name: 'metaDescription',
      title: 'SEO description',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(500),
    }),
    defineField({
      name: 'body',
      title: 'Guide (English)',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'bodyAr',
      title: 'Guide (Arabic)',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'practiceHref',
      title: 'Practice link',
      type: 'string',
      initialValue: '/practice',
      description: 'Where the reader starts practising after the guide.',
    }),
    defineField({ name: 'heroImageUrl', title: 'Hero image URL', type: 'url' }),
    defineField({ name: 'jsonLdRaw', title: 'Article structured data (JSON)', type: 'text', rows: 8, readOnly: true }),
    defineField({ name: 'faqJsonLdRaw', title: 'FAQ structured data (JSON)', type: 'text', rows: 8, readOnly: true }),
    defineField({ name: 'babyLoveGrowthId', title: 'BabyLoveGrowth article ID', type: 'string', readOnly: true }),
    defineField({ name: 'sourceUrl', title: 'Source URL', type: 'url', readOnly: true }),
    defineField({ name: 'languageCode', title: 'Language code', type: 'string', readOnly: true }),
    defineField({ name: 'sourceCreatedAt', title: 'Source created at', type: 'datetime', readOnly: true }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
});
