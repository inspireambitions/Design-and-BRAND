import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Muqabala contact is native and does not depend on Inspire Ambitions contact', async () => {
  const [component, content, page] = await Promise.all([
    readFile(new URL('components/ContactPage.tsx', root), 'utf8'),
    readFile(new URL('lib/marketing-content.ts', root), 'utf8'),
    readFile(new URL('app/contact/page.tsx', root), 'utf8'),
  ]);
  const combined = `${component}\n${content}\n${page}`;
  assert.match(component, /mailto:\$\{email\}/);
  assert.match(component, /hello@trymuqabala\.com/);
  assert.doesNotMatch(combined, /inspireambitions\.com\/contact/i);
  assert.doesNotMatch(component, /target=["']_blank["']/i);
  assert.match(page, /canonical: '\/contact'/);
});
