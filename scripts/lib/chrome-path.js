#!/usr/bin/env node

"use strict";

// Find a Chromium headless shell that MDM policy does not reach, for Lighthouse, CDP and
// other tools that take CHROME_PATH. On this team's managed Macs, policy for anything under
// /Applications force-installs an extension, and CDP sessions against that Chrome close
// mid-run ("Protocol error … Session closed"). Playwright's and Puppeteer's caches hold
// binaries outside that policy.
//
//   CHROME_PATH="$(node scripts/lib/chrome-path.js)" npx lighthouse …
//
// Order: an explicit CHROME_PATH outside /Applications; Playwright's headless shell at the
// revision the installed @playwright/test expects; any other Playwright headless shell,
// newest first; Puppeteer's headless shell, newest first.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MANAGED_PREFIX = "/Applications/";

function defaultPlaywrightCache(env = process.env, platform = process.platform, home = os.homedir()) {
	if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== "0") return env.PLAYWRIGHT_BROWSERS_PATH;
	return platform === "darwin" ? path.join(home, "Library", "Caches", "ms-playwright") : path.join(home, ".cache", "ms-playwright");
}

function listDirs(dir) {
	try {
		return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch {
		return [];
	}
}

function isExecutable(file) {
	try {
		fs.accessSync(file, fs.constants.X_OK);
		return fs.statSync(file).isFile();
	} catch {
		return false;
	}
}

// <revisionDir>/chrome-headless-shell-<platform>/chrome-headless-shell
function shellIn(dir) {
	for (const platformDir of listDirs(dir).filter((name) => name.startsWith("chrome-headless-shell-"))) {
		const binary = path.join(dir, platformDir, "chrome-headless-shell");
		if (isExecutable(binary)) return binary;
	}
	return null;
}

function revisionOf(name, prefix) {
	const revision = Number.parseInt(name.slice(prefix.length), 10);
	return Number.isFinite(revision) ? revision : -1;
}

// The chromium revision @playwright/test drives, from the path Playwright reports for it.
function expectedPlaywrightRevision() {
	try {
		const { chromium } = require("@playwright/test");
		return /chromium-(\d+)/u.exec(chromium.executablePath())?.[1] ?? null;
	} catch {
		return null;
	}
}

function findChromePath({
	env = process.env,
	expectedRevision = expectedPlaywrightRevision(),
	playwrightCache = defaultPlaywrightCache(env),
	puppeteerCache = path.join(os.homedir(), ".cache", "puppeteer", "chrome-headless-shell"),
} = {}) {
	if (env.CHROME_PATH && !env.CHROME_PATH.startsWith(MANAGED_PREFIX) && isExecutable(env.CHROME_PATH)) {
		return { path: env.CHROME_PATH, source: "CHROME_PATH" };
	}
	const prefix = "chromium_headless_shell-";
	const revisions = listDirs(playwrightCache)
		.filter((name) => name.startsWith(prefix))
		.sort((left, right) => revisionOf(right, prefix) - revisionOf(left, prefix));
	const preferred = expectedRevision ? revisions.filter((name) => name === `${prefix}${expectedRevision}`) : [];
	for (const name of [...preferred, ...revisions.filter((name) => !preferred.includes(name))]) {
		const binary = shellIn(path.join(playwrightCache, name));
		if (binary) return { path: binary, source: preferred.includes(name) ? "playwright (installed revision)" : "playwright" };
	}
	const puppeteerVersions = listDirs(puppeteerCache).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
	for (const version of puppeteerVersions) {
		const binary = shellIn(path.join(puppeteerCache, version));
		if (binary) return { path: binary, source: "puppeteer" };
	}
	return null;
}

if (require.main === module) {
	const found = findChromePath();
	if (!found) {
		process.stderr.write("No headless shell found. Install one with: pnpm exec playwright install chromium-headless-shell\n");
		process.exit(1);
	}
	if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(found)}\n`);
	else process.stdout.write(`${found.path}\n`);
}

module.exports = { findChromePath };
