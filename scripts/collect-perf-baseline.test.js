const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	collectManifestRoutes,
	collectRouteLoadTimings,
	createRouteTimingUrl,
	createPerfBaseline,
	getRouteTimingPath,
	isConcreteRoutePath,
	main,
	parseArgs,
	parseClientReferenceManifest,
	parseNextBuildRoutes,
	parseRouteArg,
	parseTimingRouteArg,
	parseSizeToBytes,
	runBuild,
	selectBaselineRoutes,
	writePerfBaseline,
} = require("./collect-perf-baseline");

const rowPrefix = String.fromCodePoint(0x251c);
const staticMarker = String.fromCodePoint(0x25cb);
const ssgMarker = String.fromCodePoint(0x25cf);
const dynamicMarker = String.fromCodePoint(0x192);

function buildRouteRow(marker, routePath, size, firstLoadJs) {
	return `${rowPrefix} ${marker} ${routePath}                              ${size}         ${firstLoadJs}`;
}

test("parseArgs supports captured input and custom route targets", () => {
	assert.deepEqual(parseArgs([
		"--input",
		"build.log",
		"--output=tmp/perf.json",
		"--route",
		"docs:/docs",
		"--base-url",
		"http://localhost:3000",
		"--request-timeout-ms=2500",
		"--timing-route",
		"components:/components/ui/avatar",
	]), {
		baseUrl: "http://localhost:3000",
		baselineInputPath: null,
		inputPath: "build.log",
		outputPath: "tmp/perf.json",
		requestTimeoutMs: 2500,
		routes: [
			{ id: "home", path: "/" },
			{ id: "rovo", path: "/rovo" },
			{ id: "studio", path: "/studio" },
			{ id: "components", path: "/components/[category]/[slug]" },
			{ id: "docs", path: "/docs" },
		],
		routeTimingPaths: {
			components: "/components/ui/avatar",
			"heavy-visual": "/visual/ripple",
		},
	});
	assert.deepEqual(parseRouteArg("/settings"), {
		id: "settings",
		path: "/settings",
	});
	assert.deepEqual(parseTimingRouteArg("heavy-visual:/visual/ripple"), {
		id: "heavy-visual",
		path: "/visual/ripple",
	});
	assert.throws(() => parseArgs(["--input"]), /requires a value/u);
	assert.throws(() => parseArgs(["--baseline-input"]), /requires a value/u);
	assert.throws(() => parseArgs(["--request-timeout-ms=0"]), /Invalid request timeout/u);
	assert.throws(() => parseTimingRouteArg("heavy-visual:visual/ripple"), /Invalid timing route value/u);
});

test("parseArgs supports adding timings to an existing baseline", () => {
	assert.deepEqual(parseArgs([
		"--baseline-input",
		"output/perf-baseline.json",
		"--output",
		"output/perf-baseline.timed.json",
		"--base-url=http://localhost:3000",
	]), {
		baseUrl: "http://localhost:3000",
		baselineInputPath: "output/perf-baseline.json",
		inputPath: null,
		outputPath: "output/perf-baseline.timed.json",
		requestTimeoutMs: 10_000,
		routes: [
			{ id: "home", path: "/" },
			{ id: "rovo", path: "/rovo" },
			{ id: "studio", path: "/studio" },
			{ id: "components", path: "/components/[category]/[slug]" },
		],
		routeTimingPaths: {
			components: "/components/ui/button",
			"heavy-visual": "/visual/ripple",
		},
	});
});

test("parseSizeToBytes handles Next bundle size units", () => {
	assert.equal(parseSizeToBytes("0 B"), 0);
	assert.equal(parseSizeToBytes("12.4 kB"), 12400);
	assert.equal(parseSizeToBytes("1.2 MB"), 1200000);
});

test("parseNextBuildRoutes extracts route size rows from Next output", () => {
	const routes = parseNextBuildRoutes([
		"Route (app)                              Size     First Load JS",
		buildRouteRow(staticMarker, "/", "12.3 kB", "181 kB"),
		buildRouteRow(dynamicMarker, "/api/health", "0 B", "0 B"),
		buildRouteRow(ssgMarker, "/visual/ripple", "78.2 kB", "412 kB"),
		"+ First Load JS shared by all            145 kB",
	].join("\n"));

	assert.deepEqual(routes, [
		{
			firstLoadJs: { bytes: 181000, display: "181 kB" },
			kind: "static",
			path: "/",
			size: { bytes: 12300, display: "12.3 kB" },
		},
		{
			firstLoadJs: { bytes: 0, display: "0 B" },
			kind: "dynamic",
			path: "/api/health",
			size: { bytes: 0, display: "0 B" },
		},
		{
			firstLoadJs: { bytes: 412000, display: "412 kB" },
			kind: "ssg",
			path: "/visual/ripple",
			size: { bytes: 78200, display: "78.2 kB" },
		},
	]);
});

