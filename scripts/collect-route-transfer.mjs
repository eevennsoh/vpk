#!/usr/bin/env node
// Measures the JavaScript and CSS a browser actually fetches on first load of each route group's
// representative route, and merges the medians into a perf baseline (output/perf-baseline.json).
//
// The manifest numbers from collect-perf-baseline.js cannot see project code loaded after
// hydration (loadDemoComponent, next/dynamic); this metric can. Each run uses a fresh browser
// context at a fixed viewport, loads the route (the load event), then waits until no same-origin
// script or stylesheet has been in flight for a quiet period (other requests, such as /api
// polling with no backend, never hold it open; a hard cap fails with what is still in flight),
// and sums the decoded bodies of the top document's same-origin .js and .css responses.
// Embedded documents (iframes) and Next link prefetches are blocked and not counted, so the
// number is what the route itself loads, not what it speculatively fetches for other routes.
// Usage:
//   node scripts/collect-route-transfer.mjs --base-url http://127.0.0.1:3100 [--runs 3]
//     [--input output/perf-baseline.json] [--output output/perf-baseline.json]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

export const TRANSFER_ROUTES = {
	home: "/",
	rovo: "/rovo",
	studio: "/studio",
	components: "/components/ui/button",
	butter: "/butter",
	eu26: "/jira-team-eu26",
	"heavy-visual": "/visual/ripple",
};

const VIEWPORT = { width: 1440, height: 900 };
const QUIET_MS = 2000;
const NAVIGATION_TIMEOUT_MS = 90_000;
const SETTLE_CAP_MS = 60_000;

export function parseArgs(argv) {
	const options = { baseUrl: null, input: "output/perf-baseline.json", output: null, runs: 3 };
	for (let index = 0; index < argv.length; index += 1) {
		const [flag, inline] = argv[index].split(/=(.*)/su);
		const value = inline ?? argv[index + 1];
		const consume = () => {
			if (!value) throw new Error(`${flag} requires a value`);
			if (inline === undefined) index += 1;
			return value;
		};
		if (flag === "--base-url") options.baseUrl = consume();
		else if (flag === "--input") options.input = consume();
		else if (flag === "--output") options.output = consume();
		else if (flag === "--runs") {
			options.runs = Number(consume());
			if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error(`Invalid --runs: ${value}`);
		} else throw new Error(`Unknown argument: ${argv[index]}`);
	}
	if (!options.baseUrl) throw new Error("--base-url is required");
	options.output ??= options.input;
	return options;
}

export function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function summarizeRuns(runs) {
	const js = runs.map((run) => run.jsBytes);
	const css = runs.map((run) => run.cssBytes);
	return {
		fetchedCss: { bytes: median(css), range: Math.max(...css) - Math.min(...css) },
		fetchedJs: { bytes: median(js), range: Math.max(...js) - Math.min(...js) },
		fetchedRuns: runs,
	};
}

// A route that answers with an error page must fail the collection: its assets would otherwise
// be recorded as the route's fetched bytes, and a low number would pass the budget.
export function assertNavigationOk(status, url) {
	if (typeof status !== "number" || status >= 400) {
		throw new Error(`${url} answered ${status ?? "no response"}; refusing to record its transfer sizes.`);
	}
}

// A script or stylesheet that failed, answered an error or could not be read makes the sample
// invalid: an error body would be counted, and a failed chunk stops later imports, so the total
// would be too small.
export function assertAssetsLoaded(failures, url) {
	if (failures.length > 0) {
		throw new Error(`${url}: ${failures.length} script or stylesheet request(s) failed; refusing to record the sample: ${failures.join(", ")}`);
	}
}

// Next's App Router marks a link prefetch with `Next-Router-Prefetch: 1` (headers arrive lowercased).
export function isRouterPrefetch(headers) {
	return headers["next-router-prefetch"] === "1";
}

export function classifyAsset(url, origin) {
	if (!url.startsWith(origin)) return null;
	const { pathname } = new URL(url);
	if (pathname.endsWith(".js")) return "js";
	if (pathname.endsWith(".css")) return "css";
	return null;
}

// Tracks same-origin script and stylesheet requests only, so polling or failed /api calls
// cannot hold a measurement open.
export function createAssetActivityTracker(now = () => Date.now()) {
	const inFlight = new Map();
	let lastActivityAt = now();
	return {
		finished(requestId) {
			if (inFlight.delete(requestId)) lastActivityAt = now();
		},
		get inFlight() {
			return [...inFlight.values()];
		},
		get lastActivityAt() {
			return lastActivityAt;
		},
		started(requestId, url) {
			inFlight.set(requestId, url);
			lastActivityAt = now();
		},
	};
}

// Resolves once no script or stylesheet is in flight and none has started or finished for
// quietMs; throws with the requests still in flight when capMs passes first.
export async function waitForAssetQuiet({ capMs, now = () => Date.now(), pollMs = 100, quietMs, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), tracker }) {
	const startedAt = now();
	for (;;) {
		const quietFor = now() - tracker.lastActivityAt;
		if (tracker.inFlight.length === 0 && quietFor >= quietMs) return;
		if (now() - startedAt >= capMs) {
			const pending = tracker.inFlight;
			throw new Error(`scripts and stylesheets did not settle within ${capMs} ms; ${pending.length} still in flight${pending.length ? `: ${pending.join(", ")}` : ` (last activity ${quietFor} ms ago)`}`);
		}
		await sleep(pollMs);
	}
}

