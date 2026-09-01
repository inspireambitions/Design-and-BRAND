#!/usr/bin/env node
/**
 * Bundle budget for the candidate routes.
 *
 * Run after `next build`. Computes the gzipped size of the JavaScript a browser
 * must download before the page is interactive (first-load JS) for `/practice`
 * and `/practice/[roleId]`, prints the per-chunk breakdown, and exits 1 when a
 * route is over budget.
 *
 * First-load JS is the union of the shared runtime chunks (`rootMainFiles`),
 * the root layout's chunks, and the page's own chunks. The legacy polyfill
 * chunk is excluded because it is a `nomodule` script that modern browsers
 * never fetch.
 *
 * Works with both Turbopack (client reference manifests) and webpack
 * (`app-build-manifest.json`) builds.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 200;
const ROUTES = ['/practice', '/practice/[roleId]'];

const projectDir = path.resolve(new URL('..', import.meta.url).pathname);
const nextDir = path.join(projectDir, '.next');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(path.join(nextDir, 'BUILD_ID'))) {
  fail('No production build found in .next. Run `npm run build` first.');
}

const rootManifest = JSON.parse(readFileSync(path.join(nextDir, 'build-manifest.json'), 'utf8'));
const rootMainFiles = rootManifest.rootMainFiles ?? [];

function normalise(file) {
  return file.replace(/^\/_next\//, '').replace(/^\//, '');
}

/** Turbopack writes one client reference manifest per page with the entry chunks. */
function turbopackChunks(route) {
  const manifestPath = path.join(nextDir, 'server', 'app', route.slice(1), 'page_client-reference-manifest.js');
  if (!existsSync(manifestPath)) return null;
  const sandbox = {};
  new Function('globalThis', readFileSync(manifestPath, 'utf8'))(sandbox);
  const manifest = Object.values(sandbox.__RSC_MANIFEST ?? {})[0];
  const entries = manifest?.entryJSFiles;
  if (!entries) return null;
  const pageKey = Object.keys(entries).find((key) => key.endsWith(`${route}/page`));
  const layoutKey = Object.keys(entries).find((key) => key.endsWith('/app/layout'));
  if (!pageKey) return null;
  return [...(entries[layoutKey] ?? []), ...entries[pageKey]];
}

/** Webpack writes a single app-build-manifest with the same information. */
function webpackChunks(route) {
  const manifestPath = path.join(nextDir, 'app-build-manifest.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const page = manifest.pages?.[`${route}/page`];
  if (!page) return null;
  return [...(manifest.pages['/layout'] ?? []), ...page];
}

function firstLoadFiles(route) {
  const pageChunks = turbopackChunks(route) ?? webpackChunks(route);
  if (!pageChunks) fail(`Could not find the client chunks for ${route} in the build output.`);
  const files = new Set([...rootMainFiles, ...pageChunks].map(normalise));
  return [...files].filter((file) => file.endsWith('.js'));
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let overBudget = false;
const summary = [];

for (const route of ROUTES) {
  const files = firstLoadFiles(route);
  let totalRaw = 0;
  let totalGzip = 0;
  const rows = [];
  for (const file of files) {
    const buffer = readFileSync(path.join(nextDir, file));
    const gzip = gzipSync(buffer, { level: 9 }).length;
    totalRaw += buffer.length;
    totalGzip += gzip;
    rows.push({ file, raw: buffer.length, gzip });
  }
  rows.sort((a, b) => b.gzip - a.gzip);

  console.log(`\n${route}`);
  console.log(`${'chunk'.padEnd(46)}${'raw'.padStart(12)}${'gzip'.padStart(12)}`);
  for (const row of rows) {
    console.log(`${row.file.padEnd(46)}${formatKb(row.raw).padStart(12)}${formatKb(row.gzip).padStart(12)}`);
  }
  console.log(`${'first-load JS'.padEnd(46)}${formatKb(totalRaw).padStart(12)}${formatKb(totalGzip).padStart(12)}`);

  const over = totalGzip > BUDGET_KB * 1024;
  overBudget ||= over;
  summary.push(`${route}: ${formatKb(totalGzip)} gzipped (${over ? 'OVER' : 'within'} the ${BUDGET_KB} KB budget)`);
}

console.log('');
for (const line of summary) console.log(line);

if (overBudget) {
  console.error(`\nBundle budget exceeded: first-load JavaScript must stay under ${BUDGET_KB} KB gzipped.`);
  process.exit(1);
}
