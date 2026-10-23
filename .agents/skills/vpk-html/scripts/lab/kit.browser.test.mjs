// Opt-in Chromium suite for the vpk-lab kit (ws4a-labs.md §9 kit.browser). Run unsandboxed:
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/lab/kit.browser.test.mjs
// It builds its own film (a 6 s ffmpeg testsrc at 640 × 360), embeds it into a temp copy of the template with
// media/embed.mjs, and never depends on the shipped demo. Skips without VPK_HTML_BROWSER=1 or without ffmpeg.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { embedDocument } from "../media/embed.mjs";
import { findTool } from "../media/presets.mjs";
import { filmFromClock, ganttX } from "./runtime/core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(here, "..", "..", "assets", "templates", "motion-case-study.html");
const ffmpeg = findTool("ffmpeg");
const skip = process.env.VPK_HTML_BROWSER !== "1" ? "set VPK_HTML_BROWSER=1 (unsandboxed) to run" : !ffmpeg ? "ffmpeg is not on PATH" : false;
const FILM_DATA = { version: 1, fps: 30, duration: 0, segments: [{ id: "clock", label: "clock", kind: "hold", film: [0, 6], clock: { kind: "linear", start: 0, rate: 1 } }], chapters: [{ label: "A", film: 0 }, { label: "B", film: 2 }, { label: "C", film: 4 }] };
let dir;
let file;
let browser;

before(async () => {
	if (skip) return;
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-kit-browser-")));
	file = path.join(dir, "case.html");
	const html = fs.readFileSync(TEMPLATE, "utf8").replace(/(<script type="application\/json" data-vpk-film-data>)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}${JSON.stringify(FILM_DATA)}${close}`);
	fs.writeFileSync(file, html);
	const film = path.join(dir, "film.mp4");
	const made = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30", "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", film]);
	assert.equal(made.status, 0, String(made.stderr));
	await embedDocument({ htmlFile: file, film, cwd: dir, lite: "never", noPoster: true });
	const { chromium } = await import("@playwright/test");
	browser = await chromium.launch();
});
after(async () => {
	await browser?.close();
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

async function open({ reducedMotion = "no-preference", countRects = false, viewport = { width: 1280, height: 900 }, target = file } = {}) {
	const context = await browser.newContext({ viewport, reducedMotion });
	if (countRects) await context.addInitScript(() => {
		const original = Element.prototype.getBoundingClientRect;
		window.__rects = 0;
		Element.prototype.getBoundingClientRect = function (...args) { window.__rects += 1; return original.apply(this, args); };
	});
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
	await page.goto(`file://${target}`);
	await page.evaluate(() => window.vpkLab.ready);
	await page.waitForFunction(() => document.querySelector("[data-vpk-film-video]").readyState >= 2);
	return { page, context, errors };
}

const time = page => page.evaluate(() => document.querySelector("[data-vpk-film-video]").currentTime);
const press = async (page, selector, key) => { await page.focus(selector); await page.keyboard.press(key); await page.waitForTimeout(120); };

test("film keys: Space toggles, '.' steps one frame, → nudges 0.5 s, Home rewinds; a cue click lands and names the beat", { skip }, async () => {
	const { page, context, errors } = await open();
	const root = "[data-vpk-film]";
	await page.evaluate(() => document.querySelector("[data-vpk-film]").scrollIntoView({ block: "center", behavior: "instant" }));
	await press(page, root, " ");
	assert.equal(await page.evaluate(() => document.querySelector("[data-vpk-film-video]").paused), false, "Space plays");
	await press(page, root, " ");
	assert.equal(await page.evaluate(() => document.querySelector("[data-vpk-film-video]").paused), true, "Space pauses");
	await press(page, root, "Home");
	assert.ok((await time(page)) < 0.01);
	await press(page, root, ".");
	assert.ok(Math.abs((await time(page)) - 1 / 30) < 0.002 + 1e-3, `. → ${await time(page)}`);
	await press(page, root, "ArrowRight");
	const nudged = await time(page);
	assert.ok(Math.abs(nudged - (1 / 30 + 0.5)) < 0.01, `→ → ${nudged}`);
	await press(page, root, "Home");
	await page.click("[data-vpk-cue='cue-2']");
	await page.waitForTimeout(200);
	assert.ok(Math.abs((await time(page)) - 2) <= 0.02, `cue → ${await time(page)}`);
	assert.equal(await page.textContent("[data-vpk-beat-title]"), await page.textContent("[data-vpk-cue='cue-2'] .vpk-cue-name"));
	assert.deepEqual(errors, []);
	await context.close();
});

test("big play: a mouse click at its centre plays; from the keyboard, focus moves to the bar's Play so k and Space keep working", { skip }, async () => {
	const mouse = await open();
	await mouse.page.evaluate(() => document.querySelector("[data-vpk-film]").scrollIntoView({ block: "center", behavior: "instant" }));
	const box = await mouse.page.locator("[data-vpk-film-bigplay]").boundingBox();
	for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.5, 0.25]]) {
		await mouse.page.evaluate(() => { const video = document.querySelector("[data-vpk-film-video]"); video.pause(); document.querySelector("[data-vpk-film-bigplay]").hidden = false; });
		await mouse.page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
		await mouse.page.waitForTimeout(250);
		assert.equal(await mouse.page.evaluate(() => document.querySelector("[data-vpk-film-video]").paused), false, `a click at ${fx * 100}% / ${fy * 100}% of the big play plays`);
	}
	assert.deepEqual(mouse.errors, []);
	await mouse.context.close();
	const { page, context, errors } = await open();
	await page.evaluate(() => document.querySelector("[data-vpk-film]").scrollIntoView({ block: "center", behavior: "instant" }));
	const state = () => page.evaluate(() => ({ playing: !document.querySelector("[data-vpk-film-video]").paused, focus: document.activeElement?.hasAttribute("data-vpk-film-play") ?? false, y: scrollY }));
	await page.focus("[data-vpk-film-bigplay]");
	await page.keyboard.press("Enter");
	await page.waitForTimeout(200);
	const started = await state();
	assert.deepEqual({ playing: started.playing, focus: started.focus }, { playing: true, focus: true }, "Enter plays and focus lands on the bar's Play");
	await page.keyboard.press("k");
	await page.waitForTimeout(150);
	assert.equal((await state()).playing, false, "k pauses");
	await page.keyboard.press(" ");
	await page.waitForTimeout(150);
	assert.deepEqual(await state(), { playing: true, focus: true, y: started.y }, "Space plays again without scrolling the page");
	assert.deepEqual(errors, []);
	await context.close();
});

