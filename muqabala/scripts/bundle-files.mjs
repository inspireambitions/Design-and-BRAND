/** Unique modern Next.js script paths, including preload hints. */
export function initialScriptFiles(html) {
  const files = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries([...tag.matchAll(/\b([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, key, double, single]) => [key.toLowerCase(), double ?? single]));
    const script = /^<script\b/i.test(tag);
    if (script && /\bnomodule(?:\s|=|>)/i.test(tag)) continue;
    if (!script && !(attributes.rel === 'modulepreload' || (attributes.rel === 'preload' && attributes.as === 'script'))) continue;
    const url = script ? attributes.src : attributes.href;
    if (!url?.startsWith('/_next/')) continue;
    const file = decodeURIComponent(url.split(/[?#]/, 1)[0].slice('/_next/'.length));
    if (file.split(/[\\/]/).some(part => part === '..') || !file.startsWith('static/') || !file.endsWith('.js')) {
      throw new Error('Invalid Next.js script path in build output.');
    }
    files.add(file);
  }
  return [...files];
}
