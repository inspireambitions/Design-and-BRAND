/**
 * TEST-ONLY outbound network guard for the acceptance server.
 *
 * Loaded into the Next.js server process by the acceptance runner through
 *   NODE_OPTIONS="--import <this file>"
 * It is never part of the application bundle and never runs in production.
 *
 * Behaviour:
 *   - any outbound request whose host contains the production project ref is
 *     refused before it leaves the process and counted as a production contact;
 *   - requests to the isolated project ref are allowed and counted, which is
 *     the positive proof that the guard was active while the app talked to
 *     Supabase;
 *   - every decision is appended as one JSON line to ACCEPTANCE_GUARD_LOG.
 */
import { appendFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const PRODUCTION_REF = 'hmaxzpgsefzpflrwzopa';
const ISOLATED_REF = 'flznnwurtwernztltnva';
const logPath = process.env.ACCEPTANCE_GUARD_LOG;

function log(entry) {
  if (!logPath) return;
  try { appendFileSync(logPath, JSON.stringify({ t: Date.now(), pid: process.pid, ...entry }) + '\n'); } catch { /* best effort */ }
}
function classify(host) {
  const h = String(host || '').toLowerCase();
  if (h.includes(PRODUCTION_REF)) return 'production';
  if (h.includes(ISOLATED_REF)) return 'isolated';
  return 'other';
}
function guard(host, via) {
  const kind = classify(host);
  if (kind === 'production') {
    log({ kind, host, via, blocked: true });
    throw new Error(`ACCEPTANCE NETWORK GUARD: refused outbound request to production Supabase host ${host}`);
  }
  if (kind === 'isolated') log({ kind, host, via, blocked: false });
}
function hostOf(input) {
  try {
    if (typeof input === 'string') return new URL(input).host;
    if (input instanceof URL) return input.host;
    if (input && typeof input.url === 'string') return new URL(input.url).host;
  } catch { /* not a url */ }
  return '';
}

// fetch (undici), used by @supabase/supabase-js and Next.js itself
const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = function guardedFetch(input, init) {
    guard(hostOf(input), 'fetch');
    return originalFetch.call(this, input, init);
  };
}

// http / https request and get
for (const mod of [http, https]) {
  const originalRequest = mod.request;
  const originalGet = mod.get;
  mod.request = function guardedRequest(...args) {
    const opts = typeof args[0] === 'string' || args[0] instanceof URL ? { host: hostOf(args[0]) } : args[0] || {};
    guard(opts.hostname || opts.host || hostOf(args[0]), mod === https ? 'https.request' : 'http.request');
    return originalRequest.apply(this, args);
  };
  mod.get = function guardedGet(...args) {
    const opts = typeof args[0] === 'string' || args[0] instanceof URL ? { host: hostOf(args[0]) } : args[0] || {};
    guard(opts.hostname || opts.host || hostOf(args[0]), mod === https ? 'https.get' : 'http.get');
    return originalGet.apply(this, args);
  };
}

// raw sockets (pg and any other TCP client)
const originalNetConnect = net.connect;
const originalNetCreate = net.createConnection;
function guardSocketArgs(args, via) {
  const first = args[0];
  const host = typeof first === 'object' && first ? first.host : typeof args[1] === 'string' ? args[1] : '';
  guard(host, via);
}
net.connect = function guardedConnect(...args) { guardSocketArgs(args, 'net.connect'); return originalNetConnect.apply(this, args); };
net.createConnection = function guardedCreate(...args) { guardSocketArgs(args, 'net.createConnection'); return originalNetCreate.apply(this, args); };
const originalTlsConnect = tls.connect;
tls.connect = function guardedTls(...args) {
  const first = args[0];
  const host = typeof first === 'object' && first ? (first.servername || first.host) : typeof args[1] === 'string' ? args[1] : '';
  guard(host, 'tls.connect');
  return originalTlsConnect.apply(this, args);
};

log({ kind: 'guard', event: 'loaded', node: process.version });
