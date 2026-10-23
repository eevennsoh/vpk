#!/usr/bin/env node
// T7 (ws6 §8, C14): screenshot.mjs output paths, viewport resolution, capture plan, context
// options and the runner, driven by a fake browser so CI never launches Chromium.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SKILL_ROOT = fs.realpathSync(path.join(__dirname, ".."));
const DEMO = path.join(SKILL_ROOT, "assets", "demos", "demo-one-pager.html");

async function load() {
	return import("./screenshot.mjs");
}

function tempDir(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-screenshot-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return fs.realpathSync(dir);
}

function fakeChromium({ themeFor = theme => (theme === "dark" ? "dark" : null), pageErrors = [] } = {}) {
	const calls = { contexts: [], initArgs: [], styles: [], closed: 0 };
	const chromium = {
		async launch() {
			return {
				async newContext(options) {
					calls.contexts.push(options);
					const listeners = {};
					return {
						async addInitScript(fn, arg) { calls.initArgs.push(arg); },
						async newPage() {
							return {
								on(event, handler) { listeners[event] = handler; },
								async goto() { for (const message of pageErrors) listeners.pageerror?.(new Error(message)); },
								async evaluate(fn) { return fn.toString().includes("getAttribute") ? themeFor(options.colorScheme) : undefined; },
								async addStyleTag({ content }) { calls.styles.push(content); },
								async screenshot({ path: file, fullPage }) { assert.equal(fullPage, true); fs.writeFileSync(file, "png"); },
							};
						},
						async close() { calls.closed += 1; },
					};
				},
				async close() {},
			};
		},
	};
	return { chromium, calls };
}

test("screenshotDirFor: skill files go under <repo>/output whatever the cwd; other files beside themselves", async t => {
	const { screenshotDirFor } = await load();
	const repoRoot = "/repo";
	for (const cwd of ["/", SKILL_ROOT, path.join(SKILL_ROOT, "scripts")]) {
		assert.equal(screenshotDirFor(DEMO, { repoRoot, cwd }), path.join(repoRoot, "output", "vpk-html", "demo-one-pager", "screenshots"));
	}
	assert.equal(screenshotDirFor("/x/artifacts/vpk-html/s/s.html", { repoRoot }), "/x/artifacts/vpk-html/s/screenshots");
	assert.equal(screenshotDirFor("/x/output/vpk-html-evals/run-1/doc.html", { repoRoot }), "/x/output/vpk-html-evals/run-1/screenshots");
	assert.equal(screenshotDirFor(DEMO, { repoRoot: null, tmpdir: "/tmp-x" }), path.join("/tmp-x", "vpk-html", "demo-one-pager", "screenshots"));
	assert.equal(screenshotDirFor(DEMO, { repoRoot, out: "shots", cwd: "/work" }), path.join("/work", "shots"));
	const dir = tempDir(t);
	const linked = path.join(dir, "skill-link");
	fs.symlinkSync(SKILL_ROOT, linked);
	assert.equal(screenshotDirFor(path.join(linked, "assets", "demos", "demo-one-pager.html"), { repoRoot }), path.join(repoRoot, "output", "vpk-html", "demo-one-pager", "screenshots"), "a symlinked skill path still counts as the skill");
	const real = await import("./repo-root.mjs");
	const actualRoot = real.resolveRepoRoot();
	if (actualRoot) assert.ok(!screenshotDirFor(DEMO).startsWith(SKILL_ROOT), "the default never writes under the skill");
});

test("parseViewport and resolveViewport: flag, then sidecar brief.viewport, then 1440×900", async t => {
	const { parseViewport, resolveViewport, DEFAULT_VIEWPORT, MOBILE_VIEWPORT } = await load();
	assert.deepEqual(parseViewport("1440x900"), { width: 1440, height: 900 });
	assert.deepEqual(parseViewport(" 1280 × 800 "), { width: 1280, height: 800 });
	for (const bad of ["big", "100x100", "5000x900", "", null]) assert.throws(() => parseViewport(bad), /--viewport must look like 1440x900/);
	assert.deepEqual(DEFAULT_VIEWPORT, { width: 1440, height: 900 });
	assert.deepEqual(MOBILE_VIEWPORT, { width: 390, height: 844 });
	const dir = tempDir(t);
	const file = path.join(dir, "doc.html");
	fs.writeFileSync(file, "<!doctype html>");
	assert.deepEqual(resolveViewport(file), { width: 1440, height: 900 });
	fs.writeFileSync(path.join(dir, "doc.content.json"), JSON.stringify({ brief: { viewport: { width: 1366, height: 900 } } }));
	assert.deepEqual(resolveViewport(file), { width: 1366, height: 900 }, "the brief viewport beats the default");
	assert.deepEqual(resolveViewport(file, "1024x768"), { width: 1024, height: 768 }, "the flag beats the brief");
});

