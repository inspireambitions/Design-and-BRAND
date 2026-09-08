import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pagePreviews} from '../lib/link-previews.ts';
const results=[];
for(const [key,page] of Object.entries(pagePreviews)){
  const origin=key==='schools'?'http://localhost:3110':'http://localhost:3109';
  const response=await fetch(origin+page.path);assert.equal(response.status,200);
  const html=await response.text();
  for(const tag of [`<title>${page.title}</title>`,`name="description" content="${page.description}"`,`property="og:title" content="${page.title}"`,
    `property="og:description" content="${page.description}"`,`property="og:image" content="https://trymuqabala.com/og/${page.image}.png"`,
    'property="og:locale" content="en_GB"','name="twitter:card" content="summary_large_image"'])assert.ok(html.includes(tag),key+': '+tag);
  const image=await fetch(origin+'/og/'+page.image+'.png');assert.equal(image.status,200);
  const png=Buffer.from(await image.arrayBuffer());assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert.ok(png.length<300000);
  results.push({page:page.path,title:page.title,width:1200,height:630,bytes:png.length,renderedMetadata:true});
}
await writeFile('../docs/evidence/schools-preview-check.json',JSON.stringify({checkedAt:new Date().toISOString(),results,platformPreviewsVerified:false},null,2)+'\n');
console.log('All three rendered metadata sets and static PNGs passed. Messaging app rendering is a separate check.');
