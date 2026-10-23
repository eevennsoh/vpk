// Opt-in end-to-end pipeline test (ws4a-labs.md §9 pipeline.browser): capture the rehearsal fixture (hold 0–6 s,
// then a screencast of the live Throw), encode, embed into a rendered template copy, and write a lite copy.
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/media/pipeline.browser.test.mjs   (unsandboxed)
// Everything is written under the temp dir. Skips without VPK_HTML_BROWSER=1 or without ffmpeg.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateHtmlString } from "../check-html.mjs";
import { findJsonIslands, parseJsonIsland } from "../json-island.mjs";
import { applyCaseStudy, renderCaseStudy } from "../lab/render-case-study.mjs";
import { CaptureSpecError, loadCaptureSpec, normalizeSpec, runCapture, specFromUrlArgs } from "./capture.mjs";
import { embedDocument } from "./embed.mjs";
import { encodeFilm } from "./encode.mjs";
import { findTool } from "./presets.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, "..", "..");
const FIXTURES = path.join(SKILL, "assets", "lab", "fixtures");
const SPEC = path.join(FIXTURES, "rehearsal-target.capture.mjs");
const skip = process.env.VPK_HTML_BROWSER !== "1" ? "set VPK_HTML_BROWSER=1 (unsandboxed) to run" : !findTool("ffmpeg") ? "ffmpeg is not on PATH" : false;
let dir;
let holdRun;
let mixedRun;

async function capture(name, extraSegments = []) {
	const raw = await loadCaptureSpec(SPEC);
	const spec = normalizeSpec({ ...raw, segments: [...raw.segments, ...extraSegments] }, { specPath: SPEC, framesDir: path.join(dir, name, "frames"), manifestDir: path.join(dir, name) });
	const run = await runCapture(spec);
	const film = path.join(dir, name, "film.mp4");
	const encoded = encodeFilm({ input: spec.framesDir, output: film, preset: "film" });
	return { spec, ...run, film, encoded };
}

before(async () => {
	if (skip) return;
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-pipeline-")));
	holdRun = await capture("hold");
	const { throwScreencast } = await import(pathToFileURL(SPEC).href);
	mixedRun = await capture("mixed", [throwScreencast]);
});
after(() => {
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test("hold capture: frames/fps film span, a linear clock, and the film is within one frame of the manifest", { skip }, () => {
	const { manifest, encoded } = holdRun;
	const [hold] = manifest.segments;
	assert.equal(hold.frames, 181);
	assert.equal(hold.film[1] - hold.film[0], hold.frames / 30, "film[1] − film[0] = frames / fps");
	assert.deepEqual(hold.clock, { kind: "linear", start: 0, rate: 1 });
	assert.ok(Math.abs(encoded.probe.duration - manifest.duration) <= 1 / 30 + 1e-6, `ffprobe ${encoded.probe.duration} vs manifest ${manifest.duration}`);
	assert.ok(Math.abs(encoded.probe.frames - manifest.frames) <= 1, `frames ${encoded.probe.frames} vs ${manifest.frames}`);
	assert.deepEqual(manifest.errors, []);
	assert.equal(manifest.source.ffconcat, "frames/frames.ffconcat");
	console.log(`# hold: manifest ${manifest.frames} frames ${manifest.duration.toFixed(6)} s; film ${encoded.probe.frames} frames ${encoded.probe.duration.toFixed(6)} s, ${encoded.bytes} B`);
});

test("hold + screencast: the screencast is listed after the hold and the film is within three frames", { skip }, () => {
	const { manifest, encoded } = mixedRun;
	assert.deepEqual(manifest.segments.map(segment => [segment.id, segment.kind]), [["clock", "hold"], ["live", "screencast"]]);
	const [hold, live] = manifest.segments;
	assert.equal(live.film[0], hold.film[1]);
	assert.ok(live.frames > 10, `screencast frames: ${live.frames}`);
	assert.ok(manifest.marks.throw >= live.film[0] - 1e-6, "the drive's mark lands in the screencast segment");
	assert.ok(Math.abs(encoded.probe.frames - Math.round(manifest.duration * 30)) <= 3, `frames ${encoded.probe.frames} vs ${manifest.duration * 30}`);
	assert.ok(Math.abs(encoded.probe.duration - manifest.duration) <= 3 / 30 + 1e-6, `duration ${encoded.probe.duration} vs ${manifest.duration}`);
	console.log(`# hold + screencast: manifest ${manifest.frames} frames ${manifest.duration.toFixed(6)} s (screencast ${live.frames}); film ${encoded.probe.frames} frames ${encoded.probe.duration.toFixed(6)} s`);
});

test("frame f00030 (hold t = 1.0) shows card 1 where the fixture's maths puts it, within 4 px", { skip }, async () => {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
		await page.goto(pathToFileURL(path.join(FIXTURES, "rehearsal-target.html")).href);
		const expected = await page.evaluate(() => window.__vpkFixture.cardBox(1.0, 0));
		const frame = fs.readFileSync(path.join(holdRun.spec.framesDir, "clock", "f00030.jpg")).toString("base64");
		const left = await page.evaluate(async ({ jpeg, row }) => {
			const img = new Image();
			img.src = `data:image/jpeg;base64,${jpeg}`;
			await img.decode();
			const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);
			const line = ctx.getImageData(0, Math.round(row), img.width, 1).data;
			for (let x = 0; x < img.width; x += 1) if (line[x * 4] < 90) return x;
			return null;
		}, { jpeg: frame, row: expected.y + expected.h / 2 });
		assert.ok(left !== null, "card found on its row");
		assert.ok(Math.abs(left - expected.x) <= 4, `card left edge ${left} px, expected ${expected.x.toFixed(1)} px`);
		console.log(`# f00030: card left edge ${left} px, expected ${expected.x.toFixed(2)} px`);
	} finally {
		await browser.close();
	}
});

