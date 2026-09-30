import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { findDynamicAssetPaths, inlinePublicAssets, resolveTarget, selectFontFaces } from "./build-artifact-html.mjs";
import { installStorageFallback, invokeInBanner } from "./lib/artifact-runtime.mjs";
import { installForecastFallback } from "./lib/artifact-targets/awake.mjs";

const HOUR_MS = 60 * 60 * 1000;
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast?latitude=-33.8688&longitude=151.2093&current=temperature_2m";

function forecastFor(start) {
	return {
		fields: ["temperature_2m", "is_day"],
		hours: 2,
		locations: { "-33.8688,151.2093": { is_day: [1, 0], temperature_2m: [17.2, 16.1] } },
		start,
	};
}

/** Runs a serialized banner in a fresh context whose network always fails, like the viewer CSP. */
function runBannerWithBlockedNetwork(banner) {
	const context = vm.createContext({
		Date,
		Response,
		URL,
		fetch: async () => {
			throw new TypeError("Failed to fetch");
		},
	});
	context.globalThis = context;
	vm.runInContext(banner, context);
	return context;
}

test("resolveTarget maps a demo to its website demo module and slug", () => {
	const target = resolveTarget({ demo: "arts/awake" }, "/repo");
	assert.equal(target.entryFile, "/repo/components/website/demos/arts/awake-demo.tsx");
	assert.equal(target.hookKey, "arts/awake");
	assert.equal(target.slug, "awake");
	assert.equal(resolveTarget({ entry: "components/foo/bar-card.tsx" }, "/repo").slug, "bar-card");
	assert.throws(() => resolveTarget({ demo: "awake" }, "/repo"), /<category>\/<slug>/u);
	assert.throws(() => resolveTarget({}, "/repo"), /--demo/u);
});

test("selectFontFaces keeps wanted subsets of referenced families only", () => {
	const css = [
		"/* cyrillic */\n@font-face { font-family: 'Atlassian Sans'; src: url(a.woff2); }",
		"/* latin */\n@font-face { font-family: 'Atlassian Sans'; src: url(b.woff2); }",
		"/* latin */\n@font-face { font-family: 'DotGothic16'; src: url(c.woff2); }",
		"@font-face { font-family: 'BBH Bartle'; src: url(d.woff2); }",
	].join("\n");
	const kept = selectFontFaces(css, { isUsed: (family) => family !== "DotGothic16" });
	assert.deepEqual(kept.map((block) => block.match(/url\((\w)/u)[1]), ["b", "d"]);
});

test("inlinePublicAssets embeds existing public files and leaves the rest untouched", async () => {
	const publicDir = await mkdtemp(path.join(tmpdir(), "artifact-public-"));
	try {
		await mkdir(path.join(publicDir, "sound"));
		await writeFile(path.join(publicDir, "sound/click.mp3"), "abc");
		const inlined = new Set();
		const output = await inlinePublicAssets(`play("/sound/click.mp3"); img("/missing.png"); url(/sound/click.mp3); logo("/sound/click.mp3?v=transparent-bg")`, { inlined, publicDir });
		assert.equal(output, `play("data:audio/mpeg;base64,YWJj"); img("/missing.png"); url(data:audio/mpeg;base64,YWJj); logo("data:audio/mpeg;base64,YWJj")`);
		assert.deepEqual([...inlined], ["/sound/click.mp3"]);
	} finally {
		await rm(publicDir, { force: true, recursive: true });
	}
});

test("findDynamicAssetPaths reports runtime-built public/ paths but not API routes", async () => {
	const publicDir = await mkdtemp(path.join(tmpdir(), "artifact-public-"));
	try {
		await mkdir(path.join(publicDir, "3p"));
		const bundle = "const a=`/3p/${e}/24.svg`,b=`/api/items/${id}`,c=`/3p/${e}/24.svg`,d=`${base}/x.svg`,f=\"/3p/jira/24.svg\";";
		assert.deepEqual(await findDynamicAssetPaths(bundle, { publicDir }), ["/3p/${e}/24.svg"]);
	} finally {
		await rm(publicDir, { force: true, recursive: true });
	}
});

test("installStorageFallback swaps in memory storage when access throws", () => {
	const scope = {};
	Object.defineProperty(scope, "localStorage", {
		configurable: true,
		get() {
			throw new DOMException("The document is sandboxed", "SecurityError");
		},
	});
	assert.equal(installStorageFallback(scope), true);
	scope.localStorage.setItem("theme", "dark");
	assert.equal(scope.localStorage.getItem("theme"), "dark");
	assert.equal(scope.localStorage.length, 1);
	assert.equal(scope.localStorage.getItem("missing"), null);

	const working = { localStorage: { getItem: () => null } };
	assert.equal(installStorageFallback(working), false);
});

test("serialized forecast fallback answers blocked Open-Meteo requests with the current hour", async () => {
	const context = runBannerWithBlockedNetwork(invokeInBanner(installForecastFallback, forecastFor(Date.now() - HOUR_MS - 60_000)));
	const response = await context.fetch(FORECAST_URL);
	const { current } = await response.json();
	assert.equal(current.temperature_2m, 16.1);
	assert.equal(current.is_day, 0);
});

test("forecast fallback rethrows outside the forecast, for unknown cities, and for other hosts", async () => {
	const expired = runBannerWithBlockedNetwork(invokeInBanner(installForecastFallback, forecastFor(Date.now() - 3 * HOUR_MS)));
	await assert.rejects(expired.fetch(FORECAST_URL), /Failed to fetch/u);

	const current = runBannerWithBlockedNetwork(invokeInBanner(installForecastFallback, forecastFor(Date.now())));
	await assert.rejects(current.fetch(FORECAST_URL.replace("-33.8688", "1.5")), /Failed to fetch/u);
	await assert.rejects(current.fetch("https://geocoding-api.open-meteo.com/v1/search?name=Oslo"), /Failed to fetch/u);
});

test("forecast fallback passes live responses through untouched", async () => {
	const scope = { fetch: async () => new Response("live") };
	installForecastFallback(forecastFor(Date.now()), scope);
	assert.equal(await (await scope.fetch(FORECAST_URL)).text(), "live");
});
