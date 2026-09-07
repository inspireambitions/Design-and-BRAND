import test from 'node:test';
import assert from 'node:assert/strict';
import { guideSpelling } from '../lib/sanity/spelling.ts';

test('guide spelling changes prose and structured data without changing links or identifiers', () => {
  const original = { _id: 'practise', slug: 'practise', title: 'Practise now',
    body: [{ _key: 'practise', children: [{ text: 'PRACTISE, practised and practising.' }], markDefs: [{ href: '/practise' }] }],
    jsonLdRaw: JSON.stringify({ '@id': '/practise', headline: 'Practise', description: 'She practises.' }) };
  const output = guideSpelling(original);
  assert.equal(output.title, 'Practice now');
  assert.equal(output.body[0].children[0].text, 'PRACTICE, practiced and practicing.');
  assert.equal(output._id, original._id);
  assert.equal(output.slug, original.slug);
  assert.equal(output.body[0]._key, 'practise');
  assert.deepEqual(output.body[0].markDefs, original.body[0].markDefs);
  assert.deepEqual(JSON.parse(output.jsonLdRaw), { '@id': '/practise', headline: 'Practice', description: 'She practices.' });
  assert.equal(original.title, 'Practise now');
});

test('guide spelling preserves Arabic, nulls and malformed structured data for the existing validator', () => {
  assert.equal(guideSpelling(null), null);
  assert.deepEqual(guideSpelling({ titleAr: 'تدرّب', jsonLdRaw: '{bad' }), { titleAr: 'تدرّب', jsonLdRaw: '{bad' });
});
