import assert from "node:assert/strict";
import test from "node:test";

import { TRANSFER_ROUTES, scrollThroughPage, assertAssetsLoaded, countsFrame, embedsFrames, needsAllFramesPass, requestAction, routesWithAllFramesBudget, summarizeAllFramesRuns, isRouterPrefetch, assertNavigationOk, classifyAsset, createAssetActivityTracker, waitForAssetQuiet, median, mergeIntoBaseline, parseArgs, summarizeRuns } from "./collect-route-transfer.mjs";

test("parseArgs requires a base URL and defaults to merging into the perf baseline", () => {
	assert.deepEqual(parseArgs(["--base-url", "http://127.0.0.1:3100"]), { baseUrl: "http://127.0.0.1:3100", input: "output/perf-baseline.json", output: "output/perf-baseline.json", runs: 3 });
	assert.equal(parseArgs(["--base-url=http://x", "--runs=5", "--output", "out.json"]).runs, 5);
	assert.throws(() => parseArgs([]), /--base-url is required/u);
	assert.throws(() => parseArgs(["--base-url", "http://x", "--runs", "0"]), /Invalid --runs/u);
});

test("only same-origin scripts and stylesheets count", () => {
	const origin = "http://127.0.0.1:3100";
	assert.equal(classifyAsset(`${origin}/_next/static/chunks/main.js`, origin), "js");
	assert.equal(classifyAsset(`${origin}/_next/static/css/app.css?v=1`, origin), "css");
	assert.equal(classifyAsset(`${origin}/_next/static/media/font.woff2`, origin), null);
	assert.equal(classifyAsset("https://cdn.example.com/lib.js", origin), null);
});

test("runs reduce to a median with the observed range", () => {
	assert.equal(median([3, 1, 2]), 2);
	assert.equal(median([1, 2, 3, 4]), 3);
	const summary = summarizeRuns([{ cssBytes: 10, jsBytes: 100 }, { cssBytes: 10, jsBytes: 104 }, { cssBytes: 12, jsBytes: 101 }]);
	assert.deepEqual(summary.fetchedJs, { bytes: 101, range: 4 });
	assert.deepEqual(summary.fetchedCss, { bytes: 10, range: 2 });
});

test("results merge into the matching baseline routes and every budgeted group has a route", () => {
	const merged = mergeIntoBaseline({ routes: [{ id: "home" }, { id: "other" }] }, { home: { path: "/", ...summarizeRuns([{ cssBytes: 1, jsBytes: 2 }]) } });
	assert.deepEqual(merged.routes[0].fetchedJs, { bytes: 2, range: 0 });
	assert.equal(merged.routes[0].fetchedPath, "/");
	assert.equal(merged.routes[1].fetchedJs, undefined);
	assert.deepEqual(Object.keys(TRANSFER_ROUTES), ["home", "rovo", "studio", "components", "butter", "eu26", "heavy-visual"]);
});

test("an error page or a missing response fails the collection instead of being measured", () => {
	assert.doesNotThrow(() => assertNavigationOk(200, "http://x/"));
	assert.doesNotThrow(() => assertNavigationOk(304, "http://x/"));
	assert.throws(() => assertNavigationOk(404, "http://x/missing"), /answered 404/u);
	assert.throws(() => assertNavigationOk(500, "http://x/"), /answered 500/u);
	assert.throws(() => assertNavigationOk(undefined, "http://x/"), /no response/u);
});

function fakeClock() {
	let t = 0;
	return { now: () => t, sleep: async (ms) => { t += ms; } };
}

test("the measurement settles once no script or stylesheet is in flight for the quiet period", async () => {
	const clock = fakeClock();
	const tracker = createAssetActivityTracker(clock.now);
	tracker.started(1, "/_next/static/chunks/a.js");
	let settled = false;
	const waiting = waitForAssetQuiet({ capMs: 10_000, now: clock.now, quietMs: 2000, sleep: async (ms) => {
		await clock.sleep(ms);
		if (clock.now() === 500) tracker.finished(1);
	}, tracker }).then(() => { settled = true; });
	await waiting;
	assert.equal(settled, true);
	assert.equal(clock.now(), 2500, "quiet is measured from the last script finishing");
});

