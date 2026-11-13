const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	DEFAULT_BUILD_DURATION_BUDGET,
	DEFAULT_ROUTE_BUDGETS,
	FIXED_ROUTE_IDS,
	evaluateBuildDurationBudget,
	evaluatePerfBaselineBudget,
	evaluatePerfBaselineWarnings,
	evaluateRouteLoadTimingFailures,
	formatFailure,
	formatDurationMs,
	main,
	parseArgs,
} = require("./verify-perf-baseline-budget");

function createRoute(id, overrides = {}) {
	return {
		assetCount: 1,
		css: { bytes: 1 },
		firstLoadJs: { bytes: 1 },
		id,
		size: { bytes: 1 },
		status: "measured",
		...overrides,
	};
}

function createPassingBaseline() {
	return {
		routes: Object.keys(DEFAULT_ROUTE_BUDGETS).map((routeId) => createRoute(routeId)),
	};
}

test("parseArgs supports custom input paths", () => {
	assert.deepEqual(parseArgs(["--input", "tmp/perf.json"]), {
		inputPath: "tmp/perf.json",
		warnOnly: false,
	});
	assert.deepEqual(parseArgs(["--input=tmp/perf.json"]), {
		inputPath: "tmp/perf.json",
		warnOnly: false,
	});
	assert.deepEqual(parseArgs(["--warn-only"]), {
		inputPath: "output/perf-baseline.json",
		warnOnly: true,
	});
	assert.throws(() => parseArgs(["--input"]), /requires a value/u);
});

test("evaluatePerfBaselineBudget accepts measured routes within budget", () => {
	assert.deepEqual(evaluatePerfBaselineBudget(createPassingBaseline()), []);
});

test("formatDurationMs renders readable build durations", () => {
	assert.equal(formatDurationMs(12_500), "12.5s");
	assert.equal(formatDurationMs(120_000), "2m");
});

test("evaluatePerfBaselineBudget reports over-budget metrics", () => {
	const baseline = createPassingBaseline();
	baseline.routes = baseline.routes.map((route) =>
		route.id === "studio"
			? {
				...route,
				firstLoadJs: {
					bytes: DEFAULT_ROUTE_BUDGETS.studio.firstLoadJsBytes + 1,
				},
			}
			: route,
	);

	const failures = evaluatePerfBaselineBudget(baseline);
	assert.deepEqual(failures, [
		{
			limit: DEFAULT_ROUTE_BUDGETS.studio.firstLoadJsBytes,
			metricName: "firstLoadJsBytes",
			routeId: "studio",
			type: "over-budget",
			value: DEFAULT_ROUTE_BUDGETS.studio.firstLoadJsBytes + 1,
		},
	]);
	assert.match(formatFailure(failures[0]), /studio: first-load JS bytes/u);
});

test("evaluatePerfBaselineBudget requires every budgeted route to be measured", () => {
	const baseline = createPassingBaseline();
	baseline.routes = baseline.routes
		.filter((route) => route.id !== "rovo")
		.map((route) =>
			route.id === "home"
				? {
					...route,
					status: "missing",
				}
				: route,
		);

	const failures = evaluatePerfBaselineBudget(baseline);
	assert.deepEqual(failures, [
		{
			routeId: "home",
			status: "missing",
			type: "unmeasured-route",
		},
		{
			routeId: "rovo",
			type: "missing-route",
		},
	]);
});

test("every route measured by default has a budget", () => {
	assert.deepEqual(FIXED_ROUTE_IDS.filter((routeId) => !Object.hasOwn(DEFAULT_ROUTE_BUDGETS, routeId)), []);
});

test("evaluatePerfBaselineBudget fails a measured default route that has no budget", () => {
	const { eu26: _eu26, ...budgetsWithoutEu26 } = DEFAULT_ROUTE_BUDGETS;
	const failures = evaluatePerfBaselineBudget(createPassingBaseline(), budgetsWithoutEu26);
	assert.deepEqual(failures, [{ routeId: "eu26", type: "unbudgeted-route" }]);
	assert.equal(formatFailure(failures[0]), "eu26: route is measured by default but has no budget in DEFAULT_ROUTE_BUDGETS.");
	const custom = { routes: [...createPassingBaseline().routes, createRoute("one-off")] };
	assert.deepEqual(evaluatePerfBaselineBudget(custom), [], "a --route measured on demand needs no budget");
});

test("evaluatePerfBaselineBudget reports missing metrics", () => {
	const baseline = createPassingBaseline();
	baseline.routes = baseline.routes.map((route) =>
		route.id === "components"
			? {
				...route,
				css: undefined,
			}
			: route,
	);

	assert.deepEqual(evaluatePerfBaselineBudget(baseline), [
		{
			metricName: "cssBytes",
			routeId: "components",
			type: "missing-metric",
		},
	]);
});