test("primary ink buttons keep a readable label on hover, and the hover is visible, in both themes", { skip }, async () => {
	const { page, context, errors } = await open();
	const paint = selector => page.evaluate(sel => {
		const parse = value => {
			const parts = value.match(/[\d.]+/g).map(Number);
			return value.startsWith("color(") ? parts.slice(0, 3).map(v => v * 255) : parts.slice(0, 3);
		};
		const lum = rgb => rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
		const style = getComputedStyle(document.querySelector(sel));
		const [hi, lo] = [lum(parse(style.color)), lum(parse(style.backgroundColor))].sort((x, y) => y - x);
		return { ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, fill: style.backgroundColor };
	}, selector);
	for (const theme of ["light", "dark"]) {
		await page.evaluate(name => document.documentElement.setAttribute("data-theme", name), theme);
		for (const selector of ["[data-vpk-film-play]", "[data-vpk-lab-play]"]) {
			await page.locator(selector).scrollIntoViewIfNeeded();
			await page.mouse.move(0, 0);
			await page.waitForTimeout(400);
			const rest = await paint(selector);
			await page.hover(selector);
			await page.waitForTimeout(400);
			const hover = await paint(selector);
			assert.ok(rest.ratio >= 4.5 && hover.ratio >= 4.5, `${theme} ${selector}: ${rest.ratio}:1 at rest, ${hover.ratio}:1 on hover`);
			assert.notEqual(hover.fill, rest.fill, `${theme} ${selector}: the hover fill differs from rest`);
		}
	}
	assert.deepEqual(errors, []);
	await context.close();
});

test("Gantt: a click seeks to filmFromClock(t) within a frame; ↑/→ advance; ↑ leaves docnav alone; the head moves while playing", { skip }, async () => {
	const { page, context, errors } = await open();
	const map = await page.evaluate(() => {
		const g = document.querySelector("[data-vpk-gantt]");
		const box = g.querySelector("svg").getBoundingClientRect();
		return { t0: +g.dataset.t0, t1: +g.dataset.t1, x0: +g.dataset.x0, x1: +g.dataset.x1, width: g.querySelector("svg").viewBox.baseVal.width, left: box.left, top: box.top, w: box.width, h: box.height };
	});
	await page.evaluate(() => document.querySelector("[data-vpk-gantt]").scrollIntoView({ block: "center", behavior: "instant" }));
	const box = await page.locator("[data-vpk-gantt] svg").boundingBox();
	const t = 3.5;
	await page.mouse.click(box.x + (ganttX(t, map) / map.width) * box.width, box.y + box.height / 2);
	await page.waitForTimeout(300);
	const expected = filmFromClock(FILM_DATA, "clock", t);
	assert.ok(Math.abs((await time(page)) - expected) <= 1 / 30 + 0.002, `click → ${await time(page)} (expected ${expected})`);
	await page.evaluate(() => document.querySelector("[data-vpk-gantt]").scrollIntoView({ block: "center", behavior: "instant" }));
	await page.waitForTimeout(300);
	const before = await page.evaluate(() => ({ y: scrollY, active: document.querySelector(".is-docnav-active")?.id ?? null }));
	const start = await time(page);
	await press(page, "[data-vpk-gantt]", "ArrowUp");
	await page.waitForTimeout(400);
	assert.ok(Math.abs((await time(page)) - (start + 0.1)) < 0.01, `↑ → ${await time(page)}`);
	assert.deepEqual(await page.evaluate(() => ({ y: scrollY, active: document.querySelector(".is-docnav-active")?.id ?? null })), before, "docnav did not move");
	await press(page, "[data-vpk-gantt]", "ArrowRight");
	assert.ok(Math.abs((await time(page)) - (start + 0.2)) < 0.01, `→ → ${await time(page)}`);
	await press(page, "[data-vpk-gantt]", "Home");
	const x0 = await page.getAttribute("[data-vpk-gantt-head]", "x1");
	await page.evaluate(() => document.querySelector("[data-vpk-film-video]").play());
	await page.waitForTimeout(700);
	await page.evaluate(() => document.querySelector("[data-vpk-film-video]").pause());
	assert.notEqual(await page.getAttribute("[data-vpk-gantt-head]", "x1"), x0, "the head follows playback");
	assert.deepEqual(errors, []);
	await context.close();
});

