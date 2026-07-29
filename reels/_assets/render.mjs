// Generic reel renderer: node render.mjs <reel.html> <out.mp4>
// The HTML must expose window.seek(ms) and window.REEL = { fps, durationMs }.
// Deps: playwright (local or global install), @ffmpeg-installer/ffmpeg.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import os from 'os';

function resolveDep(name) {
  for (const root of [import.meta.url, join(process.cwd(), 'noop.js'), '/opt/node22/lib/node_modules/noop.js']) {
    try { return createRequire(root)(name); } catch { /* next */ }
  }
  throw new Error(`Cannot resolve dependency: ${name}`);
}

const [htmlArg, outArg] = process.argv.slice(2);
if (!htmlArg || !outArg) { console.error('Usage: node render.mjs <reel.html> <out.mp4>'); process.exit(1); }
const html = resolve(htmlArg), out = resolve(outArg);

const { chromium } = resolveDep('playwright');
const ffmpegPath = process.env.FFMPEG || resolveDep('@ffmpeg-installer/ffmpeg').path;

const framesDir = join(os.tmpdir(), 'reel-frames-' + process.pid);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + html);
await page.waitForFunction('document.fonts.status === "loaded" && !!window.seek');

const { fps, durationMs } = await page.evaluate(() => window.REEL);
const total = Math.ceil(durationMs / 1000 * fps);
console.log(`Rendering ${total} frames @ ${fps}fps (${(durationMs / 1000).toFixed(1)}s)…`);

for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.seek(t), i * 1000 / fps);
  await page.screenshot({ path: join(framesDir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (i % 200 === 0) console.log(`  frame ${i}/${total}`);
}
await browser.close();

console.log('Encoding MP4…');
execFileSync(ffmpegPath, [
  '-y', '-framerate', String(fps), '-i', join(framesDir, 'f%05d.jpg'),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
], { stdio: 'inherit' });
rmSync(framesDir, { recursive: true, force: true });
console.log('Done →', out);
