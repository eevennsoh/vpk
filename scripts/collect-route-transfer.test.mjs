import assert from "node:assert/strict";
import test from "node:test";

import { TRANSFER_ROUTES, assertNavigationOk, classifyAsset, median, mergeIntoBaseline, parseArgs, summarizeRuns } from "./collect-route-transfer.mjs";

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