test("P4 item 16: a Gantt click within 6 px of a cue or a mark seeks to that exact time, on either side, and the cue becomes current", { skip }, async () => {
	const { page, context, errors } = await open();
	const info = await page.evaluate(() => {
		const g = document.querySelector("[data-vpk-gantt]");
		return {
			t0: +g.dataset.t0, t1: +g.dataset.t1, x0: +g.dataset.x0, x1: +g.dataset.x1, width: g.querySelector("svg").viewBox.baseVal.width,
			marks: [...g.querySelectorAll("[data-vpk-gantt-mark]")].map(node => +node.getAttribute("data-vpk-gantt-mark")),
			cues: [...document.querySelectorAll("[data-vpk-cue]")].map(node => ({ id: node.getAttribute("data-vpk-cue"), film: +node.getAttribute("data-film") })),
		};
	});
	assert.ok(info.marks.length >= 2 && info.cues.length >= 3, `marks ${info.marks.length}, cues ${info.cues.length}`);
	const clickNear = async (t, offsetPx) => {
		await page.evaluate(() => document.querySelector("[data-vpk-gantt]").scrollIntoView({ block: "center", behavior: "instant" }));
		await page.waitForTimeout(150);
		const box = await page.locator("[data-vpk-gantt] svg").boundingBox();
		await page.mouse.click(box.x + (ganttX(t, info) / info.width) * box.width + offsetPx, box.y + box.height / 2);
		await page.waitForTimeout(250);
	};
	for (const offset of [-4, 4]) {
		for (const cue of info.cues) {
			await clickNear(cue.film, offset);
			assert.ok(Math.abs((await time(page)) - cue.film) <= 0.0045, `${cue.id} at ${offset} px → ${await time(page)}, expected ${cue.film}`);
			assert.equal(await page.evaluate(() => document.querySelector(".vpk-cue.is-current")?.getAttribute("data-vpk-cue")), cue.id, `${cue.id} at ${offset} px names that cue`);
		}
		for (const t of info.marks) {
			await clickNear(t, offset);
			const expected = filmFromClock(FILM_DATA, "clock", t);
			assert.ok(Math.abs((await time(page)) - expected) <= 0.0045, `mark ${t} at ${offset} px → ${await time(page)}, expected ${expected}`);
			assert.equal(await page.getAttribute("[data-vpk-gantt]", "aria-valuenow"), t.toFixed(2), `mark ${t}: the Gantt reads the mark's own time`);
		}
	}
	await clickNear(1, 0);
	assert.ok(Math.abs((await time(page)) - 1) <= 0.034, `a click far from any cue or mark stays a plain seek (${await time(page)})`);
	// P4 item 17: 40 → presses from the start read 4.00 s on the slider, not 4.04 s (the film's +1 ms nudge).
	await press(page, "[data-vpk-gantt]", "Home");
	for (let index = 0; index < 40; index += 1) await page.keyboard.press("ArrowRight");
	await page.waitForTimeout(150);
	assert.equal(await page.getAttribute("[data-vpk-gantt]", "aria-valuenow"), "4.00");
	assert.equal(await page.getAttribute("[data-vpk-gantt]", "aria-valuetext"), "4.00 s");
	assert.deepEqual(errors, []);
	await context.close();
});

test("K26: clicks and keys inside a WS1 review host (open shadow root) placed in the film and in the Gantt reach the comment field, never the film", { skip }, async () => {
	const { page, context, errors } = await open();
	await page.evaluate(() => {
		for (const [selector, name] of [["[data-vpk-film]", "film"], ["[data-vpk-gantt]", "gantt"]]) {
			const host = document.createElement("div");
			host.setAttribute("data-vpk-review-ui", "");
			host.setAttribute("data-host", name);
			const field = document.createElement("textarea");
			field.setAttribute("aria-label", `Comment (${name})`);
			host.attachShadow({ mode: "open" }).append(field);
			document.querySelector(selector).append(host);
		}
	});
	const state = () => page.evaluate(() => { const video = document.querySelector("[data-vpk-film-video]"); return { paused: video.paused, t: video.currentTime }; });
	const start = await state();
	for (const name of ["film", "gantt"]) {
		const field = page.locator(`[data-host="${name}"] textarea`);
		await field.scrollIntoViewIfNeeded();
		await field.click();
		for (const key of ["k", " ", "ArrowRight", "End", "3"]) await page.keyboard.press(key);
		await page.waitForTimeout(250);
		assert.equal(await field.inputValue(), "k 3", `${name}: the keys were typed into the comment field`);
		assert.deepEqual(await state(), start, `${name}: the film neither played nor seeked`);
	}
	assert.deepEqual(errors, []);
	await context.close();
});

