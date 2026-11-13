#!/usr/bin/env node

"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");
const { FIXED_BASELINE_ROUTES } = require("./collect-perf-baseline");

const DEFAULT_INPUT_PATH = "output/perf-baseline.json";
const DEFAULT_BUILD_DURATION_BUDGET = {
	failureMs: 180_000,
	warningMs: 120_000,
};

// Every route the collector measures by default must have a budget here; a measured fixed
// route without one fails, so a newly collected route cannot pass unchecked.
const FIXED_ROUTE_IDS = [...FIXED_BASELINE_ROUTES.map((route) => route.id), "heavy-visual"];

// Route budgets live in perf-route-budgets.json, a shrink-only baseline: a unit test fails when a
// value rises above the merge base. They were re-baselined on 2026-11-13 to about 3% over a
// production build of main, as a ceiling that stops further growth. The file's "targets" are the
// earlier limits the bundle should return to: CSS 700,000 bytes per route (set in b565d0f57,
// July 2026) and Rovo first-load JS 7,100,000 bytes.
const ROUTE_BUDGETS_PATH = path.join(__dirname, "perf-route-budgets.json");
const { routes: DEFAULT_ROUTE_BUDGETS, targets: ROUTE_BUDGET_TARGETS } = JSON.parse(readFileSync(ROUTE_BUDGETS_PATH, "utf8"));

// Budget values that are higher than in the base copy of perf-route-budgets.json. A route or metric
// that the base budgets and the current file drops counts as raised (to no limit at all).
function findRaisedBudgets(baseRoutes, currentRoutes = DEFAULT_ROUTE_BUDGETS) {
	const raised = [];
	for (const [routeId, baseBudget] of Object.entries(baseRoutes ?? {})) {
		for (const [metricName, baseLimit] of Object.entries(baseBudget)) {
			const limit = currentRoutes[routeId]?.[metricName];
			if (typeof limit !== "number") {
				raised.push({ baseLimit, limit: null, metricName, routeId });
			} else if (limit > baseLimit) {
				raised.push({ baseLimit, limit, metricName, routeId });
			}
		}
	}
	return raised;
}

function formatRaisedBudget({ baseLimit, limit, metricName, routeId }) {
	return `${routeId}.${metricName} ${baseLimit} -> ${limit === null ? "removed" : limit}`;
}

