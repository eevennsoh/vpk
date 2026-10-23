// vpk-html media · capture-run: the browser half of capture.mjs (references/media-pipeline.md, Capture). Hold, virtual and
// screencast segments become JPEG frames, then frames.ffconcat and capture.json are written. Split from capture.mjs, which
// keeps the spec, the manifest and the CLI and re-exports runCapture, runHook and checkHoldHook. Playwright is imported
// only inside runCapture(). The functions use capture.mjs only when called, so the import cycle between the two is harmless.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CaptureSpecError, DEFAULT_HOLD_EXPR, buildCaptureManifest, holdExpression, holdFrameTimes } from "./capture.mjs";
import { installCaptureScripts, makeGlide, stepVirtual } from "./capture-clock.mjs";
import { frameFileName, screencastDurations, screencastStopTime, writeFfconcat } from "./ffconcat.mjs";

/** Run a hold/arm/release hook: an async (page, t) function, or an expression string evaluated with t. */
export async function runHook(page, hook, t) {
	return typeof hook === "function" ? hook(page, t) : page.evaluate(holdExpression(hook, t ?? null));
}

/** The default hold needs the page's window.__vpkRehearsal.hold (C8): without it, name the ways out, not a TypeError. */
export async function checkHoldHook(page, segment, url) {
	if (segment.hold !== DEFAULT_HOLD_EXPR || await page.evaluate(() => typeof globalThis.__vpkRehearsal?.hold === "function")) return;
	throw new CaptureSpecError(`capture: hold segment "${segment.id}" steps window.__vpkRehearsal.hold(t), which ${url} does not define. Pass --hold "<expr with t>" (a spec segment's hold) to drive the page's own clock, or --virtual to step its rAF and timers, or --live <s> (or --drive <module.mjs>) to record it in real time`);
}

async function waitReady(page, ready) {
	if (typeof ready === "function") return ready(page);
	if (ready.selector) await page.waitForSelector(ready.selector, { timeout: ready.timeoutMs });
	await page.evaluate(() => document.fonts?.ready);
	if (ready.settleMs) await page.waitForTimeout(ready.settleMs);
}

const doubleFrame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const shoot = (page, dir, index, spec) => page.screenshot({ path: path.join(dir, frameFileName(index)), type: "jpeg", quality: spec.jpegQuality });

async function captureHold(page, segment, dir, spec) {
	if (segment.arm) await runHook(page, segment.arm, segment.start);
	await checkHoldHook(page, segment, spec.url);
	const times = holdFrameTimes(segment, spec.fps);
	for (const [index, t] of times.entries()) {
		await runHook(page, segment.hold, t);
		await doubleFrame(page);
		if (segment.settleMs) await page.waitForTimeout(segment.settleMs);
		await shoot(page, dir, index, spec);
	}
	if (segment.release) await runHook(page, segment.release, null);
	return { id: segment.id, frames: times.length, times };
}

/** Virtual segment: arm the page's virtual clock, run `start` seconds unrecorded, then one frame per 1/fps of page time. */
async function captureVirtual(page, segment, dir, spec) {
	if (!(await page.evaluate(() => Boolean(globalThis.__vpkVirtual)))) throw new CaptureSpecError(`capture: virtual segment "${segment.id}": the page has no virtual clock (it was loaded without the capture init script)`);
	const delta = 1000 / spec.fps;
	await page.evaluate(() => globalThis.__vpkVirtual.arm());
	if (segment.arm) await runHook(page, segment.arm, segment.start);
	await page.evaluate(() => globalThis.__vpkVirtual.sync());
	for (let step = 0; step < Math.round(segment.start * spec.fps); step += 1) await stepVirtual(page, delta);
	for (let index = 0; index < segment.frames; index += 1) {
		if (index > 0) await stepVirtual(page, delta);
		if (segment.settleMs) await page.waitForTimeout(segment.settleMs);
		await shoot(page, dir, index, spec);
	}
	if (segment.release) await runHook(page, segment.release, null);
	await page.evaluate(() => globalThis.__vpkVirtual.disarm());
	return { id: segment.id, frames: segment.frames };
}