test("isolation: clicking kit canvases, the video and the Gantt never opens the lightbox; no zoomable inside kit roots; idle enhancer stays quiet", { skip }, async () => {
	const { page, context, errors } = await open({ countRects: true });
	for (const selector of ["[data-vpk-lab-canvas]", "canvas.vpk-cue-thumb", "[data-vpk-gantt] svg"]) {
		await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), selector);
		await page.click(selector, { force: true });
	}
	await page.evaluate(() => document.querySelector("[data-vpk-film]").scrollIntoView({ block: "center", behavior: "instant" }));
	await page.evaluate(() => document.querySelector("[data-vpk-film-video]").pause());
	await page.locator("[data-vpk-film-video]").dispatchEvent("click");
	await page.evaluate(() => document.querySelector("[data-vpk-film-video]").pause());
	await page.waitForTimeout(1500);
	assert.equal(await page.locator(".vpkh-lightbox").count(), 0);
	assert.equal(await page.evaluate(() => document.querySelectorAll(":is([data-vpk-film], [data-vpk-cues], [data-vpk-gantt], [data-vpk-lab], [data-vpk-layers], [data-vpk-flip-deck]) .vpkh-zoomable").length), 0);
	await page.evaluate(() => { window.__rects = 0; document.querySelector("[data-vpk-film-video]").play(); });
	await page.waitForTimeout(2000);
	const rects = await page.evaluate(() => { document.querySelector("[data-vpk-film-video]").pause(); return window.__rects; });
	assert.ok(rects <= 50, `getBoundingClientRect calls in 2 s of playback: ${rects}`);
	console.log(`# enhancer cost: ${rects} getBoundingClientRect calls in 2 s of film playback`);
	assert.deepEqual(errors, []);
	await context.close();
});

test("reduced motion lands the lab at its pose and the loop sleeps; off screen the lab stops ticking", { skip }, async () => {
	const calm = await open({ reducedMotion: "reduce" });
	await calm.page.evaluate(() => document.querySelector("[data-vpk-lab]").scrollIntoView({ block: "center", behavior: "instant" }));
	await calm.page.click("[data-vpk-lab-play]");
	await calm.page.waitForTimeout(200);
	assert.equal(await calm.page.textContent("[data-vpk-out='t']"), "1.95 s");
	assert.equal(await calm.page.evaluate(() => window.vpkFrameLoop.stats().awake), 0);
	await calm.context.close();
	const { page, context } = await open();
	await page.evaluate(() => document.querySelector("[data-vpk-lab]").scrollIntoView({ block: "center", behavior: "instant" }));
	await page.click("[data-vpk-lab-reset]");
	await page.evaluate(() => { const input = document.querySelector("[data-vpk-param='t']"); input.value = "0"; input.dispatchEvent(new Event("input", { bubbles: true })); });
	await page.click("[data-vpk-lab-play]");
	await page.waitForTimeout(150);
	assert.equal(await page.evaluate(() => window.vpkFrameLoop.stats().visible), 1);
	await page.evaluate(() => scrollTo(0, 0));
	await page.waitForTimeout(250);
	const frames = await page.evaluate(() => window.vpkFrameLoop.stats().frames);
	await page.waitForTimeout(300);
	assert.deepEqual(await page.evaluate(() => window.vpkFrameLoop.stats()), { boards: 1, visible: 0, awake: 1, frames }, "off screen: the lab is awake but not ticking (the film follows rVFC, not the loop)");
	await context.close();
});

