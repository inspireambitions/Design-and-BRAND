/** Measure modern first-load Next.js scripts from emitted HTML. Works with
 * webpack and Turbopack without relying on private client-reference formats. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { initialScriptFiles } from './bundle-files.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, '.next');
const budget = 200 * 1024;
if (!existsSync(path.join(output, 'BUILD_ID'))) throw new Error('Run a production build before checking its bundle.');
const manifest = JSON.parse(readFileSync(path.join(output, 'prerender-manifest.json'), 'utf8'));
const roles = Object.entries(manifest.routes)
  .filter(([, entry]) => entry.srcRoute === '/practice/[roleId]')
  .map(([route]) => route);
if (!roles.length) throw new Error('No prerendered catalogue role pages found.');

const measured = new Map();
function measure(route) {
  const html = readFileSync(path.join(output, 'server', 'app', `${route.slice(1)}.html`), 'utf8');
  const files = initialScriptFiles(html);
  if (!files.length) throw new Error(`No initial scripts found for ${route}.`);
  let bytes = 0;
  for (const file of files) {
    if (!measured.has(file)) measured.set(file, gzipSync(readFileSync(path.join(output, file)), { level: 9 }).length);
    bytes += measured.get(file);
  }
  return { route, bytes, chunks: files.length };
}
const entry = measure('/practice');
const catalogue = roles.map(measure).sort((a, b) => b.bytes - a.bytes);
for (const result of [entry, catalogue[0]]) {
  console.log(`${result.route}: ${(result.bytes / 1024).toFixed(1)} KB gzipped; ${result.chunks} initial chunks; ${result.bytes < budget ? 'PASS' : 'OVER BUDGET'}`);
}
console.log(`Checked all ${catalogue.length} catalogue pages. Budget: strictly below 200 KB per page.`);
if (entry.bytes >= budget || catalogue.some(result => result.bytes >= budget)) process.exitCode = 1;
