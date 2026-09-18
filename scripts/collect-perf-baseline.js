#!/usr/bin/env node

"use strict";

const { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { spawnSync } = require("node:child_process");

const DEFAULT_OUTPUT_PATH = "output/perf-baseline.json";
const DEFAULT_NEXT_DIR = ".next";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const ROUTE_ROW_WITH_SIZES_PATTERN = /^\s*\S+\s+(\S)\s+(.+?)\s{2,}([0-9.]+\s*(?:B|kB|MB))\s+([0-9.]+\s*(?:B|kB|MB))\s*$/u;
const ROUTE_ROW_WITHOUT_SIZES_PATTERN = /^\s*(?:[├└│─]+\s*)?(\S)\s+(\/\S*)\s*$/u;
const ROUTE_KIND_BY_MARKER = new Map([
	[String.fromCodePoint(0x25cb), "static"],
	[String.fromCodePoint(0x25cf), "ssg"],
	[String.fromCodePoint(0x192), "dynamic"],
]);
const FIXED_BASELINE_ROUTES = [
	{ id: "home", path: "/" },
	{ id: "rovo", path: "/rovo" },
	{ id: "studio", path: "/studio" },
	{ id: "components", path: "/components/[category]/[slug]" },
];
const DEFAULT_ROUTE_TIMING_PATHS = {
	components: "/components/ui/button",
	"heavy-visual": "/visual/ripple",
};

function parseArgs(argv) {
	const options = {
		baseUrl: null,
		baselineInputPath: null,
		inputPath: null,
		outputPath: DEFAULT_OUTPUT_PATH,
		requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
		routes: FIXED_BASELINE_ROUTES.map((route) => ({ ...route })),
		routeTimingPaths: { ...DEFAULT_ROUTE_TIMING_PATHS },
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--") {
			continue;
		}
		if (arg === "--input") {
			const value = argv[index + 1];
			if (!value) throw new Error("--input requires a value");
			options.inputPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--input=")) {
			options.inputPath = arg.slice("--input=".length);
			if (!options.inputPath) throw new Error("--input requires a value");
			continue;
		}
		if (arg === "--baseline-input") {
			const value = argv[index + 1];
			if (!value) throw new Error("--baseline-input requires a value");
			options.baselineInputPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--baseline-input=")) {
			options.baselineInputPath = arg.slice("--baseline-input=".length);
			if (!options.baselineInputPath) throw new Error("--baseline-input requires a value");
			continue;
		}
		if (arg === "--output") {
			const value = argv[index + 1];
			if (!value) throw new Error("--output requires a value");
			options.outputPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--output=")) {
			options.outputPath = arg.slice("--output=".length);
			if (!options.outputPath) throw new Error("--output requires a value");
			continue;
		}
		if (arg === "--base-url") {
			const value = argv[index + 1];
			if (!value) throw new Error("--base-url requires a value");
			options.baseUrl = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--base-url=")) {
			options.baseUrl = arg.slice("--base-url=".length);
			if (!options.baseUrl) throw new Error("--base-url requires a value");
			continue;
		}
		if (arg === "--request-timeout-ms") {
			const value = argv[index + 1];
			if (!value) throw new Error("--request-timeout-ms requires a value");
			options.requestTimeoutMs = parseRequestTimeoutMs(value);
			index += 1;
			continue;
		}
		if (arg.startsWith("--request-timeout-ms=")) {
			options.requestTimeoutMs = parseRequestTimeoutMs(arg.slice("--request-timeout-ms=".length));
			continue;
		}
		if (arg === "--route") {
			const value = argv[index + 1];
			if (!value) throw new Error("--route requires a value");
			options.routes.push(parseRouteArg(value));
			index += 1;
			continue;
		}
		if (arg.startsWith("--route=")) {
			const value = arg.slice("--route=".length);
			if (!value) throw new Error("--route requires a value");
			options.routes.push(parseRouteArg(value));
			continue;
		}
		if (arg === "--timing-route") {
			const value = argv[index + 1];
			if (!value) throw new Error("--timing-route requires a value");
			const routeTimingPath = parseTimingRouteArg(value);
			options.routeTimingPaths[routeTimingPath.id] = routeTimingPath.path;
			index += 1;
			continue;
		}
		if (arg.startsWith("--timing-route=")) {
			const value = arg.slice("--timing-route=".length);
			if (!value) throw new Error("--timing-route requires a value");
			const routeTimingPath = parseTimingRouteArg(value);
			options.routeTimingPaths[routeTimingPath.id] = routeTimingPath.path;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

function readJsonFile(inputPath, cwd = process.cwd()) {
	const absolutePath = path.isAbsolute(inputPath)
		? inputPath
		: path.join(cwd, inputPath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function parseRequestTimeoutMs(value) {
	const timeoutMs = Number(value);
	if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
		throw new Error(`Invalid request timeout: ${value}`);
	}
	return timeoutMs;
}

function parseRouteArg(value) {
	const [id, routePath] = value.includes(":")
		? value.split(/:(.*)/u)
		: [value.replace(/^\//u, "").replace(/[^a-z0-9]+/giu, "-") || "home", value];
	if (!id || !routePath) {
		throw new Error(`Invalid route value: ${value}`);
	}
	return {
		id,
		path: routePath,
	};
}

function parseTimingRouteArg(value) {
	const [id, routePath] = value.includes(":")
		? value.split(/:(.*)/u)
		: ["", ""];
	if (!id || !routePath || !routePath.startsWith("/")) {
		throw new Error(`Invalid timing route value: ${value}`);
	}
	return {
		id,
		path: routePath,
	};
}

function parseSizeToBytes(value) {
	const match = /^([0-9.]+)\s*(B|kB|MB)$/iu.exec(String(value).trim());
	if (!match) {
		throw new Error(`Unsupported size value: ${value}`);
	}

	const amount = Number(match[1]);
	const unit = match[2].toLowerCase();
	if (unit === "b") return Math.round(amount);
	if (unit === "kb") return Math.round(amount * 1000);
	if (unit === "mb") return Math.round(amount * 1000 * 1000);
	throw new Error(`Unsupported size unit: ${match[2]}`);
}

function formatBytes(bytes) {
	if (bytes >= 1000 * 1000) {
		return `${(bytes / 1000 / 1000).toFixed(1).replace(/\.0$/u, "")} MB`;
	}
	if (bytes >= 1000) {
		return `${(bytes / 1000).toFixed(1).replace(/\.0$/u, "")} kB`;
	}
	return `${bytes} B`;
}

function parseNextBuildRoutes(buildOutput) {
	const routes = [];
	for (const line of String(buildOutput).split(/\r?\n/u)) {
		const sizeMatch = ROUTE_ROW_WITH_SIZES_PATTERN.exec(line);
		const routeOnlyMatch = sizeMatch ? null : ROUTE_ROW_WITHOUT_SIZES_PATTERN.exec(line);
		const match = sizeMatch ?? routeOnlyMatch;
		if (!match) continue;

		const marker = match[1];
		const kind = ROUTE_KIND_BY_MARKER.get(marker);
		if (!kind) {
			continue;
		}

		const route = {
			kind,
			path: match[2].trim(),
		};
		if (sizeMatch) {
			route.firstLoadJs = {
				bytes: parseSizeToBytes(match[4]),
				display: match[4].trim(),
			};
			route.size = {
				bytes: parseSizeToBytes(match[3]),
				display: match[3].trim(),
			};
		}
		routes.push(route);
	}
	return routes;
}

function walkFiles(rootDir) {
	if (!existsSync(rootDir)) return [];
	const entries = [];
	for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
		const entryPath = path.join(rootDir, entry.name);
		if (entry.isDirectory()) {
			entries.push(...walkFiles(entryPath));
			continue;
		}
		if (entry.isFile()) {
			entries.push(entryPath);
		}
	}
	return entries;
}

function normalizeManifestRouteKey(routeKey) {
	let routePath = routeKey.startsWith("/") ? routeKey : `/${routeKey}`;
	if (routePath === "/page") return "/";
	if (routePath.endsWith("/page")) {
		routePath = routePath.slice(0, -"/page".length) || "/";
	}
	return routePath;
}

function getVisibleRouteAliases(routePath) {
	const aliases = [routePath];
	const optionalCatchAllMatch = /^(.*)\/\[\[\.\.\.[^\]]+\]\]$/u.exec(routePath);
	if (optionalCatchAllMatch) {
		aliases.push(optionalCatchAllMatch[1] || "/");
	}
	return [...new Set(aliases)];
}

function parseClientReferenceManifest(manifestText, manifestPath = "page_client-reference-manifest.js") {
	const assignmentMatch = /globalThis\.__RSC_MANIFEST\["([^"]+)"\]\s*=/u.exec(manifestText);
	if (!assignmentMatch) {
		throw new Error(`Unable to find RSC manifest assignment in ${manifestPath}`);
	}

	let jsonText = manifestText.slice(assignmentMatch.index + assignmentMatch[0].length).trim();
	if (jsonText.endsWith(";")) {
		jsonText = jsonText.slice(0, -1);
	}

	return {
		manifest: JSON.parse(jsonText),
		routeKey: assignmentMatch[1],
	};
}

function collectManifestAssetPaths(manifest) {
	const assetPaths = new Set();
	for (const clientModule of Object.values(manifest.clientModules ?? {})) {
		for (const chunk of clientModule.chunks ?? []) {
			if (typeof chunk === "string" && chunk.startsWith("static/")) {
				assetPaths.add(chunk);
			}
		}
	}
	for (const cssEntries of Object.values(manifest.entryCSSFiles ?? {})) {
		for (const cssEntry of cssEntries ?? []) {
			if (cssEntry?.path) {
				assetPaths.add(cssEntry.path);
			}
		}
	}
	return [...assetPaths].sort();
}

function resolveNextAssetPath({ assetPath, cwd, nextDir }) {
	const candidates = [
		path.join(cwd, nextDir, assetPath),
		path.join(cwd, nextDir, decodeURIComponent(assetPath)),
	];
	return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function sumAssetBytes({ assetPaths, cwd, nextDir }) {
	let bytes = 0;
	for (const assetPath of assetPaths) {
		const absoluteAssetPath = resolveNextAssetPath({ assetPath, cwd, nextDir });
		if (!existsSync(absoluteAssetPath)) {
			throw new Error(`Incomplete manifest measurement: missing asset ${assetPath}`);
		}
		bytes += statSync(absoluteAssetPath).size;
	}
	return bytes;
}

function collectManifestRoutes({ cwd = process.cwd(), nextDir = DEFAULT_NEXT_DIR } = {}) {
	const appManifestRoot = path.join(cwd, nextDir, "server/app");
	const manifestFiles = walkFiles(appManifestRoot).filter((filePath) => {
		return path.basename(filePath) === "page_client-reference-manifest.js";
	});

	const routes = [];
	for (const manifestFile of manifestFiles) {
		const { manifest, routeKey } = parseClientReferenceManifest(readFileSync(manifestFile, "utf8"), manifestFile);
		const routePath = normalizeManifestRouteKey(routeKey);
		if (routePath.startsWith("/api/")) {
			continue;
		}

		const assetPaths = collectManifestAssetPaths(manifest);
		const jsAssets = assetPaths.filter((assetPath) => assetPath.endsWith(".js"));
		const routeJsAssets = jsAssets.filter((assetPath) => assetPath.startsWith("static/chunks/app/"));
		const cssAssets = assetPaths.filter((assetPath) => assetPath.endsWith(".css"));
		const firstLoadJsBytes = sumAssetBytes({ assetPaths: jsAssets, cwd, nextDir });
		const routeJsBytes = sumAssetBytes({
			assetPaths: routeJsAssets.length > 0 ? routeJsAssets : jsAssets,
			cwd,
			nextDir,
		});
		const cssBytes = sumAssetBytes({ assetPaths: cssAssets, cwd, nextDir });

		const routeMeasurement = {
			assetCount: assetPaths.length,
			css: {
				bytes: cssBytes,
				display: formatBytes(cssBytes),
			},
			firstLoadJs: {
				bytes: firstLoadJsBytes,
				display: formatBytes(firstLoadJsBytes),
			},
			kind: "manifest",
			manifestPath: path.relative(cwd, manifestFile),
			path: routePath,
			size: {
				bytes: routeJsBytes,
				display: formatBytes(routeJsBytes),
			},
			source: "client-reference-manifest",
		};

		for (const aliasPath of getVisibleRouteAliases(routePath)) {
			routes.push(aliasPath === routePath
				? routeMeasurement
				: {
					...routeMeasurement,
					aliasOf: routePath,
					path: aliasPath,
				});
		}
	}
	return routes;
}

function mergeRouteMeasurements(buildRoutes, manifestRoutes) {
	const routesByPath = new Map();
	for (const route of buildRoutes) {
		routesByPath.set(route.path, route);
	}
	for (const manifestRoute of manifestRoutes) {
		const buildRoute = routesByPath.get(manifestRoute.path);
		routesByPath.set(manifestRoute.path, {
			...manifestRoute,
			kind: buildRoute?.kind ?? manifestRoute.kind,
		});
	}
	return [...routesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function selectHeavyVisualRoute(routes) {
	const visualRoutes = routes.filter((route) => {
		return (
			route.path === "/visual/[slug]" ||
			route.path === "/preview/visual/[slug]" ||
			route.path.startsWith("/visual/") ||
			route.path.startsWith("/preview/visual/")
		);
	});
	if (visualRoutes.length === 0) {
		return null;
	}
	return visualRoutes
		.slice()
		.sort((left, right) => {
			return (
				(right.firstLoadJs?.bytes ?? 0) - (left.firstLoadJs?.bytes ?? 0) ||
				(right.size?.bytes ?? 0) - (left.size?.bytes ?? 0) ||
				left.path.localeCompare(right.path)
			);
		})[0];
}

function selectBaselineRoutes(routes, targetRoutes = FIXED_BASELINE_ROUTES) {
	const selected = [];
	for (const target of targetRoutes) {
		const route = routes.find((entry) => entry.path === target.path);
		selected.push(route
			? { ...route, id: target.id, status: "measured" }
			: { id: target.id, path: target.path, status: "missing" });
	}

	const heavyVisual = selectHeavyVisualRoute(routes);
	selected.push(heavyVisual
		? { ...heavyVisual, id: "heavy-visual", status: "measured" }
		: { id: "heavy-visual", path: "/visual/[slug]", status: "missing" });

	return selected;
}

function isConcreteRoutePath(routePath) {
	return typeof routePath === "string" && routePath.startsWith("/") && !routePath.includes("[");
}

function getRouteTimingPath(route, routeTimingPaths = DEFAULT_ROUTE_TIMING_PATHS) {
	const configuredPath = routeTimingPaths[route.id];
	if (configuredPath) {
		return configuredPath;
	}
	if (isConcreteRoutePath(route.path)) {
		return route.path;
	}
	return null;
}

function createRouteTimingUrl(baseUrl, routePath) {
	return new URL(routePath, baseUrl).toString();
}

async function fetchRouteLoadTiming({ fetchImpl = globalThis.fetch, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, url } = {}) {
	if (typeof fetchImpl !== "function") {
		throw new Error("Route load timing requires global fetch support.");
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
	const startedAt = performance.now();
	try {
		const response = await fetchImpl(url, {
			headers: {
				"user-agent": "vpk-perf-baseline",
			},
			redirect: "follow",
			signal: controller.signal,
		});
		const bytes = (await response.arrayBuffer()).byteLength;
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const responseMs = Math.round((performance.now() - startedAt) * 10) / 10;
		return {
			bytes,
			display: `${responseMs}ms`,
			httpStatus: response.status,
			responseMs,
			status: "measured",
			url,
		};
	} finally {
		clearTimeout(timeout);
	}
}

async function collectRouteLoadTimings({
	baseUrl,
	fetchRoute = fetchRouteLoadTiming,
	requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
	routes,
	routeTimingPaths = DEFAULT_ROUTE_TIMING_PATHS,
} = {}) {
	if (!baseUrl) {
		return routes;
	}

	return Promise.all(routes.map(async (route) => {
		if (route.status !== "measured") {
			return route;
		}

		const timingPath = getRouteTimingPath(route, routeTimingPaths);
		if (!timingPath) {
			return {
				...route,
				loadTiming: {
					reason: "dynamic-route-needs-timing-route",
					status: "skipped",
				},
			};
		}

		const url = createRouteTimingUrl(baseUrl, timingPath);
		try {
			return {
				...route,
				loadTiming: {
					...(await fetchRoute({ requestTimeoutMs, url })),
					path: timingPath,
				},
			};
		} catch (error) {
			return {
				...route,
				loadTiming: {
					error: error.message ?? String(error),
					path: timingPath,
					status: "failed",
					url,
				},
			};
		}
	}));
}

function createPerfBaseline({
	buildDurationMs = null,
	buildOutput,
	command = "corepack pnpm run build",
	cwd = process.cwd(),
	generatedAt = new Date().toISOString(),
	inputPath = null,
	nextDir = null,
	targetRoutes = FIXED_BASELINE_ROUTES,
} = {}) {
	const buildRoutes = parseNextBuildRoutes(buildOutput);
	const manifestRoutes = nextDir ? collectManifestRoutes({ cwd, nextDir }) : [];
	const routes = mergeRouteMeasurements(buildRoutes, manifestRoutes);
	const selectedRoutes = selectBaselineRoutes(routes, targetRoutes);
	const missingRoutes = selectedRoutes.filter((route) => route.status === "missing");
	const measuredRoutes = selectedRoutes.filter((route) => route.status === "measured");

	return {
		version: 1,
		generatedBy: "scripts/collect-perf-baseline.js",
		generatedAt,
		source: {
			buildDurationMs,
			command,
			inputPath,
		},
		summary: {
			buildRouteCount: buildRoutes.length,
			manifestRouteCount: manifestRoutes.length,
			measuredRouteCount: measuredRoutes.length,
			missingRouteCount: missingRoutes.length,
			parsedRouteCount: routes.length,
			selectedRouteCount: selectedRoutes.length,
		},
		routes: selectedRoutes,
	};
}

function runBuild({ cwd = process.cwd(), run = spawnSync } = {}) {
	const startedAt = Date.now();
	const result = run("corepack", ["pnpm", "run", "build"], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			NEXT_TELEMETRY_DISABLED: "1",
		},
	});
	const output = `${result.stdout || ""}${result.stderr || ""}`;
	if (result.status !== 0) {
		const error = new Error(`corepack pnpm run build failed with exit code ${result.status}`);
		error.output = output;
		throw error;
	}
	return {
		durationMs: Date.now() - startedAt,
		output,
	};
}

function writePerfBaseline({ baseline, cwd = process.cwd(), outputPath = DEFAULT_OUTPUT_PATH } = {}) {
	const absoluteOutputPath = path.join(cwd, outputPath);
	mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
	writeFileSync(absoluteOutputPath, `${JSON.stringify(baseline, null, "\t")}\n`);
	return absoluteOutputPath;
}

function printHelp() {
	console.log([
		"Usage: node scripts/collect-perf-baseline.js [--input build.log] [--baseline-input output/perf-baseline.json] [--output output/perf-baseline.json] [--route id:/path] [--base-url http://localhost:3000] [--timing-route id:/concrete/path]",
		"",
		"Runs `corepack pnpm run build` by default, parses the Next.js route-size table, and writes a route baseline.",
		"Use --input to parse a captured build log without running a build.",
		"Use --baseline-input with --base-url to add HTTP load timing to an existing baseline.",
		"Use --base-url to also record HTTP load timing for measured routes.",
	].join("\n"));
}

async function main(argv = process.argv.slice(2), cwd = process.cwd()) {
	const options = parseArgs(argv);
	if (options.help) {
		printHelp();
		return;
	}
	if (options.baselineInputPath && options.inputPath) {
		throw new Error("--baseline-input cannot be combined with --input.");
	}

	const source = !options.baselineInputPath && options.inputPath
		? {
			durationMs: null,
			output: readFileSync(path.join(cwd, options.inputPath), "utf8"),
		}
		: options.baselineInputPath
			? null
			: runBuild({ cwd });

	const baseline = options.baselineInputPath
		? readJsonFile(options.baselineInputPath, cwd)
		: createPerfBaseline({
			buildDurationMs: source.durationMs,
			buildOutput: source.output,
			cwd,
			inputPath: options.inputPath,
			nextDir: DEFAULT_NEXT_DIR,
			targetRoutes: options.routes,
		});
	baseline.source = baseline.source ?? {};
	baseline.summary = baseline.summary ?? {};
	if (options.baseUrl) {
		baseline.source.baseUrl = options.baseUrl;
		baseline.source.loadTimingGeneratedAt = new Date().toISOString();
		baseline.source.requestTimeoutMs = options.requestTimeoutMs;
		baseline.routes = await collectRouteLoadTimings({
			baseUrl: options.baseUrl,
			requestTimeoutMs: options.requestTimeoutMs,
			routes: baseline.routes,
			routeTimingPaths: options.routeTimingPaths,
		});
		baseline.summary.loadTimedRouteCount = baseline.routes
			.filter((route) => route.loadTiming?.status === "measured")
			.length;
		baseline.summary.loadTimingFailureCount = baseline.routes
			.filter((route) => route.loadTiming?.status === "failed")
			.length;
	}
	if (baseline.summary.parsedRouteCount === 0 || baseline.summary.measuredRouteCount === 0) {
		throw new Error("No route measurements were collected from the build output or .next manifests.");
	}
	if (baseline.summary.missingRouteCount > 0) {
		const missingRoutes = baseline.routes
			.filter((route) => route.status === "missing")
			.map((route) => `${route.id}:${route.path}`)
			.join(", ");
		throw new Error(`Performance baseline is missing target routes: ${missingRoutes}`);
	}
	if (baseline.summary.loadTimingFailureCount > 0) {
		const failedRoutes = baseline.routes
			.filter((route) => route.loadTiming?.status === "failed")
			.map((route) => `${route.id}:${route.loadTiming.path} (${route.loadTiming.error})`)
			.join(", ");
		throw new Error(`Performance baseline route load timing failed: ${failedRoutes}`);
	}
	const absoluteOutputPath = writePerfBaseline({
		baseline,
		cwd,
		outputPath: options.outputPath,
	});
	const missingSuffix = baseline.summary.missingRouteCount > 0
		? ` (${baseline.summary.missingRouteCount} target route${baseline.summary.missingRouteCount === 1 ? "" : "s"} missing)`
		: "";
	console.log(`Wrote ${path.relative(cwd, absoluteOutputPath)} from ${baseline.summary.parsedRouteCount} parsed route${baseline.summary.parsedRouteCount === 1 ? "" : "s"}${missingSuffix}.`);
}

if (require.main === module) {
	main().catch((error) => {
		console.error(error.message);
		if (error.output) {
			console.error(error.output);
		}
		process.exitCode = 1;
	});
}

module.exports = {
	DEFAULT_OUTPUT_PATH,
	DEFAULT_REQUEST_TIMEOUT_MS,
	DEFAULT_ROUTE_TIMING_PATHS,
	FIXED_BASELINE_ROUTES,
	collectManifestRoutes,
	collectRouteLoadTimings,
	createRouteTimingUrl,
	createPerfBaseline,
	fetchRouteLoadTiming,
	formatBytes,
	getRouteTimingPath,
	isConcreteRoutePath,
	mergeRouteMeasurements,
	parseArgs,
	parseClientReferenceManifest,
	parseNextBuildRoutes,
	parseRouteArg,
	parseTimingRouteArg,
	parseSizeToBytes,
	runBuild,
	main,
	selectBaselineRoutes,
	selectHeavyVisualRoute,
	writePerfBaseline,
};
