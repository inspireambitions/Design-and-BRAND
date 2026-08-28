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
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
});