test("unsettled scripts fail with the requests still in flight once the cap passes", async () => {
	const clock = fakeClock();
	const tracker = createAssetActivityTracker(clock.now);
	tracker.started(1, "/_next/static/chunks/stuck.js");
	await assert.rejects(
		waitForAssetQuiet({ capMs: 3000, now: clock.now, quietMs: 2000, sleep: clock.sleep, tracker }),
		/did not settle within 3000 ms; 1 still in flight: \/_next\/static\/chunks\/stuck\.js/u,
	);
});

test("requests that are not tracked never hold the measurement open", async () => {
	const clock = fakeClock();
	const tracker = createAssetActivityTracker(clock.now);
	tracker.finished(undefined);
	await waitForAssetQuiet({ capMs: 60_000, now: clock.now, quietMs: 2000, sleep: clock.sleep, tracker });
	assert.equal(clock.now(), 2000);
});

test("a failed, error or unreadable script or stylesheet invalidates the sample", () => {
	assert.doesNotThrow(() => assertAssetsLoaded([], "http://x/"));
	assert.throws(
		() => assertAssetsLoaded(["/_next/static/chunks/a.js (HTTP 404)", "/_next/static/css/b.css (net::ERR_FAILED)"], "http://x/"),
		/2 script or stylesheet request\(s\) failed; refusing to record the sample: \/_next\/static\/chunks\/a\.js \(HTTP 404\)/u,
	);
});

test("the browser that measured is recorded with the baseline", () => {
	const merged = mergeIntoBaseline({ routes: [], source: { kind: "build" } }, {}, { executablePath: "/x/chrome", headless: true, version: "150.0.0.0" });
	assert.deepEqual(merged.source, { fetchedBrowser: { executablePath: "/x/chrome", headless: true, version: "150.0.0.0" }, kind: "build" });
});

test("Next router prefetches are recognised by their header", () => {
	assert.equal(isRouterPrefetch({ "next-router-prefetch": "1", rsc: "1" }), true);
	assert.equal(isRouterPrefetch({ rsc: "1" }), false);
	assert.equal(isRouterPrefetch({}), false);
});

test("only a route whose page attaches an iframe gets the all-frames pass", () => {
	assert.equal(embedsFrames([{ blockedFrames: 0, framesAttached: 0 }, { blockedFrames: 0, framesAttached: 0 }]), false);
	assert.equal(embedsFrames([{ blockedFrames: 0, framesAttached: 0 }, { blockedFrames: 1, framesAttached: 1 }]), true);
	assert.equal(embedsFrames([{ blockedFrames: 0, framesAttached: 1 }]), true, "an iframe without a navigation (srcdoc) still counts");
});

test("the all-frames JS is its own pass's median, or the top-document number when no iframe loaded", () => {
	const topDocument = summarizeRuns([{ cssBytes: 1, jsBytes: 100 }, { cssBytes: 1, jsBytes: 102 }]);
	assert.deepEqual(summarizeAllFramesRuns(topDocument, null).fetchedJsAllFrames, { bytes: 101, range: 2, source: "top-document" });
	const allFramesRuns = [{ jsBytes: 900 }, { jsBytes: 950 }, { jsBytes: 910 }];
	assert.deepEqual(summarizeAllFramesRuns(topDocument, allFramesRuns.map((run) => ({ ...run, cssBytes: 5, framesAttached: 3, fullPageCssBytes: 6, fullPageJsBytes: 2000 }))).fetchedJsAllFrames, { bytes: 910, range: 50, source: "all-frames" });
});