test("theme and decision 2: a canvas pixel follows the theme; lab canvases and the Gantt stay achromatic in both themes", { skip }, async () => {
	const { page, context, errors } = await open();
	const sample = async () => page.evaluate(async () => {
		const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
		const tokens = Object.values(window.vpkLab.tokens).filter(value => /^#[0-9a-f]{8}$/.test(value)).map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
		const limit = Math.max(...tokens.map(chroma)) + 4;
		const grid = (ctx, w, h) => {
			let worst = 0;
			for (let y = 0; y < 24; y += 1) for (let x = 0; x < 24; x += 1) {
				const [r, g, b, a] = ctx.getImageData(Math.floor(((x + 0.5) * w) / 24), Math.floor(((y + 0.5) * h) / 24), 1, 1).data;
				if (a > 0) worst = Math.max(worst, chroma([r, g, b]));
			}
			return worst;
		};
		const canvas = document.querySelector("[data-vpk-lab-canvas]");
		const lab = grid(canvas.getContext("2d"), canvas.width, canvas.height);
		const svg = document.querySelector("[data-vpk-gantt] svg");
		const clone = svg.cloneNode(true);
		const box = svg.getBoundingClientRect();
		const root = getComputedStyle(document.documentElement);
		clone.setAttribute("width", box.width);
		clone.setAttribute("height", box.height);
		clone.querySelectorAll("[fill^='var('], [stroke^='var(']").forEach(node => {
			for (const name of ["fill", "stroke"]) {
				const value = node.getAttribute(name);
				const token = value && /^var\((--[\w-]+)\)$/.exec(value);
				if (token) node.setAttribute(name, root.getPropertyValue(token[1]).trim());
			}
		});
		const img = new Image();
		img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
		await img.decode();
		const raster = Object.assign(document.createElement("canvas"), { width: Math.round(box.width), height: Math.round(box.height) });
		const rctx = raster.getContext("2d", { willReadFrequently: true });
		rctx.drawImage(img, 0, 0);
		return { lab, gantt: grid(rctx, raster.width, raster.height), limit, corner: [...canvas.getContext("2d").getImageData(4, 4, 1, 1).data].join(",") };
	});
	await page.evaluate(() => document.querySelector("[data-vpk-lab]").scrollIntoView({ block: "center", behavior: "instant" }));
	const light = await sample();
	await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
	await page.waitForTimeout(300);
	const dark = await sample();
	for (const [name, result] of [["light", light], ["dark", dark]]) {
		assert.ok(result.lab <= result.limit, `${name} lab chroma ${result.lab} ≤ ${result.limit}`);
		assert.ok(result.gantt <= result.limit, `${name} Gantt chroma ${result.gantt} ≤ ${result.limit}`);
	}
	assert.notEqual(dark.corner, light.corner, "the canvas redrew for the dark theme");
	assert.deepEqual(errors, []);
	await context.close();
});

test("thumbnails are drawn at runtime; a saved copy of the live DOM, reopened with goto, re-initialises once, plays and its chapters seek; print hides the controls", { skip }, async () => {
	const { page, context, errors } = await open();
	await page.evaluate(() => document.querySelector("[data-vpk-cues]").scrollIntoView({ block: "center", behavior: "instant" }));
	await page.waitForFunction(() => [...document.querySelectorAll("canvas.vpk-cue-thumb")].every(canvas => {
		const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
		let min = 255, max = 0;
		for (let i = 0; i < data.length; i += 16) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); }
		return max - min > 20;
	}), null, { timeout: 5000 });
	const counts = () => page.evaluate(() => ({
		chapters: document.querySelectorAll("[data-vpk-film-chapters] button").length,
		ticks: document.querySelectorAll("[data-vpk-film-ticks] > span").length,
		cueT: document.querySelectorAll(".vpk-cue-t > span").length,
		readout: document.querySelectorAll("[data-vpk-readout] > span").length,
	}));
	const first = await counts();
	assert.deepEqual(first, { chapters: 3, ticks: 3, cueT: 3, readout: 3 });
	// The live DOM (generated chapters, ticks, spans and drawn-thumb state included) saved as a file and opened fresh.
	const saved = path.join(dir, "case.saved.html");
	fs.writeFileSync(saved, await page.content());
	await page.goto(`file://${saved}`);
	assert.equal(page.url(), `file://${saved}`);
	await page.evaluate(() => window.vpkLab.ready);
	await page.waitForFunction(() => document.querySelector("[data-vpk-film-video]").readyState >= 2);
	assert.deepEqual(await counts(), first, "re-init on the reopened copy duplicates nothing");
	const video = "[data-vpk-film-video]";
	await page.evaluate(() => document.querySelector("[data-vpk-film]").scrollIntoView({ block: "center", behavior: "instant" }));
	await page.click("[data-vpk-film-play]");
	await page.waitForFunction(sel => { const v = document.querySelector(sel); return !v.paused && v.currentTime > 0.3; }, video, { timeout: 5000 });
	await page.click("[data-vpk-film-play]");
	await page.waitForFunction(sel => document.querySelector(sel).paused, video);
	const chapters = page.locator("[data-vpk-film-chapters] button");
	assert.equal(await chapters.count(), 3);
	for (const index of [2, 1, 0]) {
		await chapters.nth(index).click();
		await page.waitForFunction(([sel, at]) => Math.abs(document.querySelector(sel).currentTime - at) < 0.05, [video, FILM_DATA.chapters[index].film], { timeout: 3000 });
	}
	assert.equal(await page.evaluate(sel => document.querySelector(sel).paused, video), true, "chapters seek without playing");
	await page.emulateMedia({ media: "print" });
	for (const selector of [".vpk-film-bar", ".vpk-lab-foot .vpk-ctl-row", ".vpk-filters"]) {
		assert.equal(await page.evaluate(sel => getComputedStyle(document.querySelector(sel)).display, selector), "none", selector);
	}
	assert.deepEqual(errors, []);
	await context.close();
});

/** Per cue canvas: true when it holds a film frame (not one flat fill). With all = true, whether every one does. */
const THUMBS_DRAWN = all => {
	const drawn = [...document.querySelectorAll("canvas.vpk-cue-thumb")].map(canvas => {
		const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
		let min = 255, max = 0;
		for (let i = 0; i < data.length; i += 16) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); }
		return max - min > 20;
	});
	return all ? drawn.every(Boolean) : drawn;
};

