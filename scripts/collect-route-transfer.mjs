#!/usr/bin/env node
// Measures the JavaScript and CSS a browser actually fetches on first load of each route group's
// representative route, and merges the medians into a perf baseline (output/perf-baseline.json).
//
// The manifest numbers from collect-perf-baseline.js cannot see project code loaded after
// hydration (loadDemoComponent, next/dynamic); this metric can. Each run uses a fresh browser
// context at a fixed viewport, loads the route, waits for network idle and then for a quiet
// period, and sums the decoded bodies of every same-origin .js and .css response (frames
// included). Usage:
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

export function classifyAsset(url, origin) {
	if (!url.startsWith(origin)) return null;
	const { pathname } = new URL(url);
	if (pathname.endsWith(".js")) return "js";
	if (pathname.endsWith(".css")) return "css";
	return null;
}

async function measureOnce(browser, origin, routePath) {
	const context = await browser.newContext({ viewport: VIEWPORT });
	const page = await context.newPage();
	const pending = [];
	const seen = new Set();
	let jsBytes = 0;
	let cssBytes = 0;
	let scripts = 0;
	let stylesheets = 0;
	page.on("response", (response) => {
		const kind = classifyAsset(response.url(), origin);
		if (!kind || seen.has(response.url())) return;
		seen.add(response.url());
		pending.push(response.body().then((body) => {
			if (kind === "js") { jsBytes += body.length; scripts += 1; } else { cssBytes += body.length; stylesheets += 1; }
		}, () => {}));
	});
	const response = await page.goto(`${origin}${routePath}`, { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: "networkidle" });
	assertNavigationOk(response?.status(), `${origin}${routePath}`);
	await page.waitForTimeout(QUIET_MS);
	await page.waitForLoadState("networkidle", { timeout: NAVIGATION_TIMEOUT_MS });
	await Promise.all(pending);
	await context.close();
	return { cssBytes, jsBytes, scripts, stylesheets };
}

export async function collectRouteTransfer({ baseUrl, routes = TRANSFER_ROUTES, runs = 3 }) {
	const { chromium } = require("@playwright/test");
	const { findChromePath } = require(path.join(process.cwd(), "scripts/lib/chrome-path.js"));
	const found = findChromePath();
	const browser = await chromium.launch({ headless: true, ...(found?.path ? { executablePath: found.path } : {}) });
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
	return results;
}

export function mergeIntoBaseline(baseline, transfer) {
	return {
		...baseline,
		routes: baseline.routes.map((route) => (transfer[route.id]
			? { ...route, fetchedCss: transfer[route.id].fetchedCss, fetchedJs: transfer[route.id].fetchedJs, fetchedPath: transfer[route.id].path, fetchedRuns: transfer[route.id].fetchedRuns }
			: route)),
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const baseline = JSON.parse(readFileSync(options.input, "utf8"));
	const transfer = await collectRouteTransfer({ baseUrl: options.baseUrl, runs: options.runs });
	writeFileSync(options.output, `${JSON.stringify(mergeIntoBaseline(baseline, transfer), null, 2)}\n`);
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