test("an all-frames pass that saw no iframe attach records the top-document number, not its own", () => {
	const topDocument = summarizeRuns([{ cssBytes: 1, jsBytes: 100 }]);
	const quietRuns = [{ blockedFrames: 0, framesAttached: 0, jsBytes: 104 }];
	const js = { bytes: 100, range: 0, source: "top-document" };
	const css = { bytes: 1, range: 0, source: "top-document" };
	assert.deepEqual(summarizeAllFramesRuns(topDocument, quietRuns), { fetchedAllFramesRuns: quietRuns, fetchedCssAllFrames: css, fetchedCssFullPage: css, fetchedJsAllFrames: js, fetchedJsFullPage: js });
});

test("a route with an all-frames budget gets the all-frames pass even when no iframe attached in the blocked pass", () => {
	const allFramesRoutes = routesWithAllFramesBudget({ butter: { fetchedJsBytes: 1 }, home: { fetchedJsBytes: 1, fetchedJsBytesAllFrames: 2 } });
	assert.deepEqual([...allFramesRoutes], ["home"]);
	assert.deepEqual([...routesWithAllFramesBudget({ a: { fetchedCssBytesAllFrames: 1 }, b: { fetchedJsBytesFullPage: 1 }, c: { fetchedCssBytes: 1 } })], ["a", "b"], "any all-frames metric keeps the pass");
	const noFrames = [{ blockedFrames: 0, framesAttached: 0 }];
	assert.equal(needsAllFramesPass("home", noFrames, allFramesRoutes), true);
	assert.equal(needsAllFramesPass("butter", noFrames, allFramesRoutes), false);
	assert.equal(needsAllFramesPass("butter", [{ blockedFrames: 1, framesAttached: 1 }], allFramesRoutes), true);
});

test("embedded documents are aborted in the blocked pass and tracked in the all-frames pass", () => {
	const subframe = { isAsset: false, isPrefetch: false, isSubframeNavigation: true };
	assert.equal(requestAction({ ...subframe, allFrames: false }), "abort");
	assert.equal(requestAction({ ...subframe, allFrames: true }), "track", "an iframe's document holds the quiet window open");
	for (const allFrames of [false, true]) {
		assert.equal(requestAction({ allFrames, isAsset: false, isPrefetch: true, isSubframeNavigation: false }), "abort", "prefetches are blocked in every pass");
		assert.equal(requestAction({ allFrames, isAsset: true, isPrefetch: false, isSubframeNavigation: false }), "track");
		assert.equal(requestAction({ allFrames, isAsset: false, isPrefetch: false, isSubframeNavigation: false }), "ignore");
	}
});

test("only the main frame's responses count in the blocked pass; every frame's count in the all-frames pass", () => {
	assert.equal(countsFrame({ allFrames: false, isMainFrame: true }), true);
	assert.equal(countsFrame({ allFrames: false, isMainFrame: false }), false);
	assert.equal(countsFrame({ allFrames: true, isMainFrame: false }), true);
});

test("the all-frames JS merges beside the iframe-blocked numbers, which stay unchanged", () => {
	const summary = summarizeRuns([{ cssBytes: 1, jsBytes: 2 }]);
	const run = { cssBytes: 3, framesAttached: 1, fullPageCssBytes: 4, fullPageJsBytes: 80, jsBytes: 50 };
	const merged = mergeIntoBaseline({ routes: [{ id: "home" }] }, { home: { path: "/", ...summary, ...summarizeAllFramesRuns(summary, [run]) } });
	assert.deepEqual(merged.routes[0].fetchedJs, { bytes: 2, range: 0 });
	assert.deepEqual(merged.routes[0].fetchedCss, { bytes: 1, range: 0 });
	assert.deepEqual(merged.routes[0].fetchedJsAllFrames, { bytes: 50, range: 0, source: "all-frames" });
	assert.deepEqual(merged.routes[0].fetchedCssAllFrames, { bytes: 3, range: 0, source: "all-frames" });
	assert.deepEqual(merged.routes[0].fetchedJsFullPage, { bytes: 80, range: 0, source: "all-frames" });
	assert.deepEqual(merged.routes[0].fetchedCssFullPage, { bytes: 4, range: 0, source: "all-frames" });
	assert.deepEqual(merged.routes[0].fetchedAllFramesRuns, [run]);
});

