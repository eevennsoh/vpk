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
// A route whose page attaches an iframe, or that has a fetchedJsBytesAllFrames budget in
// scripts/perf-route-budgets.json, gets a second pass with embedded documents allowed (same
// quiet-window rules, prefetches still blocked) that sums the same-origin .js of every frame,
// recorded as fetchedJsAllFrames (and its .css as fetchedCssAllFrames): a page that embeds whole
// projects would otherwise look light. Those count each URL once across frames, so N iframes
// running the same chunks count them once, and only frames that load at the 1440x900 viewport
// without scrolling. The same pass then scrolls the page through to the bottom (the largest
// scrollable element, a viewport at a time) and waits for the same quiet window again, so lazy
// iframes below the fold load too; everything fetched by then is fetchedJsFullPage and
// fetchedCssFullPage, and frameDocuments/fullPageFrameDocuments count the embedded documents
// each phase loaded. The viewport numbers are taken before the scroll starts, so they are what
// they were without it. A route whose pass saw no iframe attach records its top-document numbers
// with source "top-document", which the verifier rejects for a route that budgets all frames.
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
const ROUTE_BUDGETS_PATH = new URL("./perf-route-budgets.json", import.meta.url);

// Budget metrics measured by the all-frames pass (owned by the verifier).
const { ALL_FRAMES_METRICS } = require("./verify-perf-baseline-budget.js");

// Route ids whose budget includes an all-frames metric: they always get the all-frames pass,
// so an iframe that stops attaching in the iframe-blocked pass cannot skip the check.
export function routesWithAllFramesBudget(budgets) {
	return new Set(Object.entries(budgets).filter(([, budget]) => ALL_FRAMES_METRICS.some((metric) => Object.hasOwn(budget, metric))).map(([routeId]) => routeId));
}

export function needsAllFramesPass(routeId, routeRuns, allFramesRoutes) {
	return allFramesRoutes.has(routeId) || embedsFrames(routeRuns);
}

// What one request does in a pass: Next link prefetches are always aborted; an embedded
// document's navigation is aborted in the iframe-blocked pass and tracked (it holds the quiet
// window open) in the all-frames pass; a same-origin script or stylesheet is tracked; anything
// else is ignored by the quiet window.
export function requestAction({ allFrames, isAsset, isPrefetch, isSubframeNavigation }) {
	if (isPrefetch) return "abort";
	if (isSubframeNavigation) return allFrames ? "track" : "abort";
	return isAsset ? "track" : "ignore";
}

// Whether a response in this frame counts toward the pass's bytes.
export function countsFrame({ allFrames, isMainFrame }) {
	return allFrames || isMainFrame;
}

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

function summarizeField(runs, field) {
	const values = runs.map((run) => run[field]);
	return { bytes: median(values), range: Math.max(...values) - Math.min(...values), source: "all-frames" };
}

// The all-frames numbers for a route: the medians of its all-frames pass, or, when no iframe
// attached (the pass was skipped, or ran for a budgeted route and saw none), the top-document
// numbers, marked so the verifier can tell an all-frames budget is no longer measuring any frame.
export function summarizeAllFramesRuns(topDocumentSummary, allFramesRuns) {
	if (!allFramesRuns || !embedsFrames(allFramesRuns)) {
		const js = { ...topDocumentSummary.fetchedJs, source: "top-document" };
		const css = { ...topDocumentSummary.fetchedCss, source: "top-document" };
		return {
			...(allFramesRuns ? { fetchedAllFramesRuns: allFramesRuns } : {}),
			fetchedCssAllFrames: css,
			fetchedCssFullPage: css,
			fetchedJsAllFrames: js,
			fetchedJsFullPage: js,
		};
	}
	return {
		fetchedAllFramesRuns: allFramesRuns,
		fetchedCssAllFrames: summarizeField(allFramesRuns, "cssBytes"),
		fetchedCssFullPage: summarizeField(allFramesRuns, "fullPageCssBytes"),
		fetchedJsAllFrames: summarizeField(allFramesRuns, "jsBytes"),
		fetchedJsFullPage: summarizeField(allFramesRuns, "fullPageJsBytes"),
	};
}

