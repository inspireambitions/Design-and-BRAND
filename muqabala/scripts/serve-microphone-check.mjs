// Local-only browser fixture. Use an isolated browser with simulated media.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('out/microphone-qa');
await mkdir(output, { recursive: true });
await build({
  stdin: { contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { MicrophoneCheck } from './components/MicrophoneCheck';
    function App() {
      const [stream, setStream] = useState(null), [confirmed, setConfirmed] = useState(false);
      const lang = new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en';
      return <main dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{maxWidth: 600, margin: '24px auto', fontFamily: 'Arial', padding: 12}}>
        {!stream ? <button onClick={async () => {
          const input = await navigator.mediaDevices.getUserMedia({audio:true});
          if (new URLSearchParams(location.search).has('silent')) input.getAudioTracks().forEach(track => { track.enabled = false; });
          setStream(input);
        }}>Open simulated microphone</button> :
        <><MicrophoneCheck stream={stream} lang={lang} onConfirm={setConfirmed}/><button disabled={!confirmed}>Continue test</button></>}
      </main>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, outfile: resolve(output, 'fixture.js'), jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
await writeFile(resolve(output, 'browser.json'), JSON.stringify({ browser: {
  browserName: 'chromium', isolated: true,
  launchOptions: { channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  contextOptions: { viewport: { width: 390, height: 844 } },
} }));
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Microphone check QA</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (path === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
  if (!['/fixture.js', '/fixture.css'].includes(path)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css');
  response.end(await readFile(resolve(output, path.slice(1))));
}).listen(3197, '127.0.0.1', () => console.log('Local microphone fixture: http://127.0.0.1:3197'));