test("the all-frames CSS and full-page numbers are their own medians; the viewport JS stays the pre-scroll number", () => {
	const topDocument = summarizeRuns([{ cssBytes: 10, jsBytes: 100 }]);
	const runs = [
		{ cssBytes: 20, framesAttached: 20, fullPageCssBytes: 40, fullPageJsBytes: 21_000, jsBytes: 5_000 },
		{ cssBytes: 22, framesAttached: 20, fullPageCssBytes: 44, fullPageJsBytes: 21_400, jsBytes: 5_100 },
		{ cssBytes: 21, framesAttached: 20, fullPageCssBytes: 41, fullPageJsBytes: 21_200, jsBytes: 5_050 },
	];
	const summary = summarizeAllFramesRuns(topDocument, runs);
	assert.deepEqual(summary.fetchedJsAllFrames, { bytes: 5_050, range: 100, source: "all-frames" });
	assert.deepEqual(summary.fetchedCssAllFrames, { bytes: 21, range: 2, source: "all-frames" });
	assert.deepEqual(summary.fetchedJsFullPage, { bytes: 21_200, range: 400, source: "all-frames" });
	assert.deepEqual(summary.fetchedCssFullPage, { bytes: 41, range: 4, source: "all-frames" });
});

// A minimal DOM for scrollThroughPage: one scroll container that grows once while it is walked,
// the way a page grows when content near the bottom loads.
function withFakeDocument({ clientHeight, scrollHeight, grow, others = true }, callback) {
	const scroller = { clientHeight, scrollHeight, scrollTop: 0, positions: [] };
	const short = { clientHeight: 100, scrollHeight: 150, scrollTop: 0 };
	const root = { clientHeight: 900, scrollHeight: 900, scrollTop: 0 };
	const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, requestAnimationFrame: globalThis.requestAnimationFrame };
	let grown = false;
	Object.defineProperty(scroller, "scrollTop", {
		get() { return this._top ?? 0; },
		set(value) {
			this._top = Math.min(value, this.scrollHeight - this.clientHeight);
			this.positions.push(this._top);
			if (!grown && grow && this._top + this.clientHeight >= this.scrollHeight) { grown = true; this.scrollHeight += grow; }
		},
	});
	globalThis.document = { documentElement: root, querySelectorAll: () => (others ? [short, scroller] : [scroller]), scrollingElement: root };
	globalThis.getComputedStyle = () => ({ overflowY: "auto" });
	globalThis.requestAnimationFrame = (resolve) => setImmediate(resolve);
	return callback(scroller).finally(() => Object.assign(globalThis, saved));
}

test("the scroll walks the largest scroll container a viewport at a time to the bottom, including content that grows", async () => {
	await withFakeDocument({ clientHeight: 900, grow: 1000, scrollHeight: 3000 }, async (scroller) => {
		const result = await scrollThroughPage({ pauseMs: 0 });
		assert.equal(scroller.scrollTop, 3100, "it reaches the bottom of the grown container");
		assert.deepEqual(scroller.positions.slice(0, 3), [900, 1800, 2100], "it moves a viewport at a time, never skipping a band");
		assert.equal(result.scrollHeight, 4000);
		assert.ok(result.steps >= 5);
	});
	await withFakeDocument({ clientHeight: 900, others: false, scrollHeight: 900 }, async () => {
		assert.deepEqual(await scrollThroughPage({ pauseMs: 0 }), { scrollHeight: 900, steps: 0 }, "a page with nothing to scroll is left alone");
	});
});
