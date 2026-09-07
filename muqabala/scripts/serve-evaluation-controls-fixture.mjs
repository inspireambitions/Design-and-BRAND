import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/fixture.js', ['fixture.js', 'text/javascript; charset=utf-8']],
  ['/fixture.css', ['fixture.css', 'text/css; charset=utf-8']],
]);
const port = Number(process.argv[2] || 3118);
createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  try {
    const contents = await readFile(new URL('../out/evaluation-controls-fixture/' + file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    response.end(contents);
  } catch { response.writeHead(404); response.end('Build the fixture first.'); }
}).listen(port, '127.0.0.1', () => console.log(`Synthetic controls fixture: http://127.0.0.1:${port}`));
