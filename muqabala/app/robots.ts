import type { MetadataRoute } from 'next';

const PRIVATE_PATHS = ['/api/', '/progress', '/s/'];

// AI assistant crawlers, named explicitly so the welcome survives any future
// tightening of the wildcard rule: OpenAI (training, search index, live
// browsing), Anthropic, Perplexity, Google's AI training fetcher and Meta.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'meta-externalagent',
  'CCBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: 'https://trymuqabala.com/sitemap.xml',
    host: 'https://trymuqabala.com',
  };
}