test("evaluateBuildDurationBudget reports warnings and failures separately", () => {
	assert.deepEqual(evaluateBuildDurationBudget({
		source: { buildDurationMs: DEFAULT_BUILD_DURATION_BUDGET.warningMs + 1 },
	}), {
		failures: [],
		warnings: [{
			failureLimit: DEFAULT_BUILD_DURATION_BUDGET.failureMs,
			metricName: "buildDurationMs",
			type: "build-duration-warning",
			value: DEFAULT_BUILD_DURATION_BUDGET.warningMs + 1,
			warningLimit: DEFAULT_BUILD_DURATION_BUDGET.warningMs,
		}],
	});

	assert.deepEqual(evaluateBuildDurationBudget({
		source: { buildDurationMs: DEFAULT_BUILD_DURATION_BUDGET.failureMs + 1 },
	}), {
		failures: [{
			limit: DEFAULT_BUILD_DURATION_BUDGET.failureMs,
			metricName: "buildDurationMs",
			type: "build-duration-over-budget",
			value: DEFAULT_BUILD_DURATION_BUDGET.failureMs + 1,
		}],
		warnings: [],
	});
});

test("evaluatePerfBaselineWarnings reports build duration warnings without failing route budgets", () => {
	const baseline = {
		...createPassingBaseline(),
		source: { buildDurationMs: DEFAULT_BUILD_DURATION_BUDGET.warningMs + 1 },
	};

	assert.deepEqual(evaluatePerfBaselineBudget(baseline), []);
	assert.match(formatFailure(evaluatePerfBaselineWarnings(baseline)[0]), /build: build duration/u);
});

test("route load timing failures are enforced only for timed baselines", () => {
	const untimedBaseline = createPassingBaseline();
	assert.deepEqual(evaluateRouteLoadTimingFailures(untimedBaseline), []);
	assert.deepEqual(evaluatePerfBaselineBudget(untimedBaseline), []);

	const timedBaseline = {
		...createPassingBaseline(),
		source: {
			baseUrl: "http://localhost:3000",
		},
	};
	timedBaseline.routes = timedBaseline.routes.map((route) => {
		if (route.id === "home") {
			return route;
		}
		if (route.id === "rovo") {
			return {
				...route,
				loadTiming: {
					error: "connection refused",
					path: "/rovo",
					status: "failed",
				},
			};
		}
		if (route.id === "studio") {
			return {
				...route,
				loadTiming: {
					reason: "dynamic-route-needs-timing-route",
					status: "skipped",
				},
			};
		}
		return {
			...route,
			loadTiming: {
				path: route.path,
				responseMs: 12,
				status: "measured",
			},
		};
	});

	const failures = evaluateRouteLoadTimingFailures(timedBaseline);
	assert.deepEqual(failures, [
		{
			routeId: "home",
			type: "missing-load-timing",
		},
		{
			error: "connection refused",
			routeId: "rovo",
			timingPath: "/rovo",
			type: "load-timing-failed",
		},
		{
			reason: "dynamic-route-needs-timing-route",
			routeId: "studio",
			type: "load-timing-skipped",
		},
	]);
	assert.deepEqual(evaluatePerfBaselineBudget(timedBaseline), failures);
	assert.match(formatFailure(failures[0]), /missing route load timing/u);
	assert.match(formatFailure(failures[1]), /connection refused/u);
	assert.match(formatFailure(failures[2]), /dynamic-route-needs-timing-route/u);
});

test("warn-only mode reports budget failures without failing the process", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-perf-budget-warn-"));
	const originalExitCode = process.exitCode;
	const originalWarn = console.warn;
	const warnings = [];

	try {
		const inputPath = "perf.json";
		const baseline = createPassingBaseline();
		baseline.routes = baseline.routes.map((route) =>
			route.id === "rovo"
				? {
					...route,
					firstLoadJs: {
						bytes: DEFAULT_ROUTE_BUDGETS.rovo.firstLoadJsBytes + 1,
					},
				}
				: route,
		);
		mkdirSync(cwd, { recursive: true });
		writeFileSync(path.join(cwd, inputPath), JSON.stringify(baseline));
		console.warn = (message) => warnings.push(message);
		process.exitCode = undefined;

		main(["--input", inputPath, "--warn-only"], cwd);

		assert.equal(process.exitCode, undefined);
		assert.match(warnings.join("\n"), /Performance baseline budget warnings/u);
		assert.match(warnings.join("\n"), /rovo: first-load JS bytes/u);
	} finally {
		console.warn = originalWarn;
		process.exitCode = originalExitCode;
		rmSync(cwd, { force: true, recursive: true });
	}
});

test("package scripts expose strict and warning perf budget commands", () => {
	const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

	assert.equal(packageJson.scripts["perf:baseline"], "node scripts/collect-perf-baseline.js");
	assert.equal(packageJson.scripts["perf:baseline:timing"], "node scripts/collect-perf-baseline.js --baseline-input output/perf-baseline.json --output output/perf-baseline.json");
	assert.equal(packageJson.scripts["perf:budget"], "pnpm run perf:baseline && node scripts/verify-perf-baseline-budget.js");
	assert.equal(packageJson.scripts["perf:budget:warn"], "pnpm run perf:baseline && node scripts/verify-perf-baseline-budget.js --warn-only");
	assert.equal(packageJson.scripts["perf:budget:check"], "node scripts/verify-perf-baseline-budget.js");
	assert.equal(packageJson.scripts["perf:budget:check:warn"], "node scripts/verify-perf-baseline-budget.js --warn-only");
});