async function measureOnce(browser, origin, routePath) {
	const context = await browser.newContext({ viewport: VIEWPORT });
	const page = await context.newPage();
	// Only the top document's own fetches count. Embedded documents are blocked: how many lazy
	// iframes Chrome loads depends on its lazy-load distance (and the effective connection type),
	// which differs between machines; today only the home catalog embeds project previews.
	// Link prefetches are blocked too: the Next router requests a linked route's payload with a
	// `Next-Router-Prefetch: 1` header and then loads that route's chunks through the webpack
	// runtime, so which links sit in the viewport (layout, hence fonts) would decide part of the
	// number. Blocking the payload request stops the speculative chunks; their count is kept as
	// an observation (prefetchesBlocked), not part of the budget.
	let prefetchesBlocked = 0;
	await page.route("**/*", (route) => {
		const request = route.request();
		if (request.isNavigationRequest() && request.frame() !== page.mainFrame()) return route.abort("blockedbyclient");
		if (isRouterPrefetch(request.headers())) {
			prefetchesBlocked += 1;
			return route.abort("blockedbyclient");
		}
		return route.continue();
	});
	const tracker = createAssetActivityTracker();
	const ids = new WeakMap();
	let nextId = 0;
	const pending = [];
	const seen = new Set();
	let blockedFrames = 0;
	let jsBytes = 0;
	let cssBytes = 0;
	let scripts = 0;
	let stylesheets = 0;
	page.on("request", (request) => {
		if (request.isNavigationRequest() && request.frame() !== page.mainFrame()) blockedFrames += 1;
		if (!classifyAsset(request.url(), origin)) return;
		ids.set(request, (nextId += 1));
		tracker.started(ids.get(request), request.url().replace(origin, ""));
	});
	const assetFailures = [];
	const assets = [];
	page.on("requestfailed", (request) => {
		tracker.finished(ids.get(request));
		if (classifyAsset(request.url(), origin) && request.frame() === page.mainFrame()) {
			assetFailures.push(`${request.url().replace(origin, "")} (${request.failure()?.errorText ?? "failed"})`);
		}
	});
	page.on("requestfinished", (request) => tracker.finished(ids.get(request)));
	page.on("response", (response) => {
		const kind = classifyAsset(response.url(), origin);
		if (!kind || seen.has(response.url()) || response.frame() !== page.mainFrame()) return;
		seen.add(response.url());
		if (response.status() >= 400) {
			assetFailures.push(`${response.url().replace(origin, "")} (HTTP ${response.status()})`);
			return;
		}
		pending.push(response.body().then((body) => {
			assets.push({ bytes: body.length, kind, path: response.url().replace(origin, "") });
			if (kind === "js") { jsBytes += body.length; scripts += 1; } else { cssBytes += body.length; stylesheets += 1; }
		}, (error) => {
			assetFailures.push(`${response.url().replace(origin, "")} (body unreadable: ${error.message.split("\n")[0]})`);
		}));
	});
	const response = await page.goto(`${origin}${routePath}`, { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: "load" });
	assertNavigationOk(response?.status(), `${origin}${routePath}`);
	await waitForAssetQuiet({ capMs: SETTLE_CAP_MS, quietMs: QUIET_MS, tracker });
	await Promise.all(pending);
	await context.close();
	assertAssetsLoaded(assetFailures, `${origin}${routePath}`);
	assets.sort((left, right) => left.path.localeCompare(right.path));
	return { assets, blockedFrames, cssBytes, jsBytes, prefetchesBlocked, scripts, stylesheets };
}

export async function collectRouteTransfer({ baseUrl, routes = TRANSFER_ROUTES, runs = 3 }) {
	const { chromium } = require("@playwright/test");
	// Always Playwright's own Chromium (the headless shell the installed @playwright/test pins),
	// never a system Chrome or CHROME_PATH, so the number does not depend on what is installed.
	const browser = await chromium.launch({ headless: true });
	// headless: true runs the chromium_headless_shell of the same revision as this executable.
	const browserInfo = { executablePath: chromium.executablePath(), headless: true, version: browser.version() };
	const origin = new URL(baseUrl).origin;
	const results = {};
	try {
		for (const [routeId, routePath] of Object.entries(routes)) {
			const routeRuns = [];
			for (let run = 0; run < runs; run += 1) {
				routeRuns.push(await measureOnce(browser, origin, routePath));
			}
			results[routeId] = { path: routePath, ...summarizeRuns(routeRuns) };
		}
	} finally {
		await browser.close();
	}
	return { browser: browserInfo, results };
}

export function mergeIntoBaseline(baseline, transfer, browser = null) {
	return {
		...baseline,
		...(browser ? { source: { ...baseline.source, fetchedBrowser: browser } } : {}),
		routes: baseline.routes.map((route) => (transfer[route.id]
			? { ...route, fetchedCss: transfer[route.id].fetchedCss, fetchedJs: transfer[route.id].fetchedJs, fetchedPath: transfer[route.id].path, fetchedRuns: transfer[route.id].fetchedRuns }
			: route)),
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const baseline = JSON.parse(readFileSync(options.input, "utf8"));
	const { browser, results: transfer } = await collectRouteTransfer({ baseUrl: options.baseUrl, runs: options.runs });
	console.log(`browser ${browser.version} at ${browser.executablePath}`);
	writeFileSync(options.output, `${JSON.stringify(mergeIntoBaseline(baseline, transfer, browser), null, 2)}\n`);
	for (const [routeId, result] of Object.entries(transfer)) {
		console.log(`${routeId} ${result.path}: js ${result.fetchedJs.bytes} (range ${result.fetchedJs.range}), css ${result.fetchedCss.bytes} (range ${result.fetchedCss.range}) over ${result.fetchedRuns.length} runs`);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