test("embed into a rendered template copy passes check-html; a lite copy at non-film bytes + 200,000 fits and passes", { skip }, async () => {
	const ir = JSON.parse(fs.readFileSync(path.join(FIXTURES, "demo.content.json"), "utf8"));
	const html = applyCaseStudy(fs.readFileSync(path.join(SKILL, "assets", "templates", "motion-case-study.html"), "utf8"), renderCaseStudy(ir));
	const file = path.join(dir, "case.html");
	fs.writeFileSync(file, html);
	const full = await embedDocument({ htmlFile: file, film: holdRun.film, manifest: path.join(dir, "hold", "capture.json"), cwd: dir, lite: "never" });
	const embedded = fs.readFileSync(file, "utf8");
	assert.deepEqual(validateHtmlString(embedded, "case.html").failures, []);
	const data = parseJsonIsland(findJsonIslands(embedded, "data-vpk-film-data")[0].raw);
	assert.equal(data.segments[0].id, "clock");
	assert.equal(data.chapters.length, 3);
	const filmChars = /src="(data:video\/mp4;base64,[^"]+)"/.exec(embedded)[1].length;
	const budgetBytes = full.weight.bytes - filmChars + 200000;
	const result = await embedDocument({ htmlFile: file, film: holdRun.film, manifest: path.join(dir, "hold", "capture.json"), cwd: dir, lite: "always", budgetBytes });
	const lite = fs.readFileSync(path.join(dir, "case.lite.html"), "utf8");
	assert.ok(result.lite);
	assert.ok(Buffer.byteLength(lite) <= budgetBytes, `${Buffer.byteLength(lite)} ≤ ${budgetBytes}`);
	assert.deepEqual(validateHtmlString(lite, "case.lite.html").failures, []);
	assert.match(lite, /data-vpk-variant="lite"/);
	console.log(`# lite: film ${result.lite.filmBytes} B${result.lite.retried ? " (retried)" : ""}, page ${result.lite.bytes} B under ${budgetBytes} B`);
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		await page.goto(pathToFileURL(path.join(dir, "case.lite.html")).href);
		await page.evaluate(() => window.vpkLab.ready);
		const note = await page.evaluate(() => {
			const element = document.querySelector(".vpk-film-lite-note");
			return element ? { text: element.textContent, inFilm: Boolean(element.closest("[data-vpk-film]")), shown: element.getClientRects().length > 0 } : null;
		});
		assert.ok(note, "the lite note survives kit init");
		assert.deepEqual({ inFilm: note.inFilm, shown: note.shown }, { inFilm: true, shown: true });
		assert.match(note.text, /^Lite copy: the film is re-encoded at 640 × \d+ .* The full copy is case\.html\.$/);
		await page.waitForFunction(() => document.querySelector("[data-vpk-film-video]").readyState >= 2);
		await page.locator("[data-vpk-film-bigplay]").scrollIntoViewIfNeeded();
		await page.locator("[data-vpk-film-bigplay]").click();
		await page.waitForTimeout(400);
		assert.equal(await page.evaluate(() => document.querySelector("[data-vpk-film-video]").paused), false, "a centre click on the big play starts the lite film");
		assert.deepEqual(errors, []);
	} finally {
		await browser.close();
	}
});