test("print and PDF: on an unscrolled page, awaiting vpkLab.ready draws the thumbnails well inside the 4 s cap; print media starts them and hides any still pending", { skip }, async () => {
	for (const viewport of [{ width: 1280, height: 800 }, { width: 794, height: 1123 }]) {
		const context = await browser.newContext({ viewport });
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		const started = Date.now();
		await page.goto(`file://${file}`, { waitUntil: "domcontentloaded" });
		const below = await page.evaluate(() => document.querySelector("[data-vpk-cues]").getBoundingClientRect().top - innerHeight);
		assert.ok(below > 200, `the cue list starts ${below} px below the fold, outside the observer margin`);
		await page.evaluate(() => window.vpkLab.ready);
		const ms = Date.now() - started;
		assert.ok(ms < 2500, `${viewport.width}: ready after ${ms} ms`);
		assert.deepEqual(await page.evaluate(THUMBS_DRAWN, false), [true, true, true], `${viewport.width}: drawn at ready`);
		assert.equal(await page.evaluate(() => document.querySelectorAll(".vpk-cue-thumb.is-pending").length), 0);
		// The print-media trigger on its own: this page never reaches its idle start.
		const print = await context.newPage();
		await print.addInitScript(() => { window.requestIdleCallback = () => 0; });
		await print.goto(`file://${file}`);
		await print.waitForFunction(() => window.vpkLab.inspect().inited);
		await print.waitForTimeout(1200);
		assert.equal(await print.evaluate(() => document.querySelectorAll("canvas.vpk-cue-thumb.is-pending").length), 3, "waiting while nothing asks");
		const visibility = () => print.evaluate(() => getComputedStyle(document.querySelector("canvas.vpk-cue-thumb.is-pending") ?? document.querySelector("canvas.vpk-cue-thumb")).visibility);
		await print.emulateMedia({ media: "print" });
		await print.waitForFunction(THUMBS_DRAWN, true, { timeout: 5000 });
		assert.equal(await visibility(), "visible", "drawn thumbnails print");
		await print.evaluate(() => document.querySelector("canvas.vpk-cue-thumb").classList.add("is-pending"));
		assert.equal(await visibility(), "hidden", "a pending thumbnail prints as nothing, not a grey box");
		await print.emulateMedia({ media: "screen" });
		assert.equal(await visibility(), "visible");
		assert.deepEqual(errors, []);
		await context.close();
	}
});

/** Image XObjects of `width` × `height` in a PDF buffer (Chromium writes each painted canvas as one). */
function pdfImages(buffer, width, height) {
	const text = buffer.toString("latin1");
	return [...text.matchAll(/\d+ 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g)].filter(([, dict]) => /\/Subtype\s*\/Image/.test(dict)
		&& Number(/\/Width\s+(\d+)/.exec(dict)?.[1]) === width && Number(/\/Height\s+(\d+)/.exec(dict)?.[1]) === height).length;
}

test("a reader's own print: page.pdf() on an unscrolled page 1.5 s after init, without reading vpkLab.ready, carries every cue thumbnail", { skip }, async () => {
	for (const reducedMotion of ["reduce", "no-preference"]) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion });
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		await page.goto(`file://${file}`, { waitUntil: "load" });
		await page.waitForFunction(() => window.vpkLab?.inspect?.().inited);
		const below = await page.evaluate(() => document.querySelector("[data-vpk-cues]").getBoundingClientRect().top - innerHeight);
		assert.ok(below > 200, `the cue list starts ${below} px below the fold, outside the observer margin`);
		await page.waitForTimeout(1500);
		const pdf = await page.pdf({ format: "A4", printBackground: true });
		assert.equal(pdfImages(pdf, 240, 135), 3, `${reducedMotion}: one 240 × 135 image per cue thumbnail in the printed PDF`);
		assert.deepEqual(await page.evaluate(THUMBS_DRAWN, false), [true, true, true]);
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("print: every discard card shows its idea on top and why it lost beneath (the shell drops transforms in print); the screen deck still flips", { skip }, async () => {
	const { page, context, errors } = await open({ reducedMotion: "reduce" });
	/** Per card: which face's text is the top element at the centre of the idea title and of the reason. */
	const faces = () => page.evaluate(() => [...document.querySelectorAll("[data-vpk-flip]")].map(card => {
		const hit = selector => {
			const target = card.querySelector(selector);
			target.scrollIntoView({ block: "center", behavior: "instant" });
			const rect = target.getBoundingClientRect();
			const top = document.elementFromPoint(rect.left + Math.min(rect.width / 2, 40), rect.top + rect.height / 2);
			return top?.closest(".vpk-flip-what, .vpk-flip-why")?.className ?? top?.className ?? null;
		};
		return { pressed: card.getAttribute("aria-pressed"), what: hit(".vpk-flip-what"), why: hit(".vpk-flip-why") };
	}));
	const cards = await page.locator("[data-vpk-flip]").count();
	assert.ok(cards >= 2, `${cards} cards`);
	const screen = await faces();
	assert.ok(screen.every(card => card.pressed === "false" && card.what === "vpk-flip-what" && card.why !== "vpk-flip-why"), `screen, unflipped: the idea faces the reader ${JSON.stringify(screen)}`);
	await page.locator("[data-vpk-flip]").first().click();
	const flipped = (await faces())[0];
	assert.ok(flipped.pressed === "true" && flipped.what !== "vpk-flip-what" && flipped.why === "vpk-flip-why", `screen, flipped: the reason faces the reader ${JSON.stringify(flipped)}`);
	// Hit testing in a 3D context reads the last painted frame, so let two frames paint after each media switch.
	const painted = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
	await painted();
	for (const card of await faces()) assert.deepEqual({ what: card.what, why: card.why }, { what: "vpk-flip-what", why: "vpk-flip-why" }, `print (aria-pressed=${card.pressed}): both faces print, neither covers the other`);
	const order = await page.evaluate(() => [...document.querySelectorAll("[data-vpk-flip]")].map(card => card.querySelector(".vpk-flip-why").getBoundingClientRect().top >= card.querySelector(".vpk-flip-what").getBoundingClientRect().bottom));
	assert.ok(order.every(Boolean), "the reason sits under the idea");
	assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".vpk-flip-hint")).display), "none", "no 'Turn over' hint on paper");
	await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
	await painted();
	const back = await faces();
	assert.ok(back[0].why === "vpk-flip-why" && back[0].what !== "vpk-flip-what", `back on screen, the flipped card still shows its reason ${JSON.stringify(back[0])}`);
	assert.ok(back.slice(1).every(card => card.what === "vpk-flip-what" && card.why !== "vpk-flip-why"), "and the unflipped cards their idea");
	assert.deepEqual(errors, []);
	await context.close();
});

