// Renders reel.html frame-by-frame with Playwright Chromium and encodes an MP4.
// Deps: playwright (or a global install), @ffmpeg-installer/ffmpeg.
// Usage: node render.mjs [outPath]
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);

function resolveDep(name) {
  for (const root of [import.meta.url, join(process.cwd(), 'noop.js'), '/opt/node22/lib/node_modules/noop.js']) {
    try { return createRequire(root)(name); } catch { /* next */ }
  }
  throw new Error(`Cannot resolve dependency: ${name}`);
}

const { chromium } = resolveDep('playwright');
const ffmpegPath = process.env.FFMPEG || resolveDep('@ffmpeg-installer/ffmpeg').path;

const out = resolve(process.argv[2] || join(here, '..', 'uae-gratuity-launch-reel.mp4'));
const framesDir = join(os.tmpdir(), 'reel-frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + join(here, 'reel.html'));
await page.waitForFunction('document.fonts.status === "loaded" && !!window.seek');

const { fps, durationMs } = await page.evaluate(() => window.REEL);
const total = Math.ceil(durationMs / 1000 * fps);
console.log(`Rendering ${total} frames @ ${fps}fps (${(durationMs / 1000).toFixed(1)}s)…`);

for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.seek(t), i * 1000 / fps);
  await page.screenshot({ path: join(framesDir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (i % 150 === 0) console.log(`  frame ${i}/${total}`);
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
