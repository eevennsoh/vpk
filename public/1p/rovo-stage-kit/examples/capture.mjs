// Frame-exact capture of the stage to PNGs, as the Rovo stage lab exports its own videos.
//
//   npm i -D playwright && npx playwright install chromium
//   node examples/capture.mjs --seconds 6 --fps 30 --scale 2 --out frames
//
//   --seconds <s>   how much of the film (default: one loop of the stage)
//   --from <s>      the film second to start at (default 0)
//   --fps <n>       frames a second (default 30)
//   --scale <k>     device pixel ratio: 1 = the board's points (1600 × 900 for 16:9), 2.4 = 4K
//   --curtain <s>   open on the keynote's curtain, down <s> seconds
//   --stage <file>  another stage file (default: the kit's rovo-stage.json)
//   --out <dir>     where frame-00000.png… go (default ./frames)
//
// Encode them with any tool, e.g. ffmpeg -framerate 30 -i frames/frame-%05d.png -pix_fmt yuv420p out.mp4
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const at = args.indexOf(`--${name}`);
    return at >= 0 ? args[at + 1] : fallback;
};
const fps = Number(flag('fps', '30'));
const scale = Number(flag('scale', '1'));
const from = Number(flag('from', '0'));
const curtain = flag('curtain', null);
const stageFile = flag('stage', null);
const out = resolve(flag('out', 'frames'));
mkdirSync(out, { recursive: true });

// The kit's folder over HTTP (ES modules don't load from file://); a stage file of your own too.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://kit').pathname);
    const file = path === '/custom-stage.json' && stageFile ? resolve(stageFile) : join(kit, path);
    if (!file.startsWith(kit) && file !== resolve(stageFile ?? '')) return response.end();
    if (!existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404);
        return response.end();
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
});
await new Promise((listening) => server.listen(0, '127.0.0.1', listening));

// The stage composites on the GPU; each frame drawn whole, its images decoded, before it is shot.
const browser = await chromium.launch({
    args: [
        '--use-gl=angle',
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--run-all-compositor-stages-before-draw',
        '--disable-checker-imaging',
    ],
});
const query = new URLSearchParams({ t: String(from) });
if (curtain !== null) query.set('curtain', curtain);
if (stageFile) query.set('src', 'custom-stage.json');
// First read the board's size, then open a page exactly that size.
const probe = await browser.newPage();
await probe.goto(`http://127.0.0.1:${server.address().port}/stage.html?${query}`);
const info = await probe.evaluate(() => window.rovo.ready);
await probe.close();

const page = await browser.newPage({
    viewport: { width: info.width, height: info.height },
    deviceScaleFactor: scale,
});
await page.goto(`http://127.0.0.1:${server.address().port}/stage.html?${query}`);
await page.evaluate(() => window.rovo.ready);
const seconds = Number(flag('seconds', String(info.loop)));
const count = Math.round(seconds * fps);
for (let index = 0; index < count; index += 1) {
    // In order, a frame at a time: the lab's exporter does the same (see GUIDE.md, "Time").
    await page.evaluate((t) => window.rovo.frame(t), from + index / fps);
    await page.screenshot({ path: join(out, `frame-${String(index).padStart(5, '0')}.png`) });
    if (index % fps === 0) console.log(`frame ${index + 1} / ${count}`);
}
await browser.close();
server.close();
console.log(`${count} frames of ${info.width * scale} × ${info.height * scale} in ${out}`);