function parseArgs(argv) {
	const options = {
		inputPath: DEFAULT_INPUT_PATH,
		warnOnly: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--input") {
			const value = argv[index + 1];
			if (!value) throw new Error("--input requires a value");
			options.inputPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--input=")) {
			const value = arg.slice("--input=".length);
			if (!value) throw new Error("--input requires a value");
			options.inputPath = value;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}
		if (arg === "--warn-only") {
			options.warnOnly = true;
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

function getMetricValue(route, metricName) {
	if (metricName === "assetCount") {
		return route.assetCount;
	}
	if (metricName === "cssBytes") {
		return route.css?.bytes;
	}
	if (metricName === "firstLoadJsBytes") {
		return route.firstLoadJs?.bytes;
	}
	if (metricName === "routeJsBytes") {
		return route.size?.bytes;
	}
	return undefined;
}

function formatMetricName(metricName) {
	if (metricName === "buildDurationMs") return "build duration";
	if (metricName === "assetCount") return "asset count";
	if (metricName === "cssBytes") return "CSS bytes";
	if (metricName === "firstLoadJsBytes") return "first-load JS bytes";
	if (metricName === "routeJsBytes") return "route JS bytes";
	return metricName;
}

function formatDurationMs(durationMs) {
	if (durationMs >= 60_000) {
		return `${(durationMs / 1000 / 60).toFixed(1).replace(/\.0$/u, "")}m`;
	}
	return `${(durationMs / 1000).toFixed(1).replace(/\.0$/u, "")}s`;
}

function evaluateBuildDurationBudget(
	baseline,
	buildDurationBudget = DEFAULT_BUILD_DURATION_BUDGET,
) {
	const durationMs = baseline.source?.buildDurationMs;
	if (typeof durationMs !== "number") {
		return {
			failures: [],
			warnings: [],
		};
	}

	if (durationMs > buildDurationBudget.failureMs) {
		return {
			failures: [{
				limit: buildDurationBudget.failureMs,
				metricName: "buildDurationMs",
				type: "build-duration-over-budget",
				value: durationMs,
			}],
			warnings: [],
		};
	}

	if (durationMs > buildDurationBudget.warningMs) {
		return {
			failures: [],
			warnings: [{
				failureLimit: buildDurationBudget.failureMs,
				metricName: "buildDurationMs",
				type: "build-duration-warning",
				value: durationMs,
				warningLimit: buildDurationBudget.warningMs,
			}],
		};
	}

	return {
		failures: [],
		warnings: [],
	};
}

function evaluatePerfBaselineBudget(
	baseline,
	routeBudgets = DEFAULT_ROUTE_BUDGETS,
	buildDurationBudget = DEFAULT_BUILD_DURATION_BUDGET,
) {
	const routesById = new Map((baseline.routes ?? []).map((route) => [route.id, route]));
	const failures = [];

	for (const [routeId, budget] of Object.entries(routeBudgets)) {
		const route = routesById.get(routeId);
		if (!route) {
			failures.push({
				routeId,
				type: "missing-route",
			});
			continue;
		}
		if (route.status !== "measured") {
			failures.push({
				routeId,
				status: route.status,
				type: "unmeasured-route",
			});
			continue;
		}

		for (const [metricName, limit] of Object.entries(budget)) {
			const value = getMetricValue(route, metricName);
			if (typeof value !== "number") {
				failures.push({
					metricName,
					routeId,
					type: "missing-metric",
				});
				continue;
			}
			if (value > limit) {
				failures.push({
					limit,
					metricName,
					routeId,
					type: "over-budget",
					value,
				});
			}
		}
	}

	for (const route of baseline.routes ?? []) {
		if (route.status === "measured" && FIXED_ROUTE_IDS.includes(route.id) && !Object.hasOwn(routeBudgets, route.id)) {
			failures.push({
				routeId: route.id,
				type: "unbudgeted-route",
			});
		}
	}

	return [
		...failures,
		...evaluateRouteLoadTimingFailures(baseline),
		...evaluateBuildDurationBudget(baseline, buildDurationBudget).failures,
	];
}

function evaluateRouteLoadTimingFailures(baseline) {
	if (!baseline.source?.baseUrl) {
		return [];
	}

	const failures = [];
	for (const route of baseline.routes ?? []) {
		if (route.status !== "measured") {
			continue;
		}
		if (!route.loadTiming) {
			failures.push({
				routeId: route.id,
				type: "missing-load-timing",
			});
			continue;
		}
		if (route.loadTiming.status === "failed") {
			failures.push({
				error: route.loadTiming.error,
				routeId: route.id,
				timingPath: route.loadTiming.path,
				type: "load-timing-failed",
			});
			continue;
		}
		if (route.loadTiming.status === "skipped") {
			failures.push({
				reason: route.loadTiming.reason,
				routeId: route.id,
				type: "load-timing-skipped",
			});
		}
	}
	return failures;
}

function evaluatePerfBaselineWarnings(
	baseline,
	buildDurationBudget = DEFAULT_BUILD_DURATION_BUDGET,
) {
	return evaluateBuildDurationBudget(baseline, buildDurationBudget).warnings;
}

function formatFailure(failure) {
	if (failure.type === "build-duration-warning") {
		return `build: ${formatMetricName(failure.metricName)} ${formatDurationMs(failure.value)} exceeds warning budget ${formatDurationMs(failure.warningLimit)} (failure budget ${formatDurationMs(failure.failureLimit)}).`;
	}
	if (failure.type === "build-duration-over-budget") {
		return `build: ${formatMetricName(failure.metricName)} ${formatDurationMs(failure.value)} exceeds budget ${formatDurationMs(failure.limit)}.`;
	}
	if (failure.type === "missing-route") {
		return `${failure.routeId}: route is missing from the perf baseline.`;
	}
	if (failure.type === "unbudgeted-route") {
		return `${failure.routeId}: route is measured by default but has no budget in scripts/perf-route-budgets.json.`;
	}
	if (failure.type === "unmeasured-route") {
		return `${failure.routeId}: route status is ${failure.status}; expected measured.`;
	}
	if (failure.type === "missing-metric") {
		return `${failure.routeId}: missing ${formatMetricName(failure.metricName)}.`;
	}
	if (failure.type === "missing-load-timing") {
		return `${failure.routeId}: missing route load timing even though baseUrl was recorded.`;
	}
	if (failure.type === "load-timing-failed") {
		return `${failure.routeId}: route load timing failed for ${failure.timingPath} (${failure.error ?? "unknown error"}).`;
	}
	if (failure.type === "load-timing-skipped") {
		return `${failure.routeId}: route load timing was skipped (${failure.reason ?? "unknown reason"}).`;
	}
	if (failure.type === "over-budget") {
		return `${failure.routeId}: ${formatMetricName(failure.metricName)} ${failure.value} exceeds budget ${failure.limit}.`;
	}
	return `${failure.routeId}: unknown perf budget failure.`;
}

function printHelp() {
	console.log([
		"Usage: node scripts/verify-perf-baseline-budget.js [--input output/perf-baseline.json] [--warn-only]",
		"",
		"Verifies measured perf baseline routes stay within current route budgets.",
	].join("\n"));
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
	const options = parseArgs(argv);
	if (options.help) {
		printHelp();
		return;
	}

	const baseline = readJsonFile(options.inputPath, cwd);
	const failures = evaluatePerfBaselineBudget(baseline);
	const warnings = evaluatePerfBaselineWarnings(baseline);
	const findings = options.warnOnly ? [...failures, ...warnings] : failures;
	if (findings.length > 0) {
		const log = options.warnOnly ? console.warn : console.error;
		log(options.warnOnly ? "Performance baseline budget warnings:" : "Performance baseline budget failed:");
		for (const failure of findings) {
			log(`- ${formatFailure(failure)}`);
		}
		if (options.warnOnly) {
			return;
		}
		process.exitCode = 1;
		return;
	}
	if (warnings.length > 0) {
		console.warn("Performance baseline budget warnings:");
		for (const warning of warnings) {
			console.warn(`- ${formatFailure(warning)}`);
		}
	}

	console.log(`Verified performance baseline budget (${Object.keys(DEFAULT_ROUTE_BUDGETS).length} route budgets)`);
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}

module.exports = {
	DEFAULT_BUILD_DURATION_BUDGET,
	DEFAULT_INPUT_PATH,
	DEFAULT_ROUTE_BUDGETS,
	FIXED_ROUTE_IDS,
	ROUTE_BUDGET_TARGETS,
	ROUTE_BUDGETS_PATH,
	findRaisedBudgets,
	formatRaisedBudget,
	evaluateBuildDurationBudget,
	evaluatePerfBaselineBudget,
	evaluatePerfBaselineWarnings,
	evaluateRouteLoadTimingFailures,
	formatFailure,
	formatDurationMs,
	main,
	parseArgs,
};
