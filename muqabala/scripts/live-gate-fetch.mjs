import { execFile } from 'node:child_process';
const sessions = new Map();

// Optional authenticated transport for protected review deployments. Vercel CLI
// handles its own credentials; neither tokens nor attempt cookies go into logs.
export async function gateFetch(url, options = {}) {
  const cli = process.env.SCORING_VERCEL_CLI;
  if (!cli) return fetch(url, { signal: AbortSignal.timeout(60_000), ...options });
  const target = new URL(url);
  if (!target.hostname.endsWith('.vercel.app')) throw new Error('CLI transport is only for review deployments');
  if (!sessions.has(target.origin)) {
    sessions.set(target.origin, (async () => {
      const response = await cliFetch(new URL('/api/score', target.origin), cli, {
        headers: { 'x-vercel-set-bypass-cookie': 'true' },
      });
      const cookie = response.headers.getSetCookie().find(value => value.startsWith('_vercel_jwt='));
      if (!cookie) throw new Error('Authenticated preview session could not be established');
      return cookie.split(';', 1)[0];
    })());
  }
  const headers = new Headers(options.headers);
  const cookie = await sessions.get(target.origin);
  headers.set('Cookie', [cookie, headers.get('Cookie')].filter(Boolean).join('; '));
  return fetch(url, { signal: AbortSignal.timeout(60_000), ...options, headers, redirect: 'manual' });
}

async function cliFetch(target, cli, options = {}) {
  const args = [cli, 'curl', target.pathname + target.search, '--deployment', target.origin,
    '--scope', process.env.VERCEL_SCOPE || 'inspire14', '--', '--silent', '--show-error', '--include',
    '--max-time', '60', '--request', options.method || 'GET'];
  for (const [key, value] of Object.entries(options.headers || {})) args.push('--header', `${key}: ${value}`);
  if (options.body) args.push('--data-binary', '@-');
  const raw = await new Promise((resolve, reject) => {
    const child = execFile(process.execPath, args, { timeout: 90_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) reject(new Error(`Authenticated preview request failed (${error.code ?? 'transport'})`));
      else resolve(stdout);
    });
    child.stdin.end(options.body || '');
  });
  let remaining = raw.slice(raw.search(/^HTTP\/\S+ \d{3}/m));
  if (!remaining.startsWith('HTTP/')) throw new Error('Preview request returned no HTTP response');
  // curl can print a proxy CONNECT or 100 Continue block before the response.
  while (true) {
    const end = remaining.indexOf('\r\n\r\n');
    if (end < 0) throw new Error('Invalid preview HTTP response');
    const lines = remaining.slice(0, end).split('\r\n');
    const status = Number(lines[0].split(' ')[1]);
    const body = remaining.slice(end + 4);
    if (body.startsWith('HTTP/')) { remaining = body; continue; }
    const headers = new Headers();
    for (const line of lines.slice(1)) {
      const colon = line.indexOf(':');
      if (colon > 0) headers.append(line.slice(0, colon), line.slice(colon + 1).trim());
    }
    return new Response([204, 205, 304].includes(status) ? null : body, { status, headers });
  }
}
