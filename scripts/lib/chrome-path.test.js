const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { findChromePath } = require("./chrome-path.js");

function shell(root, revisionDir, platformDir = "chrome-headless-shell-mac-arm64") {
	const binary = path.join(root, revisionDir, platformDir, "chrome-headless-shell");
	fs.mkdirSync(path.dirname(binary), { recursive: true });
	fs.writeFileSync(binary, "#!/bin/sh\n");
	fs.chmodSync(binary, 0o755);
	return binary;
}

function withCaches(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-path-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	return { playwrightCache: path.join(root, "ms-playwright"), puppeteerCache: path.join(root, "puppeteer"), root };
}

test("Playwright's headless shell at the installed revision wins, then the newest", (t) => {
	const caches = withCaches(t);
	shell(caches.playwrightCache, "chromium_headless_shell-1228");
	const installed = shell(caches.playwrightCache, "chromium_headless_shell-1248");
	const newest = shell(caches.playwrightCache, "chromium_headless_shell-1254", "chrome-headless-shell-linux64");
	fs.mkdirSync(path.join(caches.playwrightCache, "chromium-1254"), { recursive: true });

	assert.deepEqual(findChromePath({ env: {}, expectedRevision: "1248", ...caches }), { path: installed, source: "playwright (installed revision)" });
	assert.deepEqual(findChromePath({ env: {}, expectedRevision: null, ...caches }), { path: newest, source: "playwright" });
	assert.deepEqual(findChromePath({ env: {}, expectedRevision: "9999", ...caches }), { path: newest, source: "playwright" });
});

test("an explicit CHROME_PATH is used unless it is the managed Chrome under /Applications", (t) => {
	const caches = withCaches(t);
	const cached = shell(caches.playwrightCache, "chromium_headless_shell-1248");
	const custom = shell(caches.root, "custom");
	assert.deepEqual(findChromePath({ env: { CHROME_PATH: custom }, expectedRevision: null, ...caches }), { path: custom, source: "CHROME_PATH" });
	const managed = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
	assert.equal(findChromePath({ env: { CHROME_PATH: managed }, expectedRevision: null, ...caches }).path, cached);
});

test("Puppeteer's headless shell is the fallback, and nothing found is null", (t) => {
	const caches = withCaches(t);
	shell(caches.puppeteerCache, "mac_arm-131.0.6778.85");
	const newer = shell(caches.puppeteerCache, "mac_arm-140.0.7339.0");
	assert.deepEqual(findChromePath({ env: {}, expectedRevision: null, ...caches }), { path: newer, source: "puppeteer" });
	assert.equal(findChromePath({ env: {}, expectedRevision: null, playwrightCache: caches.root, puppeteerCache: path.join(caches.root, "none") }), null);
});