test("lite still strip (item 17): a film target below 120 KB gives a lite copy with chapter stills and no film, renders without errors in light and dark, and passes check-html", { skip }, async () => {
	const ir = JSON.parse(fs.readFileSync(path.join(FIXTURES, "demo.content.json"), "utf8"));
	const file = path.join(dir, "strip.html");
	fs.writeFileSync(file, applyCaseStudy(fs.readFileSync(path.join(SKILL, "assets", "templates", "motion-case-study.html"), "utf8"), renderCaseStudy(ir)));
	const manifest = path.join(dir, "hold", "capture.json");
	const full = await embedDocument({ htmlFile: file, film: holdRun.film, manifest, cwd: dir, lite: "never" });
	const filmChars = /src="(data:video\/mp4;base64,[^"]+)"/.exec(fs.readFileSync(file, "utf8"))[1].length;
	const budgetBytes = full.weight.bytes - filmChars + 60000;
	const result = await embedDocument({ htmlFile: file, film: holdRun.film, manifest, cwd: dir, lite: "always", budgetBytes });
	assert.equal(result.lite.strip, true, "a target under 120,000 B takes the strip path");
	const lite = fs.readFileSync(path.join(dir, "strip.lite.html"), "utf8");
	assert.ok(Buffer.byteLength(lite) <= budgetBytes, `${Buffer.byteLength(lite)} ≤ ${budgetBytes}`);
	assert.deepEqual(validateHtmlString(lite, "strip.lite.html").failures, []);
	assert.doesNotMatch(lite, /data:video\/mp4/, "no film bytes");
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		for (const colorScheme of ["light", "dark"]) {
			const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme });
			const errors = [];
			page.on("pageerror", error => errors.push(error.message));
			page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
			await page.goto(pathToFileURL(path.join(dir, "strip.lite.html")).href);
			await page.evaluate(() => window.vpkLab.ready);
			const state = await page.evaluate(() => {
				const shown = element => Boolean(element) && element.getClientRects().length > 0;
				const images = [...document.querySelectorAll(".vpk-film-strip img")];
				return {
					stills: images.length, loaded: images.every(image => image.complete && image.naturalWidth > 0), alts: images.every(image => image.alt.length > 10),
					strip: shown(document.querySelector(".vpk-film-strip")), bar: shown(document.querySelector(".vpk-film-bar")), empty: shown(document.querySelector("[data-vpk-film-empty]")),
					note: document.querySelector(".vpk-film-lite-note")?.textContent ?? "", videoSrc: document.querySelector("[data-vpk-film-video]").getAttribute("src"),
				};
			});
			assert.deepEqual({ strip: state.strip, bar: state.bar, empty: state.empty, loaded: state.loaded, alts: state.alts, videoSrc: state.videoSrc }, { strip: true, bar: false, empty: true, loaded: true, alts: true, videoSrc: null }, colorScheme);
			assert.equal(state.stills, 3, "the demo's three chapters");
			assert.match(state.note, /^Lite copy: the film is left out/);
			assert.deepEqual(errors, [], `${colorScheme}: no console or page errors`);
			await page.locator(".vpk-film-strip").scrollIntoViewIfNeeded();
			await page.screenshot({ path: path.join(dir, `strip-${colorScheme}.png`) });
			await page.close();
		}
		console.log(`# strip: ${result.lite.bytes} B under ${budgetBytes} B, 3 chapter stills, light + dark clean`);
	} finally {
		await browser.close();
	}
});