test("Space and k on the focused scrub and the focused Gantt play and pause the film without scrolling the page", { skip }, async () => {
	const { page, context, errors } = await open({ viewport: { width: 1280, height: 800 } });
	const state = () => page.evaluate(() => ({ playing: !document.querySelector("[data-vpk-film-video]").paused, y: Math.round(scrollY) }));
	for (const selector of ["[data-vpk-film-scrub]", "[data-vpk-gantt]"]) {
		await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: "center", behavior: "instant" }), selector);
		await page.focus(selector);
		await page.waitForTimeout(150);
		const before = await state();
		assert.equal(before.playing, false);
		await page.keyboard.press(" ");
		await page.waitForTimeout(250);
		assert.deepEqual(await state(), { playing: true, y: before.y }, `Space on ${selector} plays and the page stays put`);
		await page.keyboard.press("k");
		await page.waitForTimeout(150);
		assert.deepEqual(await state(), { playing: false, y: before.y }, `k on ${selector} pauses`);
	}
	await page.focus("[data-vpk-film-scrub]");
	await page.keyboard.press("ArrowRight");
	await page.waitForTimeout(150);
	assert.ok((await time(page)) > 0, "→ on the scrub still moves the film natively");
	assert.deepEqual(errors, []);
	await context.close();
});

