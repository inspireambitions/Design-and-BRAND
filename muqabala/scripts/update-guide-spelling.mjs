import { getCliClient } from 'sanity/cli';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const apply = process.argv.includes('--apply');
const client = getCliClient({ apiVersion: '2026-08-28' }).withConfig({ useCdn: false, perspective: 'published' });
const query = '*[_type == "guide" && !(_id in path("drafts.**"))]{_id,_rev,title,excerpt,metaDescription,body,jsonLdRaw,faqJsonLdRaw}';
const docs = await client.fetch(query);
const spelling = value => typeof value === 'string'
  ? value.replace(/\bpractise\b/gi, word => word === 'PRACTISE' ? 'PRACTICE' : word[0] === 'P' ? 'Practice' : 'practice') : value;
function articleText(value) {
  if (Array.isArray(value)) return value.map(articleText);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ['text', 'name', 'headline', 'description'].includes(key) ? spelling(item) : articleText(item)]));
}
function changes(doc) {
  const set = {};
  for (const key of ['title', 'excerpt', 'metaDescription']) {
    if (doc[key] !== spelling(doc[key])) set[key] = spelling(doc[key]);
  }
  const body = articleText(doc.body);
  if (JSON.stringify(body) !== JSON.stringify(doc.body)) set.body = body;
  for (const key of ['jsonLdRaw', 'faqJsonLdRaw']) {
    if (!doc[key]) continue;
    const original = JSON.parse(doc[key]);
    const updated = articleText(original);
    if (JSON.stringify(original) !== JSON.stringify(updated)) set[key] = JSON.stringify(updated);
  }
  return set;
}
const patches = docs.map(doc => ({ doc, set: changes(doc) })).filter(item => Object.keys(item.set).length);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', guides: docs.length,
  patches: patches.map(({ doc, set }) => ({ id: doc._id, fields: Object.keys(set) })) }, null, 2));
if (apply && patches.length) {
  const audit = fileURLToPath(new URL('../../../audit/pilot-readiness-20260907/', import.meta.url));
  mkdirSync(audit, { recursive: true });
  writeFileSync(`${audit}cms-spelling-before-${Date.now()}.json`, JSON.stringify(patches.map(item => item.doc), null, 2));
  let transaction = client.transaction();
  for (const { doc, set } of patches) transaction = transaction.patch(doc._id, patch => patch.ifRevisionId(doc._rev).set(set));
  const result = await transaction.commit();
  console.log(JSON.stringify({ transactionId: result.transactionId, updated: patches.length }));
  const after = await client.fetch(query);
  const remaining = after.filter(doc => Object.keys(changes(doc)).length);
  console.log(JSON.stringify({ verifiedGuides: after.length, remaining: remaining.length }));
  if (remaining.length) process.exitCode = 1;
}