test("parseNextBuildRoutes extracts current route-only rows from Next output", () => {
	const routes = parseNextBuildRoutes([
		"Route (app)",
		"├ ○ /",
		"├ ƒ /api/health",
		"└ ● /visual/[slug]",
	].join("\n"));

	assert.deepEqual(routes, [
		{ kind: "static", path: "/" },
		{ kind: "dynamic", path: "/api/health" },
		{ kind: "ssg", path: "/visual/[slug]" },
	]);
});

test("parseClientReferenceManifest extracts manifest key and payload", () => {
	const manifestPayload = {
		clientModules: {
			"/repo/app/page.tsx": {
				chunks: ["1", "static/chunks/app/page.js"],
			},
		},
		entryCSSFiles: {},
	};
	const parsed = parseClientReferenceManifest(
		`globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/page"]=${JSON.stringify(manifestPayload)};`,
	);

	assert.equal(parsed.routeKey, "/page");
	assert.deepEqual(parsed.manifest, manifestPayload);
});

test("manifest measurement rejects missing referenced assets instead of reporting smaller totals", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-perf-incomplete-"));
	try {
		const directory = path.join(cwd, ".next/server/app");
		mkdirSync(directory, { recursive: true });
		writeFileSync(path.join(directory, "page_client-reference-manifest.js"),
			`globalThis.__RSC_MANIFEST["/page"]=${JSON.stringify({ clientModules: { page: { chunks: ["static/chunks/missing.js"] } } })};`);
		assert.throws(() => collectManifestRoutes({ cwd }), /Incomplete manifest measurement: missing asset/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("collectManifestRoutes measures client assets and aliases optional catch-all roots", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-perf-manifest-"));
	try {
		const manifestDir = path.join(cwd, ".next/server/app/rovo/[[...id]]");
		const chunkDir = path.join(cwd, ".next/static/chunks/app/rovo/[[...id]]");
		const sharedDir = path.join(cwd, ".next/static/chunks");
		const cssDir = path.join(cwd, ".next/static/css");
		mkdirSync(manifestDir, { recursive: true });
		mkdirSync(chunkDir, { recursive: true });
		mkdirSync(sharedDir, { recursive: true });
		mkdirSync(cssDir, { recursive: true });
		writeFileSync(path.join(sharedDir, "shared.js"), "a".repeat(100));
		writeFileSync(path.join(chunkDir, "page.js"), "b".repeat(40));
		writeFileSync(path.join(cssDir, "rovo.css"), "c".repeat(10));
		writeFileSync(
			path.join(manifestDir, "page_client-reference-manifest.js"),
			[
				"globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});",
				`globalThis.__RSC_MANIFEST["/rovo/[[...id]]/page"]=${JSON.stringify({
					clientModules: {
						"/repo/app/rovo/page.tsx": {
							chunks: [
								"1",
								"static/chunks/shared.js",
								"2",
								"static/chunks/app/rovo/%5B%5B...id%5D%5D/page.js",
							],
						},
					},
					entryCSSFiles: {
						"/repo/app/rovo/[[...id]]/page": [
							{ inlined: false, path: "static/css/rovo.css" },
						],
					},
				})};`,
			].join(""),
		);

		const routes = collectManifestRoutes({ cwd, nextDir: ".next" });
		const rootRoute = routes.find((route) => route.path === "/rovo");
		const sourceRoute = routes.find((route) => route.path === "/rovo/[[...id]]");

		assert.equal(routes.length, 2);
		assert.equal(rootRoute.aliasOf, "/rovo/[[...id]]");
		assert.equal(sourceRoute.firstLoadJs.bytes, 140);
		assert.equal(sourceRoute.size.bytes, 40);
		assert.equal(sourceRoute.css.bytes, 10);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("createPerfBaseline selects fixed routes and the heaviest visual route", () => {
	const output = [
		buildRouteRow(staticMarker, "/", "12 kB", "180 kB"),
		buildRouteRow(staticMarker, "/rovo", "20 kB", "250 kB"),
		buildRouteRow(staticMarker, "/studio", "22 kB", "260 kB"),
		buildRouteRow(staticMarker, "/components/[category]/[slug]", "30 kB", "280 kB"),
		buildRouteRow(ssgMarker, "/visual/ripple", "40 kB", "300 kB"),
		buildRouteRow(ssgMarker, "/preview/visual/mesh", "50 kB", "350 kB"),
	].join("\n");
	const baseline = createPerfBaseline({
		buildOutput: output,
		generatedAt: "2026-07-04T00:00:00.000Z",
	});

	assert.equal(baseline.summary.parsedRouteCount, 6);
	assert.equal(baseline.summary.missingRouteCount, 0);
	assert.deepEqual(
		baseline.routes.map((route) => `${route.id}:${route.path}:${route.status}`),
		[
			"home:/:measured",
			"rovo:/rovo:measured",
			"studio:/studio:measured",
			"components:/components/[category]/[slug]:measured",
			"heavy-visual:/preview/visual/mesh:measured",
		],
	);
});

test("createPerfBaseline uses manifest measurements when build output has no size table", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-perf-baseline-manifest-"));
	try {
		for (const routePath of ["page", "rovo/[[...id]]/page", "studio/[[...id]]/page", "components/[category]/[slug]/page", "visual/[slug]/page"]) {
			const manifestDir = path.join(cwd, ".next/server/app", path.dirname(routePath));
			const appChunkDir = path.join(cwd, ".next/static/chunks/app", path.dirname(routePath));
			mkdirSync(manifestDir, { recursive: true });
			mkdirSync(appChunkDir, { recursive: true });
			writeFileSync(path.join(appChunkDir, "page.js"), "x".repeat(routePath.length));
			writeFileSync(
				path.join(manifestDir, "page_client-reference-manifest.js"),
				`globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/${routePath}"]=${JSON.stringify({
					clientModules: {
						[`/repo/app/${routePath}.tsx`]: {
							chunks: ["1", `static/chunks/app/${encodeURI(path.dirname(routePath))}/page.js`],
						},
					},
					entryCSSFiles: {},
				})};`,
			);
		}

		const baseline = createPerfBaseline({
			buildOutput: [
				"Route (app)",
				"├ ○ /",
				"├ ○ /rovo",
				"├ ○ /studio",
				"├ ○ /components/[category]/[slug]",
				"└ ○ /visual/[slug]",
			].join("\n"),
			cwd,
			generatedAt: "2026-07-04T00:00:00.000Z",
			nextDir: ".next",
		});

		assert.equal(baseline.summary.buildRouteCount, 5);
		assert.equal(baseline.summary.missingRouteCount, 0);
		assert.equal(baseline.routes.every((route) => route.status === "measured"), true);
		assert.equal(baseline.routes.find((route) => route.id === "rovo").aliasOf, "/rovo/[[...id]]");
		assert.ok(baseline.routes.find((route) => route.id === "components").firstLoadJs.bytes > 0);
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("selectBaselineRoutes records missing route targets", () => {
	const selected = selectBaselineRoutes([], [{ id: "home", path: "/" }]);
	assert.deepEqual(selected, [
		{ id: "home", path: "/", status: "missing" },
		{ id: "heavy-visual", path: "/visual/[slug]", status: "missing" },
	]);
});

test("route load timing maps dynamic baseline routes to concrete timing paths", async () => {
	const routes = [
		{
			id: "home",
			path: "/",
			status: "measured",
		},
		{
			id: "components",
			path: "/components/[category]/[slug]",
			status: "measured",
		},
		{
			id: "unknown-dynamic",
			path: "/items/[id]",
			status: "measured",
		},
		{
			id: "missing",
			path: "/missing",
			status: "missing",
		},
	];
	const calls = [];
	const timedRoutes = await collectRouteLoadTimings({
		baseUrl: "http://localhost:3000",
		fetchRoute: async ({ requestTimeoutMs, url }) => {
			calls.push({ requestTimeoutMs, url });
			return {
				bytes: 123,
				display: "12.3ms",
				httpStatus: 200,
				responseMs: 12.3,
				status: "measured",
				url,
			};
		},
		requestTimeoutMs: 2500,
		routes,
		routeTimingPaths: {
			components: "/components/ui/button",
		},
	});

	assert.equal(isConcreteRoutePath("/components/ui/button"), true);
	assert.equal(isConcreteRoutePath("/components/[category]/[slug]"), false);
	assert.equal(getRouteTimingPath(routes[0]), "/");
	assert.equal(getRouteTimingPath(routes[1], { components: "/components/ui/button" }), "/components/ui/button");
	assert.equal(getRouteTimingPath(routes[2], {}), null);
	assert.equal(createRouteTimingUrl("http://localhost:3000/base", "/studio"), "http://localhost:3000/studio");
	assert.deepEqual(calls, [
		{
			requestTimeoutMs: 2500,
			url: "http://localhost:3000/",
		},
		{
			requestTimeoutMs: 2500,
			url: "http://localhost:3000/components/ui/button",
		},
	]);
	assert.deepEqual(timedRoutes.map((route) => route.loadTiming?.status ?? route.status), [
		"measured",
		"measured",
		"skipped",
		"missing",
	]);
	assert.equal(timedRoutes[1].loadTiming.path, "/components/ui/button");
	assert.equal(timedRoutes[2].loadTiming.reason, "dynamic-route-needs-timing-route");
});

test("route load timing records failures without throwing during collection", async () => {
	const timedRoutes = await collectRouteLoadTimings({
		baseUrl: "http://localhost:3000",
		fetchRoute: async () => {
			throw new Error("connection refused");
		},
		routes: [{
			id: "home",
			path: "/",
			status: "measured",
		}],
	});

	assert.deepEqual(timedRoutes[0].loadTiming, {
		error: "connection refused",
		path: "/",
		status: "failed",
		url: "http://localhost:3000/",
	});
});

test("main can add route load timings to an existing baseline", async () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-perf-baseline-timing-"));
	const server = http.createServer((request, response) => {
		response.writeHead(200, { "content-type": "text/html" });
		response.end(`<html><body>${request.url}</body></html>`);
	});

	try {
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		const { port } = server.address();
		const baselinePath = "baseline.json";
		const outputPath = "timed-baseline.json";
		writeFileSync(path.join(cwd, baselinePath), `${JSON.stringify({
			version: 1,
			generatedBy: "scripts/collect-perf-baseline.js",
			source: {
				buildDurationMs: 100,
				command: "corepack pnpm run build",
				inputPath: null,
			},
			summary: {
				measuredRouteCount: 2,
				missingRouteCount: 0,
				parsedRouteCount: 2,
				selectedRouteCount: 2,
			},
			routes: [
				{
					id: "home",
					path: "/",
					status: "measured",
				},
				{
					id: "components",
					path: "/components/[category]/[slug]",
					status: "measured",
				},
			],
		}, null, "\t")}\n`);

		await main([
			"--baseline-input",
			baselinePath,
			"--output",
			outputPath,
			"--base-url",
			`http://127.0.0.1:${port}`,
			"--request-timeout-ms",
			"2000",
		], cwd);

		const baseline = JSON.parse(readFileSync(path.join(cwd, outputPath), "utf8"));
		assert.equal(baseline.summary.loadTimedRouteCount, 2);
		assert.equal(baseline.summary.loadTimingFailureCount, 0);
		assert.equal(baseline.source.baseUrl, `http://127.0.0.1:${port}`);
		assert.equal(baseline.source.requestTimeoutMs, 2000);
		assert.equal(baseline.routes[0].loadTiming.status, "measured");
		assert.equal(baseline.routes[0].loadTiming.path, "/");
		assert.equal(baseline.routes[1].loadTiming.path, "/components/ui/button");
		assert.equal(baseline.routes[1].loadTiming.httpStatus, 200);
	} finally {
		await new Promise((resolve) => server.close(resolve));
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("runBuild uses the pinned corepack pnpm path", () => {
	const calls = [];
	const result = runBuild({
		cwd: "/repo",
		run(command, args, options) {
			calls.push({ args, command, options });
			return {
				status: 0,
				stdout: "build ok\n",
				stderr: "",
			};
		},
	});

	assert.equal(result.output, "build ok\n");
	assert.equal(result.durationMs >= 0, true);
	assert.equal(calls[0].command, "corepack");
	assert.deepEqual(calls[0].args, ["pnpm", "run", "build"]);
	assert.equal(calls[0].options.cwd, "/repo");
	assert.equal(calls[0].options.encoding, "utf8");
	assert.equal(calls[0].options.env.NEXT_TELEMETRY_DISABLED, "1");
});

test("runBuild reports the pinned build command when it fails", () => {
	assert.throws(() => runBuild({
		run() {
			return {
				status: 1,
				stdout: "",
				stderr: "failed\n",
			};
		},
	}), /corepack pnpm run build failed with exit code 1/u);
});

test("writePerfBaseline writes formatted JSON", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-perf-baseline-"));
	try {
		const outputPath = "output/perf-baseline.json";
		const absolutePath = writePerfBaseline({
			baseline: { version: 1, routes: [] },
			cwd,
			outputPath,
		});
		assert.equal(absolutePath, path.join(cwd, outputPath));
		assert.equal(readFileSync(absolutePath, "utf8"), "{\n\t\"version\": 1,\n\t\"routes\": []\n}\n");
	} finally {
		rmSync(cwd, { force: true, recursive: true });
	}
});