async function captureScreencast(page, segment, dir, spec) {
	const cdp = await page.context().newCDPSession(page);
	const stamps = [];
	const received = [];
	const writes = [];
	const marks = [];
	cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
		const index = stamps.length;
		stamps.push(metadata.timestamp);
		received.push(Date.now() / 1000);
		writes.push(fs.promises.writeFile(path.join(dir, frameFileName(index)), Buffer.from(data, "base64")));
		cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
	});
	const scale = spec.deviceScaleFactor;
	await cdp.send("Page.startScreencast", { format: "jpeg", quality: spec.jpegQuality, maxWidth: Math.round(spec.viewport.width * scale), maxHeight: Math.round(spec.viewport.height * scale), everyNthFrame: 1 });
	const mark = name => marks.push({ name, frame: stamps.length });
	if (segment.drive) {
		const drive = typeof segment.drive === "function" ? segment.drive : (await import(pathToFileURL(segment.drive).href)).default;
		await drive({ page, mark, spec, segment, glide: makeGlide(page, { start: spec.cursor ? spec.cursor.start : [spec.viewport.width / 2, spec.viewport.height / 2] }) });
	} else await page.waitForTimeout(segment.live * 1000);
	await doubleFrame(page);
	const stoppedAt = Date.now() / 1000;
	await cdp.send("Page.stopScreencast");
	await Promise.all(writes);
	await cdp.detach().catch(() => {});
	if (!stamps.length) throw new CaptureSpecError(`capture: screencast "${segment.id}" produced no frames (the page never repainted)`);
	const trim = Math.min(segment.trimStartFrames, stamps.length - 1);
	return {
		id: segment.id, frames: stamps.length - trim, firstFrame: trim,
		durations: screencastDurations(stamps.slice(trim), { fps: spec.fps, stop: screencastStopTime(stamps, received, stoppedAt) }),
		marks: marks.map(item => ({ name: item.name, frame: Math.max(0, item.frame - trim) })),
	};
}

const DRIVERS = { hold: captureHold, virtual: captureVirtual, screencast: captureScreencast };

/**
 * Capture a normalised spec: frames under spec.framesDir/<segment id>/, frames.ffconcat beside them and capture.json
 * in spec.manifestDir. → { manifest, manifestPath, ffconcat, results }. Imports Playwright here, never at load.
 */
export async function runCapture(spec, { headed = false } = {}) {
	const { chromium } = await import("@playwright/test");
	for (const dir of [spec.framesDir, spec.manifestDir]) fs.mkdirSync(dir, { recursive: true });
	const browser = await chromium.launch({ headless: !headed, args: spec.launch.args });
	const errors = [];
	try {
		const context = await browser.newContext({ viewport: spec.viewport, deviceScaleFactor: spec.deviceScaleFactor, colorScheme: spec.colorScheme, reducedMotion: spec.reducedMotion, ignoreHTTPSErrors: spec.ignoreHTTPSErrors });
		const page = await context.newPage();
		page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
		page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
		await installCaptureScripts(page, spec);
		await page.goto(spec.url, { waitUntil: "load" });
		await waitReady(page, spec.ready);
		const results = [];
		for (const segment of spec.segments) {
			const dir = path.join(spec.framesDir, segment.id);
			fs.rmSync(dir, { recursive: true, force: true });
			fs.mkdirSync(dir, { recursive: true });
			results.push(await DRIVERS[segment.kind](page, segment, dir, spec));
		}
		const byId = new Map(spec.segments.map(segment => [segment.id, segment]));
		const ffconcat = writeFfconcat(results.map(result => ({ ...byId.get(result.id), ...result })), { framesDir: spec.framesDir, fps: spec.fps });
		const manifest = buildCaptureManifest(spec, results, { errors, ffconcat });
		const manifestPath = path.join(spec.manifestDir, "capture.json");
		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
		return { manifest, manifestPath, ffconcat, results };
	} finally {
		await browser.close();
	}
}