test("at rest every case-study section is opaque (no part-faded scroll entrance), so text keeps its contrast", { skip }, async () => {
	for (const viewport of [{ width: 1280, height: 800 }, { width: 1280, height: 900 }, { width: 390, height: 844 }]) {
		const { page, context, errors } = await open({ viewport });
		for (const y of [0, 400, 1200]) {
			await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), y);
			await page.waitForTimeout(400);
			const faded = await page.evaluate(() => [...document.querySelectorAll("main.essay-page section")].map(section => `${section.id || section.className} ${getComputedStyle(section).opacity}`).filter(entry => !entry.endsWith(" 1")));
			assert.deepEqual(faded, [], `${viewport.width}x${viewport.height} at scrollY ${y}`);
		}
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("phones (390 px): the Gantt scrolls sideways at ≥ 9 px labels; the lab canvas grows to 200 px tall and sizes its text through api.px", { skip }, async () => {
	const { page, context, errors } = await open({ viewport: { width: 390, height: 844 } });
	const info = await page.evaluate(() => {
		const gantt = document.querySelector("[data-vpk-gantt]");
		const svg = gantt.querySelector("svg");
		const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
		const canvas = document.querySelector("[data-vpk-lab-canvas]");
		const box = canvas.getBoundingClientRect();
		const api = window.vpkLab.lab("easing", { draw() {} });
		return {
			minLabelPx: Math.min(...[...svg.querySelectorAll("text")].map(text => Number(text.getAttribute("font-size")) * scale)),
			scrolls: gantt.scrollWidth > gantt.clientWidth, pageWidth: document.documentElement.scrollWidth,
			canvasHeight: Math.round(box.height), labelPx: (api.px(12) * box.width) / api.w,
		};
	});
	assert.ok(info.minLabelPx >= 9, `Gantt labels at ${info.minLabelPx} px`);
	assert.deepEqual([info.scrolls, info.pageWidth], [true, 390], "the Gantt scrolls inside itself, the page does not");
	assert.ok(Math.abs(info.canvasHeight - 200) <= 1, `lab canvas ${info.canvasHeight} px tall`);
	assert.ok(Math.abs(info.labelPx - 12) < 0.01, `lab text renders at ${info.labelPx} px`);
	await page.evaluate(() => document.querySelector("[data-vpk-gantt]").scrollIntoView({ block: "center", behavior: "instant" }));
	const box = await page.locator("[data-vpk-gantt] svg").boundingBox();
	await page.mouse.click(box.x + 200, box.y + box.height / 2);
	await page.waitForTimeout(250);
	assert.ok((await time(page)) > 0, "a tap on the scrolled Gantt still seeks");
	assert.deepEqual(errors, []);
	await context.close();
});

test("the docnav presenter popup (p) opens without console errors", { skip }, async () => {
	const { page, context, errors } = await open({ viewport: { width: 1280, height: 800 } });
	const popupErrors = [];
	context.on("page", popup => {
		popup.on("console", message => { if (message.type() === "error") popupErrors.push(message.text()); });
		popup.on("pageerror", error => popupErrors.push(error.message));
	});
	const opened = context.waitForEvent("page", { timeout: 5000 });
	await page.keyboard.press("p");
	const popup = await opened;
	await popup.waitForLoadState();
	await popup.waitForFunction(() => document.body.classList.contains("vpk-presenter-window"));
	await popup.waitForTimeout(800);
	assert.deepEqual({ main: errors, popup: popupErrors }, { main: [], popup: [] });
	await context.close();
});

/** A copy of the template whose film data names a poster time, embedded either with the baked poster or for the runtime seek. */
async function posterCopy(name, options) {
	const target = path.join(dir, name);
	const authored = { ...FILM_DATA, posterTime: 3.3 };
	fs.writeFileSync(target, fs.readFileSync(TEMPLATE, "utf8").replace(/(<script type="application\/json" data-vpk-film-data>)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}${JSON.stringify(authored)}${close}`));
	await embedDocument({ htmlFile: target, film: path.join(dir, "film.mp4"), cwd: dir, lite: "never", ...options });
	return target;
}

const posterReading = page => page.evaluate(() => {
	const scrub = document.querySelector("[data-vpk-film-scrub]");
	const video = document.querySelector("[data-vpk-film-video]");
	const data = JSON.parse(document.querySelector("[data-vpk-film-data]").textContent);
	return {
		posterTime: data.posterTime, hasPoster: Boolean(video.getAttribute("poster")), currentTime: video.currentTime,
		duration: Number.isFinite(video.duration) ? video.duration : data.duration,
		scrub: Number(scrub.value), min: Number(scrub.min), max: Number(scrub.max),
		readout: Number(document.querySelector("[data-vpk-film-time] > b").textContent),
		gantt: Number(document.querySelector("[data-vpk-gantt]").getAttribute("aria-valuenow")),
	};
});

/** r1.1 (J5 in a real browser): the poster time, the readout, the Gantt head AND the scrub's thumb name one time. */
function assertPosterAgrees(reading, label) {
	const frame = 1 / 30;
	assert.equal(reading.posterTime, 3.3, `${label}: fixture`);
	assert.ok(Math.abs(reading.scrub - reading.posterTime) <= frame + 1e-6, `${label}: scrub ${reading.scrub} (max ${reading.max}) vs poster ${reading.posterTime}`);
	assert.ok(reading.max >= reading.duration - 0.01, `${label}: scrub max ${reading.max} is the film length ${reading.duration}, not the authored 1`);
	const thumb = (reading.scrub - reading.min) / (reading.max - reading.min);
	assert.ok(Math.abs(thumb - reading.posterTime / reading.duration) < 0.01, `${label}: the thumb sits at ${(thumb * 100).toFixed(1)} %, the poster frame at ${((reading.posterTime / reading.duration) * 100).toFixed(1)} %`);
	assert.ok(Math.abs(reading.readout - reading.posterTime) < 0.006, `${label}: readout ${reading.readout}`);
	assert.ok(Math.abs(reading.gantt - reading.posterTime) < 0.006, `${label}: Gantt head ${reading.gantt}`);
}

test("J5 (r1.1): a baked poster of film 3.30 s, or the runtime seek to it: scrub thumb, readout and Gantt head agree at load and 2.5 s later, light and dark, 1280 and 390 px", { skip }, async () => {
	const baked = await posterCopy("poster-baked.html", { posterTime: 3.3 });
	const seek = await posterCopy("poster-seek.html", { noPoster: true });
	for (const [name, target] of [["baked poster", baked], ["runtime seek", seek]]) {
		for (const [viewport, theme, reducedMotion] of [[{ width: 1280, height: 900 }, "light", "no-preference"], [{ width: 390, height: 844 }, "dark", "reduce"]]) {
			const label = `${name}, ${viewport.width} px, ${theme}`;
			const { page, context, errors } = await open({ viewport, reducedMotion, target });
			await page.evaluate(value => document.documentElement.setAttribute("data-theme", value), theme);
			await page.waitForFunction(() => {
				const video = document.querySelector("[data-vpk-film-video]");
				return !video.seeking && (video.getAttribute("poster") || Math.abs(video.currentTime - 3.3) < 0.05);
			});
			const first = await posterReading(page);
			assert.equal(first.hasPoster, name === "baked poster", `${label}: fixture`);
			assertPosterAgrees(first, `${label}, at load`);
			if (viewport.width === 1280 && name === "baked poster") {
				await page.waitForTimeout(2500);
				assertPosterAgrees(await posterReading(page), `${label}, 2.5 s later`);
			}
			assert.deepEqual(errors, [], label);
			await context.close();
		}
	}
});