test("a live screencast of a page that stops repainting keeps its requested length (the still tail)", { skip }, async () => {
	const page = path.join(dir, "still.html");
	fs.writeFileSync(page, "<!doctype html><html lang=\"en\"><body style=\"margin:0;background:#eee\"><h1>Still</h1></body></html>\n");
	const spec = normalizeSpec(specFromUrlArgs({ url: pathToFileURL(page).href, live: 1.5, viewport: "800x600", waitMs: 200 }), { framesDir: path.join(dir, "still", "frames"), manifestDir: path.join(dir, "still") });
	const { manifest } = await runCapture(spec);
	const [live] = manifest.segments;
	assert.equal(live.kind, "screencast");
	assert.ok(manifest.duration >= 1.4 && manifest.duration <= 1.8, `${live.frames} frame(s), film ${manifest.duration} s for --live 1.5`);
	console.log(`# still: ${live.frames} frame(s), film ${manifest.duration.toFixed(6)} s for --live 1.5`);
});

test("a hold on a page without window.__vpkRehearsal stops before its first frame, naming --hold and --live (no TypeError)", { skip }, async () => {
	const page = path.join(dir, "nohook.html");
	fs.writeFileSync(page, "<!doctype html><html lang=\"en\"><body><h1>No rehearsal hook</h1></body></html>\n");
	const spec = normalizeSpec(specFromUrlArgs({ url: pathToFileURL(page).href, end: 0.2, fps: 10, viewport: "800x600", waitMs: 0 }), { framesDir: path.join(dir, "nohook", "frames"), manifestDir: path.join(dir, "nohook") });
	await assert.rejects(runCapture(spec), error => {
		assert.ok(error instanceof CaptureSpecError, String(error));
		assert.match(error.message, /window\.__vpkRehearsal\.hold\(t\), which file:.*nohook\.html does not define\. Pass --hold "<expr with t>"/);
		assert.match(error.message, /or --live <s>/);
		assert.doesNotMatch(error.message, /TypeError/);
		return true;
	});
	assert.equal(fs.existsSync(path.join(dir, "nohook", "capture.json")), false, "no manifest");
	assert.deepEqual(fs.readdirSync(path.join(dir, "nohook", "frames", "clock")), [], "no frame");
});

// ---------- P1: virtual segments, cursor overlay and glide, hq ----------