test("checklist, context options and capture plan", async () => {
	const { REVIEW_CHECKLIST, contextOptionsFor, capturePlan } = await load();
	assert.equal(REVIEW_CHECKLIST.length, 7);
	assert.deepEqual(contextOptionsFor({ viewport: { width: 1440, height: 900 }, theme: "dark" }), { viewport: { width: 1440, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
	assert.deepEqual(capturePlan("/a/doc.html", { viewport: { width: 1440, height: 900 } }).map(capture => [capture.name, capture.theme, capture.viewport.width]), [
		["doc-light-1440.png", "light", 1440],
		["doc-dark-1440.png", "dark", 1440],
		["doc-light-390.png", "light", 390],
		["doc-dark-390.png", "dark", 390],
	]);
	assert.deepEqual(capturePlan("/a/doc.html", { theme: "dark" }).map(capture => capture.name), ["doc-dark-1440.png", "doc-dark-390.png"], "mobile follows the requested theme");
	assert.deepEqual(capturePlan("/a/doc.html", { theme: "light" }).map(capture => capture.name), ["doc-light-1440.png", "doc-light-390.png"]);
	// P4 items 3 and 26: a 390 contract viewport is the mobile capture, so it is neither duplicated nor light-only.
	assert.deepEqual(capturePlan("/a/doc.html", { viewport: { width: 390, height: 844 } }).map(capture => [capture.name, capture.theme]), [["doc-light-390.png", "light"], ["doc-dark-390.png", "dark"]]);
	assert.deepEqual(capturePlan("/a/doc.html", { theme: "dark", viewport: { width: 390, height: 844 } }).map(capture => capture.name), ["doc-dark-390.png"]);
	const names = capturePlan("/a/doc.html", { viewport: { width: 390, height: 844 } }).map(capture => capture.name);
	assert.equal(new Set(names).size, names.length, "no capture name repeats");
	assert.throws(() => capturePlan("/a/doc.html", { theme: "sepia" }), /--theme must be one of light, dark, both/);
});

test("runScreenshot captures four images (both themes, desktop and mobile) with fresh themed contexts and prints the checklist", async t => {
	const { runScreenshot } = await load();
	const dir = tempDir(t);
	const file = path.join(dir, "doc.html");
	fs.writeFileSync(file, "<!doctype html>");
	const { chromium, calls } = fakeChromium();
	const log = [];
	const error = [];
	const code = await runScreenshot({ file, theme: "both" }, { log: line => log.push(line), error: line => error.push(line), repoRoot: "/repo", chromium });
	assert.equal(code, 0, error.join("\n"));
	assert.deepEqual(fs.readdirSync(path.join(dir, "screenshots")).sort(), ["doc-dark-1440.png", "doc-dark-390.png", "doc-light-1440.png", "doc-light-390.png"]);
	assert.deepEqual(calls.contexts.map(options => [options.colorScheme, options.reducedMotion, options.viewport.width]), [["light", "reduce", 1440], ["dark", "reduce", 1440], ["light", "reduce", 390], ["dark", "reduce", 390]]);
	assert.deepEqual(calls.initArgs, [["vpk-html-theme", "light"], ["vpk-html-theme", "dark"], ["vpk-html-theme", "light"], ["vpk-html-theme", "dark"]]);
	assert.equal(calls.closed, 4, "each capture closes its context");
	assert.ok(calls.styles.length === 4 && calls.styles.every(css => css.includes(".vpkh-scroll-fade")), "fixed scroll fades are hidden for full-page captures");
	assert.match(log.join("\n"), /Review checklist:[\s\S]*7\. mobile: no horizontal scroll[\s\S]*State the visual verdict only after viewing every image\./);
});

test("runScreenshot fails on theme mismatch or page errors, and rejects bad input with exit 2", async t => {
	const { runScreenshot } = await load();
	const dir = tempDir(t);
	const file = path.join(dir, "doc.html");
	fs.writeFileSync(file, "<!doctype html>");
	const quiet = { log: () => {}, repoRoot: "/repo" };
	const errors = [];
	const mismatch = fakeChromium({ themeFor: () => null });
	assert.equal(await runScreenshot({ file, out: path.join(dir, "a") }, { ...quiet, error: line => errors.push(line), chromium: mismatch.chromium }), 1);
	assert.match(errors.join("\n"), /doc-dark-1440\.png: theme runtime did not apply dark/);
	const broken = fakeChromium({ pageErrors: ["boom"] });
	assert.equal(await runScreenshot({ file, out: path.join(dir, "b") }, { ...quiet, error: () => {}, chromium: broken.chromium }), 1);
	const failingLaunch = { chromium: { launch: async () => { throw new Error("browserType.launch: Target page, context or browser has been closed"); } } };
	const launchErrors = [];
	assert.equal(await runScreenshot({ file, out: path.join(dir, "c") }, { ...quiet, error: line => launchErrors.push(line), ...failingLaunch }), 1);
	assert.match(launchErrors.join("\n"), /run unsandboxed; build\.mjs --doctor checks it/);
	assert.equal(await runScreenshot({ file: path.join(dir, "missing.html") }, { ...quiet, error: () => {} }), 2);
	assert.equal(await runScreenshot({ file, viewport: "huge" }, { ...quiet, error: () => {} }), 2);
	assert.equal(await runScreenshot({ file, theme: "sepia" }, { ...quiet, error: () => {} }), 2);
});