// Whether any run of the iframe-blocked pass saw the page attach an embedded document.
export function embedsFrames(runs) {
	return runs.some((run) => run.framesAttached > 0 || run.blockedFrames > 0);
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

// Runs in the page: scrolls the largest scrollable element (the document, or an app shell's own
// scroll container) a viewport at a time to the bottom, two animation frames and a short pause
// per step so lazy iframes and content-visibility sections near each position start loading,
// until the bottom holds for two steps (content that grows while loading extends the walk).
export async function scrollThroughPage({ maxSteps = 400, pauseMs = 100 } = {}) {
	const scrollable = (element) => {
		if (element === document.scrollingElement) return element.scrollHeight > element.clientHeight;
		const { overflowY } = getComputedStyle(element);
		return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1;
	};
	const candidates = [document.scrollingElement, ...document.querySelectorAll("*")].filter((element) => element && scrollable(element));
	if (candidates.length === 0) return { scrollHeight: document.documentElement.scrollHeight, steps: 0 };
	const scroller = candidates.reduce((best, element) => (element.scrollHeight - element.clientHeight > best.scrollHeight - best.clientHeight ? element : best));
	const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
	let steps = 0;
	let atBottom = 0;
	while (steps < maxSteps && atBottom < 2) {
		scroller.scrollTop += Math.max(scroller.clientHeight, 1);
		steps += 1;
		await frame();
		await frame();
		await new Promise((resolve) => setTimeout(resolve, pauseMs));
		atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 ? atBottom + 1 : 0;
	}
	return { scrollHeight: scroller.scrollHeight, steps };
}

async function measureOnce(browser, origin, routePath, { allFrames = false } = {}) {
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
	// With allFrames, embedded documents load and every frame's scripts and stylesheets count;
	// their document requests hold the quiet window open too, so a frame's chunks are not cut off
	// between its HTML and its first script.
	const isSubframeNavigation = (request) => request.isNavigationRequest() && request.frame() !== page.mainFrame();
	const counts = (frame) => countsFrame({ allFrames, isMainFrame: frame === page.mainFrame() });
	let prefetchesBlocked = 0;
	await page.route("**/*", (route) => {
		const request = route.request();
		const isPrefetch = isRouterPrefetch(request.headers());
		if (requestAction({ allFrames, isAsset: false, isPrefetch, isSubframeNavigation: isSubframeNavigation(request) }) !== "abort") return route.continue();
		if (isPrefetch) prefetchesBlocked += 1;
		return route.abort("blockedbyclient");
	});
	const tracker = createAssetActivityTracker();
	const ids = new WeakMap();
	let nextId = 0;
	const pending = [];
	const seen = new Set();
	let blockedFrames = 0;
	let frameDocuments = 0;
	let framesAttached = 0;
	let scrolled = false;
	let jsBytes = 0;
	let cssBytes = 0;
	let scripts = 0;
	let stylesheets = 0;
	page.on("frameattached", () => {
		framesAttached += 1;
	});
	page.on("request", (request) => {
		const subframe = isSubframeNavigation(request);
		const action = requestAction({ allFrames, isAsset: Boolean(classifyAsset(request.url(), origin)), isPrefetch: false, isSubframeNavigation: subframe });
		if (subframe && action === "abort") blockedFrames += 1;
		if (action !== "track") return;
		ids.set(request, (nextId += 1));
		tracker.started(ids.get(request), request.url().replace(origin, ""));
	});
	const assetFailures = [];
	const assets = [];
	page.on("requestfailed", (request) => {
		tracker.finished(ids.get(request));
		if (classifyAsset(request.url(), origin) && counts(request.frame())) {
			assetFailures.push(`${request.url().replace(origin, "")} (${request.failure()?.errorText ?? "failed"})`);
		}
	});
	page.on("requestfinished", (request) => tracker.finished(ids.get(request)));
	page.on("response", (response) => {
		if (allFrames && response.request().isNavigationRequest() && response.frame() !== page.mainFrame() && response.status() < 400) frameDocuments += 1;
		const kind = classifyAsset(response.url(), origin);
		if (!kind || seen.has(response.url()) || !counts(response.frame())) return;
		seen.add(response.url());
		if (response.status() >= 400) {
			assetFailures.push(`${response.url().replace(origin, "")} (HTTP ${response.status()})`);
			return;
		}
		const frame = response.frame() === page.mainFrame() ? "main" : "sub";
		pending.push(response.body().then((body) => {
			assets.push({ bytes: body.length, frame, kind, path: response.url().replace(origin, ""), ...(scrolled ? { scrolled: true } : {}) });
			if (kind === "js") { jsBytes += body.length; scripts += 1; } else { cssBytes += body.length; stylesheets += 1; }
		}, (error) => {
			assetFailures.push(`${response.url().replace(origin, "")} (body unreadable: ${error.message.split("\n")[0]})`);
		}));
	});
	const response = await page.goto(`${origin}${routePath}`, { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: "load" });
	assertNavigationOk(response?.status(), `${origin}${routePath}`);
	await waitForAssetQuiet({ capMs: SETTLE_CAP_MS, quietMs: QUIET_MS, tracker });
	await Promise.all(pending);
	const viewport = { cssBytes, frameDocuments, jsBytes, scripts, stylesheets };
	let fullPage = null;
	if (allFrames) {
		// The viewport numbers above are final; now scroll so lazy iframes below the fold load,
		// under the same quiet-window rules, and count everything fetched by the end.
		scrolled = true;
		const scrollStartedAt = Date.now();
		const scroll = await page.evaluate(scrollThroughPage);
		await waitForAssetQuiet({ capMs: SETTLE_CAP_MS, quietMs: QUIET_MS, tracker });
		await Promise.all(pending);
		fullPage = {
			fullPageCssBytes: cssBytes,
			fullPageFrameDocuments: frameDocuments,
			fullPageJsBytes: jsBytes,
			scrollMs: Date.now() - scrollStartedAt,
			scrollSteps: scroll.steps,
		};
	}
	await context.close();
	assertAssetsLoaded(assetFailures, `${origin}${routePath}`);
	assets.sort((left, right) => left.path.localeCompare(right.path));
	return { assets, blockedFrames, framesAttached, prefetchesBlocked, ...viewport, ...fullPage };
}

export async function collectRouteTransfer({ allFramesRoutes = new Set(), baseUrl, routes = TRANSFER_ROUTES, runs = 3 }) {
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
			const summary = summarizeRuns(routeRuns);
			let allFramesRuns = null;
			if (needsAllFramesPass(routeId, routeRuns, allFramesRoutes)) {
				allFramesRuns = [];
				for (let run = 0; run < runs; run += 1) {
					allFramesRuns.push(await measureOnce(browser, origin, routePath, { allFrames: true }));
				}
			}
			results[routeId] = { path: routePath, ...summary, ...summarizeAllFramesRuns(summary, allFramesRuns) };
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
			? {
				...route,
				fetchedCss: transfer[route.id].fetchedCss,
				fetchedJs: transfer[route.id].fetchedJs,
				...(transfer[route.id].fetchedJsAllFrames ? { fetchedJsAllFrames: transfer[route.id].fetchedJsAllFrames } : {}),
				...(transfer[route.id].fetchedCssAllFrames ? { fetchedCssAllFrames: transfer[route.id].fetchedCssAllFrames } : {}),
				...(transfer[route.id].fetchedJsFullPage ? { fetchedJsFullPage: transfer[route.id].fetchedJsFullPage } : {}),
				...(transfer[route.id].fetchedCssFullPage ? { fetchedCssFullPage: transfer[route.id].fetchedCssFullPage } : {}),
				...(transfer[route.id].fetchedAllFramesRuns ? { fetchedAllFramesRuns: transfer[route.id].fetchedAllFramesRuns } : {}),
				fetchedPath: transfer[route.id].path,
				fetchedRuns: transfer[route.id].fetchedRuns,
			}
			: route)),
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const baseline = JSON.parse(readFileSync(options.input, "utf8"));
	const startedAt = Date.now();
	const allFramesRoutes = routesWithAllFramesBudget(JSON.parse(readFileSync(ROUTE_BUDGETS_PATH, "utf8")).routes);
	const { browser, results: transfer } = await collectRouteTransfer({ allFramesRoutes, baseUrl: options.baseUrl, runs: options.runs });
	console.log(`browser ${browser.version} at ${browser.executablePath}; collected in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
	writeFileSync(options.output, `${JSON.stringify(mergeIntoBaseline(baseline, transfer, browser), null, 2)}\n`);
	for (const [routeId, result] of Object.entries(transfer)) {
		const allFrames = result.fetchedJsAllFrames.source === "all-frames"
			? `, all frames js ${result.fetchedJsAllFrames.bytes} (range ${result.fetchedJsAllFrames.range}) css ${result.fetchedCssAllFrames.bytes}, full page js ${result.fetchedJsFullPage.bytes} (range ${result.fetchedJsFullPage.range}) css ${result.fetchedCssFullPage.bytes}, frames ${result.fetchedAllFramesRuns.map((run) => `${run.frameDocuments}/${run.fullPageFrameDocuments}`).join(" ")} (viewport/full page), scroll ${result.fetchedAllFramesRuns.map((run) => `${run.scrollMs} ms`).join(" ")}`
			: result.fetchedAllFramesRuns ? ", all-frames pass saw no iframe" : "";
		console.log(`${routeId} ${result.path}: js ${result.fetchedJs.bytes} (range ${result.fetchedJs.range}), css ${result.fetchedCss.bytes} (range ${result.fetchedCss.range})${allFrames} over ${result.fetchedRuns.length} runs`);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