/** A page animated three ways, all started by window.__start() (the segment's arm hook): rAF, CSS, and a setTimeout chain. */
const VIRTUAL_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>virtual</title>
<style>html,body{margin:0;background:#fff}div{position:absolute;left:0;height:40px;width:40px;background:#000}#raf{top:100px}#css{top:200px}#tm{top:300px}
@keyframes slide{from{transform:translateX(0)}to{transform:translateX(400px)}}</style></head>
<body><div id="raf"></div><div id="css"></div><div id="tm"></div>
<script>
let t0 = 0, running = false, ticks = 0;
function frame(now) { if (!running) return; document.getElementById("raf").style.transform = "translateX(" + (now - t0) * 0.2 + "px)"; requestAnimationFrame(frame); }
function tick() { ticks += 1; document.getElementById("tm").style.width = (40 + ticks * 10) + "px"; setTimeout(tick, 90); }
window.__start = () => { t0 = performance.now(); running = true; requestAnimationFrame(frame); setTimeout(tick, 90); document.getElementById("css").style.animation = "slide 2s linear forwards"; };
</script></body></html>
`;

/** Left and right edge of the dark run on `row` of a JPEG (measured in a throwaway Chromium page), or null. */
async function darkSpans(file, rows) {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		const jpeg = fs.readFileSync(file).toString("base64");
		return await page.evaluate(async ({ jpeg, rows }) => {
			const img = new Image();
			img.src = `data:image/jpeg;base64,${jpeg}`;
			await img.decode();
			const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
			const ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);
			return rows.map(row => {
				const line = ctx.getImageData(0, row, img.width, 1).data;
				let left = null;
				let right = null;
				for (let x = 0; x < img.width; x += 1) if (line[x * 4] < 90) { left ??= x; right = x; }
				return left === null ? null : { left, right };
			});
		}, { jpeg, rows });
	} finally {
		await browser.close();
	}
}

async function virtualCapture(name, settleMs) {
	const file = path.join(dir, `${name}.html`);
	fs.writeFileSync(file, VIRTUAL_PAGE);
	const spec = normalizeSpec({
		url: pathToFileURL(file).href, viewport: { width: 800, height: 600 }, fps: 30, ready: { selector: "#raf", settleMs: 100 },
		segments: [{ id: "page", kind: "virtual", label: "page clock", start: 0, end: 2, arm: "window.__start()", settleMs }],
	}, { framesDir: path.join(dir, name, "frames"), manifestDir: path.join(dir, name) });
	const run = await runCapture(spec);
	return { spec, ...run, encoded: encodeFilm({ input: spec.framesDir, output: path.join(dir, name, "film.mp4"), preset: "film" }) };
}

test("virtual capture (item 14): rAF, CSS animation and a timer chain all read the stepped clock, frame by frame; the film matches the manifest", { skip }, async () => {
	const run = await virtualCapture("virtual", 0);
	const [segment] = run.manifest.segments;
	assert.deepEqual([segment.kind, segment.frames, segment.film, segment.clock], ["virtual", 61, [0, 61 / 30], { kind: "linear", start: 0, rate: 1 }]);
	assert.deepEqual(run.manifest.errors, []);
	assert.ok(Math.abs(run.encoded.probe.duration - run.manifest.duration) <= 1 / 30 + 1e-6, `ffprobe ${run.encoded.probe.duration} vs manifest ${run.manifest.duration}`);
	const frame = index => path.join(run.spec.framesDir, "page", `f${String(index).padStart(5, "0")}.jpg`);
	const expectLeft = (spans, index, label) => {
		const x = (200 * index) / 30;
		for (const [row, name] of [[120, "rAF"], [220, "CSS animation"]]) {
			const span = spans[row === 120 ? 0 : 1];
			assert.ok(span, `${label}: ${name} box found`);
			assert.ok(Math.abs(span.left - x) <= 4, `${label}: ${name} box left edge ${span.left} px, expected ${x.toFixed(1)} px (frame ${index})`);
		}
	};
	const at0 = await darkSpans(frame(0), [120, 220, 320]);
	expectLeft(at0, 0, "frame 0");
	assert.equal(at0[2].right - at0[2].left + 1 >= 38 && at0[2].right - at0[2].left + 1 <= 42, true, "frame 0: the timer box is still 40 px wide");
	for (const index of [30, 45]) {
		const spans = await darkSpans(frame(index), [120, 220, 320]);
		expectLeft(spans, index, `frame ${index}`);
		const ticks = Math.floor((index * 1000) / 30 / 90);
		const width = spans[2].right - spans[2].left + 1;
		assert.ok(Math.abs(width - (40 + ticks * 10)) <= 3, `frame ${index}: timer box ${width} px wide, expected ${40 + ticks * 10} px (${ticks} ticks of 90 ms)`);
		console.log(`# virtual f${index}: rAF ${spans[0].left}, CSS ${spans[1].left}, timers ${width} px (expected ${(200 * index) / 30 | 0}, ${(200 * index) / 30 | 0}, ${40 + ticks * 10})`);
	}
});

test("virtual capture is independent of wall time: a 0 ms and a 150 ms settle give the same positions", { skip }, async () => {
	const slow = await virtualCapture("virtual-slow", 150);
	const fast = await virtualCapture("virtual", 0);
	const frame = (run, index) => path.join(run.spec.framesDir, "page", `f${String(index).padStart(5, "0")}.jpg`);
	const [a, b] = [await darkSpans(frame(slow, 40), [120, 220, 320]), await darkSpans(frame(fast, 40), [120, 220, 320])];
	assert.deepEqual(a.map(span => [span.left, span.right]), b.map(span => [span.left, span.right]), "frame 40 is identical in both runs");
});

test("CLI (r1.2): `capture.mjs` as a command, not only its module API: --virtual --cursor, and a spec file, write frames, a manifest and exit 0", { skip }, () => {
	// Round 1: every non-dry run of the CLI died on "runCapture is not defined" while the module API and --dry-run passed.
	const file = path.join(dir, "cli.html");
	fs.writeFileSync(file, VIRTUAL_PAGE);
	const run = args => spawnSync(process.execPath, [path.join(here, "capture.mjs"), ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	const virtual = run(["--url", pathToFileURL(file).href, "--virtual", "--end", "1", "--fps", "10", "--viewport", "800x600", "--cursor", "--ready-selector", "#raf", "--frames-dir", path.join(dir, "cli-v", "frames"), "--manifest-dir", path.join(dir, "cli-v")]);
	assert.equal(virtual.status, 0, `${virtual.stdout}${virtual.stderr}`);
	assert.doesNotMatch(virtual.stderr, /is not defined/);
	assert.match(virtual.stdout, /✓ captured 11 frames, film 1\.100 s/);
	const manifest = JSON.parse(fs.readFileSync(path.join(dir, "cli-v", "capture.json"), "utf8"));
	assert.deepEqual([manifest.frames, manifest.segments[0].kind, manifest.errors], [11, "virtual", []]);
	assert.equal(fs.readdirSync(path.join(dir, "cli-v", "frames", "clock")).length, 11);
	const specRun = run([SPEC, "--only", "clock", "--frames-dir", path.join(dir, "cli-s", "frames"), "--manifest-dir", path.join(dir, "cli-s")]);
	assert.equal(specRun.status, 0, `${specRun.stdout}${specRun.stderr}`);
	assert.match(specRun.stdout, /✓ captured 181 frames, film 6\.033 s/);
});

test("cursor overlay and glide (item 15): the arrow is drawn at the glide's end in the screencast, and not drawn without cursor", { skip }, async () => {
	const file = path.join(dir, "cursor.html");
	fs.writeFileSync(file, "<!doctype html><html lang=\"en\"><body style=\"margin:0;background:#eee\"><h1 style=\"font:16px sans-serif;margin:8px\">Cursor</h1><button id=\"go\" style=\"position:absolute;left:100px;top:440px;width:120px;height:60px\">Go</button></body></html>\n");
	const seen = [];
	const drive = async ({ page, glide, mark }) => {
		await glide(300, 200, 250);
		mark("arrived");
		await glide(640, 360, 300);
		await page.mouse.down();
		await page.mouse.up();
		seen.push(await page.evaluate(() => (globalThis.__vpkCursor ? [globalThis.__vpkCursor.x, globalThis.__vpkCursor.y] : null)));
		await page.waitForTimeout(250);
	};
	const base = { url: pathToFileURL(file).href, viewport: { width: 1024, height: 576 }, fps: 30, ready: { settleMs: 100 }, segments: [{ id: "move", kind: "screencast", label: "move", drive }] };
	const runs = {};
	for (const [name, cursor] of [["with", { size: 32, start: [100, 100] }], ["without", false]]) {
		const spec = normalizeSpec({ ...base, cursor }, { framesDir: path.join(dir, `cursor-${name}`, "frames"), manifestDir: path.join(dir, `cursor-${name}`) });
		runs[name] = { ...await runCapture(spec), spec };
	}
	assert.deepEqual(seen, [[640, 360], null], "the overlay tracked the glide to (640, 360); without cursor there is no overlay object");
	assert.ok(runs.with.manifest.marks.arrived > 0, "the drive's mark lands after the first glide frames");
	const count = async run => {
		const frames = fs.readdirSync(path.join(run.spec.framesDir, "move")).sort();
		const finalFrame = path.join(run.spec.framesDir, "move", frames.at(-1));
		const { chromium } = await import("@playwright/test");
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			return await page.evaluate(async jpeg => {
				const img = new Image();
				img.src = `data:image/jpeg;base64,${jpeg}`;
				await img.decode();
				const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0);
				const data = ctx.getImageData(642, 362, 28, 36).data;
				let dark = 0;
				for (let i = 0; i < data.length; i += 4) if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) dark += 1;
				return dark;
			}, fs.readFileSync(finalFrame).toString("base64"));
		} finally {
			await browser.close();
		}
	};
	const [withCursor, without] = [await count(runs.with), await count(runs.without)];
	assert.ok(withCursor >= 20, `the arrow's black outline is in the last frame: ${withCursor} dark pixels beside (640, 360)`);
	assert.equal(without, 0, "no arrow without cursor (the system cursor is never in a screencast)");
	console.log(`# cursor: ${withCursor} dark pixels with the overlay, ${without} without`);
});

test("hq (item 16): a 1920-wide CRF 22 MP4 from the same frames, a derived deliverable that is not the embedded film", { skip }, () => {
	const hq = path.join(dir, "hold", "film.hq.mp4");
	const result = encodeFilm({ input: holdRun.spec.framesDir, output: hq, preset: "hq" });
	assert.equal(result.probe.width, 1920);
	assert.equal(result.plan.preset, "hq");
	assert.ok(result.bytes > holdRun.encoded.bytes, `hq ${result.bytes} B > film ${holdRun.encoded.bytes} B`);
	console.log(`# hq: ${result.probe.width}x${result.probe.height}, ${result.bytes} B vs film ${holdRun.encoded.bytes} B`);
});
