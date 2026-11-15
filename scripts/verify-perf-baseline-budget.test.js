const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
	ALL_FRAMES_METRICS,
	DEFAULT_BUILD_DURATION_BUDGET,
	DEFAULT_ROUTE_BUDGETS,
	FIXED_ROUTE_IDS,
	ROUTE_BUDGET_TARGETS,
	evaluateBuildDurationBudget,
	findRaisedBudgets,
	formatBudgetTable,
	formatFetchedAssetsForFailures,
	formatRaisedBudget,
	evaluatePerfBaselineBudget,
	evaluatePerfBaselineWarnings,
	evaluateRouteLoadTimingFailures,
	formatFailure,
	formatDurationMs,
	main,
	parseArgs,
	BUDGET_MARGIN,
	BUDGET_RAISES,
	budgetCeiling,
	findRaiseEntryProblems,
	findUnsanctionedRaises,
} = require("./verify-perf-baseline-budget");
const { resolveBaseRef } = require("./verify-eslint-suppressions");

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
		requireFetched: false,
		warnOnly: false,
	});
	assert.deepEqual(parseArgs(["--input=tmp/perf.json"]), {
		inputPath: "tmp/perf.json",
		requireFetched: false,
		warnOnly: false,
	});
	assert.deepEqual(parseArgs(["--warn-only"]), {
		inputPath: "output/perf-baseline.json",
		requireFetched: false,
		warnOnly: true,
	});
	assert.equal(parseArgs(["--require-fetched"]).requireFetched, true);
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
	assert.equal(formatFailure(failures[0]), "eu26: route is measured by default but has no budget in scripts/perf-route-budgets.json.");
	const custom = { routes: [...createPassingBaseline().routes, createRoute("one-off")] };
	assert.deepEqual(evaluatePerfBaselineBudget(custom), [], "a --route measured on demand needs no budget");
});

test("findRaisedBudgets reports only values above the base", () => {
	const base = { rovo: { cssBytes: 935_000, firstLoadJsBytes: 7_300_000 } };
	const current = { rovo: { cssBytes: 940_000, firstLoadJsBytes: 7_200_000 }, home: { cssBytes: 999_999 } };
	assert.deepEqual(findRaisedBudgets(base, current), [{ baseLimit: 935_000, limit: 940_000, metricName: "cssBytes", routeId: "rovo" }]);
	assert.deepEqual(findRaisedBudgets(base, base), []);
});

test("findRaisedBudgets treats a removed metric or route as raised", () => {
	const base = { rovo: { cssBytes: 935_000, firstLoadJsBytes: 7_300_000 }, "one-off": { cssBytes: 500_000 } };
	const metricRemoved = findRaisedBudgets(base, { rovo: { cssBytes: 935_000 }, "one-off": { cssBytes: 500_000 } });
	assert.deepEqual(metricRemoved, [{ baseLimit: 7_300_000, limit: null, metricName: "firstLoadJsBytes", routeId: "rovo" }]);
	assert.equal(formatRaisedBudget(metricRemoved[0]), "rovo.firstLoadJsBytes 7300000 -> removed");
	const routeRemoved = findRaisedBudgets(base, { rovo: { cssBytes: 935_000, firstLoadJsBytes: 7_300_000 } });
	assert.deepEqual(routeRemoved, [{ baseLimit: 500_000, limit: null, metricName: "cssBytes", routeId: "one-off" }]);
});

// A throwaway repository whose budgets file plays perf-route-budgets.json. checkoutPrMerge() builds
// HEAD the way a pull_request run gets it: GitHub's merge of the PR head into a base commit.
function createRatchetRepo(t) {
	const root = mkdtempSync(path.join(os.tmpdir(), "vpk-ratchet-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
	const attempt = (...args) => spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd: root, encoding: "utf8", env });
	const run = (...args) => {
		const result = attempt(...args);
		if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
		return result.stdout.trim();
	};
	const git = (args) => {
		const result = spawnSync("git", args, { cwd: root, encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] });
		return result.status === 0 ? result.stdout.trim() : null;
	};
	const commit = (message, budget, file = "budgets.json") => {
		writeFileSync(path.join(root, file), file === "budgets.json" ? JSON.stringify({ home: { fetchedJsBytes: budget } }) : message);
		run("add", file);
		run("commit", "-q", "-m", message);
		return run("rev-parse", "HEAD");
	};
	run("init", "-q", "-b", "main");
	const main0 = commit("main0", 1_252_000);
	return {
		attempt,
		git,
		run,
		commit,
		main0,
		checkoutPrMerge(baseCommit, prBranch) {
			run("checkout", "-q", "--detach", baseCommit);
			run("merge", "-q", "--no-ff", "--no-edit", prBranch);
		},
		raised(env) {
			const baseRef = resolveBaseRef({ env, git });
			const read = (ref) => JSON.parse(git(["show", `${ref}:budgets.json`]));
			return findRaisedBudgets(read(baseRef), read("HEAD")).map(formatRaisedBudget);
		},
	};
}

const PR_RUN = { GITHUB_BASE_REF: "main" };

test("a pull request that does not touch the budgets passes after the base lowers them", (t) => {
	const repo = createRatchetRepo(t);
	repo.run("checkout", "-q", "-b", "pr");
	repo.commit("unrelated", 0, "other.txt");
	repo.run("checkout", "-q", "main");
	const main1 = repo.commit("lower budgets", 1_250_000);
	repo.run("update-ref", "refs/remotes/origin/main", main1);
	// The run's merge commit was built before main lowered the budget; origin/main is fetched later.
	repo.checkoutPrMerge(repo.main0, "pr");
	assert.deepEqual(repo.raised(PR_RUN), []);
	// Comparing with the base tip, as before, blamed the pull request for main's own drop.
	const tip = JSON.parse(repo.git(["show", "origin/main:budgets.json"]));
	const head = JSON.parse(repo.git(["show", "HEAD:budgets.json"]));
	assert.deepEqual(findRaisedBudgets(tip, head).map(formatRaisedBudget), ["home.fetchedJsBytes 1250000 -> 1252000"]);
	// A checkout of the PR head itself compares with its merge-base.
	repo.run("checkout", "-q", "pr");
	assert.deepEqual(repo.raised(PR_RUN), []);
});

test("a pull request that raises a budget fails, and one that lowers it passes", (t) => {
	const repo = createRatchetRepo(t);
	repo.run("checkout", "-q", "-b", "raise");
	repo.commit("raise", 1_300_000);
	repo.run("checkout", "-q", "main");
	repo.run("checkout", "-q", "-b", "lower");
	repo.commit("lower", 1_200_000);
	repo.checkoutPrMerge(repo.main0, "raise");
	assert.deepEqual(repo.raised(PR_RUN), ["home.fetchedJsBytes 1252000 -> 1300000"]);
	repo.checkoutPrMerge(repo.main0, "lower");
	assert.deepEqual(repo.raised(PR_RUN), []);
});

test("a raise behind a merge of the base still fails", (t) => {
	const repo = createRatchetRepo(t);
	repo.run("checkout", "-q", "-b", "pr");
	repo.commit("raise", 1_300_000);
	repo.run("checkout", "-q", "main");
	const main1 = repo.commit("lower budgets", 1_250_000);
	repo.run("checkout", "-q", "pr");
	// Merge main into the branch and keep the raised value through the conflict.
	assert.notEqual(repo.attempt("merge", "-q", "--no-edit", "main").status, 0, "the merge conflicts on the budget");
	repo.run("checkout", "--ours", "budgets.json");
	repo.run("add", "budgets.json");
	repo.run("commit", "-q", "--no-edit");
	repo.checkoutPrMerge(main1, "pr");
	assert.deepEqual(repo.raised(PR_RUN), ["home.fetchedJsBytes 1250000 -> 1300000"]);
});

// Same base as the other shrink-only baselines: the PR base in CI, the pre-push tip on a push to
// main, the merge base with origin/main locally.
test("route budgets only go down from the base", () => {
	const { isBaseRequired } = require("./verify-eslint-suppressions");
	const repoRoot = path.resolve(__dirname, "..");
	const git = (args) => {
		const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		return result.status === 0 ? result.stdout.trim() : null;
	};
	const baseRef = resolveBaseRef({ git });
	if (!baseRef) {
		assert.equal(isBaseRequired(), false, "the named ratchet base must resolve");
		return;
	}
	const baseSource = git(["show", `${baseRef}:scripts/perf-route-budgets.json`]);
	if (baseSource === null) return; // the base predates the file: this change introduces the baseline
	const raised = findUnsanctionedRaises(JSON.parse(baseSource).routes);
	assert.deepEqual(raised, [], `perf route budgets may only go down unless "raises" in perf-route-budgets.json records the change; raised since ${baseRef.slice(0, 9)}: ${raised.map(formatRaisedBudget).join(", ")}`);
});

test("every recorded budget raise names its reason and stays within the margin", () => {
	for (const entry of BUDGET_RAISES) assert.deepEqual(findRaiseEntryProblems(entry), []);
});

test("the margin is a share of the value with an absolute floor for small metrics", () => {
	const margin = { ratio: 0.03, floors: { routeJsBytes: 5120, assetCount: 2 } };
	assert.equal(budgetCeiling("routeJsBytes", 63_303, margin), 69_000); // the 5 KB floor beats 3% (1,900)
	assert.equal(budgetCeiling("routeJsBytes", 400_000, margin), 412_000); // 3% (12,000) beats the floor
	assert.equal(budgetCeiling("cssBytes", 696_019, margin), 717_000); // no floor: 3%, rounded up
	assert.equal(budgetCeiling("assetCount", 33, margin), 35); // counts are not rounded
	assert.equal(budgetCeiling("assetCount", 110, margin), 114);
	assert.equal(typeof BUDGET_MARGIN.ratio, "number");
});

test("a raised budget passes only with a matching, reasoned entry within the margin", () => {
	const margin = { ratio: 0.03, floors: { routeJsBytes: 5120 } };
	const base = { home: { routeJsBytes: 62_000, cssBytes: 717_000 } };
	const current = { home: { routeJsBytes: 69_000, cssBytes: 717_000 } };
	const entry = { route: "home", metric: "routeJsBytes", from: 62_000, to: 69_000, measured: 63_303, reason: "PR 2186, owner's product change", date: "2026-11-14" };
	const unsanctioned = (raises) => findUnsanctionedRaises(base, current, raises, margin).map(formatRaisedBudget);
	assert.deepEqual(unsanctioned([entry]), []);
	assert.deepEqual(unsanctioned([]), ["home.routeJsBytes 62000 -> 69000"], "no entry");
	assert.deepEqual(unsanctioned([{ ...entry, reason: " " }]), ["home.routeJsBytes 62000 -> 69000"], "empty reason");
	assert.deepEqual(unsanctioned([{ ...entry, measured: 60_000 }]), ["home.routeJsBytes 62000 -> 69000"], "above measured plus the margin");
	assert.deepEqual(unsanctioned([{ ...entry, from: 61_000 }]), ["home.routeJsBytes 62000 -> 69000"], "an entry for another change");
	assert.deepEqual(unsanctioned([{ ...entry, metric: "cssBytes" }]), ["home.routeJsBytes 62000 -> 69000"], "another metric");
	// An old entry stays as history but cannot cover a later raise of the same budget.
	const later = { home: { routeJsBytes: 75_000, cssBytes: 717_000 } };
	assert.deepEqual(findUnsanctionedRaises(current, later, [entry], margin).map(formatRaisedBudget), ["home.routeJsBytes 69000 -> 75000"]);
	// A removed budget is never covered.
	assert.deepEqual(findUnsanctionedRaises(base, { home: { cssBytes: 717_000 } }, [{ ...entry, to: null }], margin).map(formatRaisedBudget), ["home.routeJsBytes 62000 -> removed"]);
	assert.match(findRaiseEntryProblems({ ...entry, reason: "" }, margin).join(), /reason is empty/u);
	assert.match(findRaiseEntryProblems({ ...entry, measured: 60_000 }, margin).join(), /above measured 60000 plus the margin \(66000\)/u);
	assert.match(findRaiseEntryProblems({ ...entry, date: "14 Nov" }, margin).join(), /date must be YYYY-MM-DD/u);
	assert.match(findRaiseEntryProblems({ ...entry, to: 61_000 }, margin).join(), /to must be above from/u);
});

test("the budget targets sit at or below the budgets", () => {
	for (const [routeId, budget] of Object.entries(DEFAULT_ROUTE_BUDGETS)) {
		const target = { ...ROUTE_BUDGET_TARGETS["*"], ...ROUTE_BUDGET_TARGETS[routeId] };
		for (const [metricName, value] of Object.entries(target)) {
			assert.ok(value <= budget[metricName], `${routeId}.${metricName} target ${value} is above its budget ${budget[metricName]}`);
		}
	}
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

test("fetched-byte budgets apply when measured and are required only with --require-fetched", () => {
	const budgets = { home: { cssBytes: 10, fetchedCssBytes: 20, fetchedJsBytes: 100 } };
	const local = { routes: [createRoute("home")] };
	assert.deepEqual(evaluatePerfBaselineBudget(local, budgets), []);
	assert.deepEqual(evaluatePerfBaselineBudget(local, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true }).map((failure) => [failure.type, failure.metricName]), [
		["missing-metric", "fetchedCssBytes"],
		["missing-metric", "fetchedJsBytes"],
	]);

	const fetched = { routes: [createRoute("home", { fetchedCss: { bytes: 20 }, fetchedJs: { bytes: 101 } })] };
	const failures = evaluatePerfBaselineBudget(fetched, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	assert.deepEqual(failures.map((failure) => [failure.type, failure.metricName, failure.value, failure.limit]), [["over-budget", "fetchedJsBytes", 101, 100]]);
	assert.match(formatFailure(failures[0]), /fetched JS bytes 101 exceeds budget 100/u);
});

test("the budget table shows each measured value, its budget and the headroom", () => {
	const table = formatBudgetTable(
		{ routes: [createRoute("home", { css: { bytes: 900 }, fetchedJs: { bytes: 50 } })] },
		{ home: { cssBytes: 1000, fetchedCssBytes: 10, fetchedJsBytes: 100 } },
	).split("\n").map((line) => line.trim().split(/\s{2,}/u));
	assert.deepEqual(table, [
		["route", "metric", "measured", "budget", "headroom"],
		["home", "cssBytes", "900", "1000", "100 (10.0%)"],
		["home", "fetchedCssBytes", "-", "10", "not measured"],
		["home", "fetchedJsBytes", "50", "100", "50 (50.0%)"],
	]);
});

test("a route over its fetched budget lists the assets its first run fetched", () => {
	const baseline = { routes: [createRoute("home", { fetchedJs: { bytes: 300 }, fetchedPath: "/", fetchedRuns: [{ assets: [{ bytes: 200, kind: "js", path: "/_next/static/chunks/a.js" }, { bytes: 100, kind: "js", path: "/_next/static/chunks/b.js" }] }] })] };
	const failures = evaluatePerfBaselineBudget(baseline, { home: { fetchedJsBytes: 250 } }, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	const listing = formatFetchedAssetsForFailures(baseline, failures).split("\n").map((line) => line.trim());
	assert.deepEqual(listing, ["Fetched by home (/), first run:", "200  /_next/static/chunks/a.js", "100  /_next/static/chunks/b.js"]);
	assert.equal(formatFetchedAssetsForFailures(baseline, []), "");
});

test("the all-frames JS budget is compared and fails over budget", () => {
	const budgets = { home: { fetchedJsBytes: 100, fetchedJsBytesAllFrames: 1000, fetchedCssBytesAllFrames: 50, fetchedJsBytesFullPage: 5000 } };
	assert.deepEqual(evaluatePerfBaselineBudget({ routes: [createRoute("home")] }, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true }).map((failure) => [failure.type, failure.metricName]), [
		["missing-metric", "fetchedJsBytes"],
		["missing-metric", "fetchedJsBytesAllFrames"],
		["missing-metric", "fetchedCssBytesAllFrames"],
		["missing-metric", "fetchedJsBytesFullPage"],
	]);
	const otherFrames = { fetchedCssAllFrames: { bytes: 50, source: "all-frames" }, fetchedJsFullPage: { bytes: 5000, source: "all-frames" } };
	const within = { routes: [createRoute("home", { fetchedJs: { bytes: 100 }, fetchedJsAllFrames: { bytes: 1000, source: "all-frames" }, ...otherFrames })] };
	assert.deepEqual(evaluatePerfBaselineBudget(within, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true }), []);
	const over = { routes: [createRoute("home", {
		fetchedAllFramesRuns: [{ assets: [{ bytes: 1001, kind: "js", path: "/_next/static/chunks/project.js" }] }],
		fetchedJs: { bytes: 100 },
		fetchedJsAllFrames: { bytes: 1001, source: "all-frames" },
		fetchedPath: "/",
		fetchedRuns: [{ assets: [{ bytes: 100, kind: "js", path: "/_next/static/chunks/main.js" }] }],
		...otherFrames,
	})] };
	const failures = evaluatePerfBaselineBudget(over, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	assert.deepEqual(failures.map((failure) => [failure.type, failure.metricName, failure.value, failure.limit]), [["over-budget", "fetchedJsBytesAllFrames", 1001, 1000]]);
	assert.match(formatFailure(failures[0]), /fetched JS bytes \(all frames\) 1001 exceeds budget 1000/u);
	assert.match(formatFetchedAssetsForFailures(over, failures), /Fetched by home \(\/\) in all frames, first run:\n\s+1001  \/_next\/static\/chunks\/project\.js/u);
	const table = formatBudgetTable(over, budgets).split("\n").map((line) => line.trim().split(/\s{2,}/u));
	assert.deepEqual(table.at(-3), ["home", "fetchedJsBytesAllFrames", "1001", "1000", "-1 (-0.1%)"]);
});

test("a route whose page embeds iframes fails without an all-frames budget", () => {
	const embedding = { routes: [createRoute("home", { fetchedJs: { bytes: 100 }, fetchedJsAllFrames: { bytes: 5000, source: "all-frames" } })] };
	const failures = evaluatePerfBaselineBudget(embedding, { home: { fetchedJsBytes: 100 } });
	assert.deepEqual(failures.map((failure) => failure.type), ["unbudgeted-embedded-frames"]);
	assert.match(formatFailure(failures[0]), /home: page embeds iframes that fetch 5000 bytes .* no fetchedJsBytesAllFrames, fetchedCssBytesAllFrames, fetchedJsBytesFullPage budget/u);
	const partly = evaluatePerfBaselineBudget(embedding, { home: { fetchedJsBytes: 100, fetchedJsBytesAllFrames: 9000 } });
	assert.deepEqual(partly.map((failure) => [failure.type, failure.metricNames]), [["unbudgeted-embedded-frames", ["fetchedCssBytesAllFrames", "fetchedJsBytesFullPage"]]], "one all-frames budget does not excuse the others");
	const noFrames = { routes: [createRoute("home", { fetchedJs: { bytes: 100 }, fetchedJsAllFrames: { bytes: 100, source: "top-document" } })] };
	assert.deepEqual(evaluatePerfBaselineBudget(noFrames, { home: { fetchedJsBytes: 100 } }), []);
});

test("home has an all-frames budget", () => {
	for (const metricName of ALL_FRAMES_METRICS) {
		assert.equal(typeof DEFAULT_ROUTE_BUDGETS.home[metricName], "number", `the home catalog embeds project previews in iframes, so it budgets ${metricName}`);
	}
});

test("a route with an all-frames budget fails when its all-frames pass saw no iframe", () => {
	const budgets = { home: { fetchedJsBytes: 1000, fetchedJsBytesAllFrames: 5000 } };
	const quiet = { routes: [createRoute("home", { fetchedJs: { bytes: 100 }, fetchedJsAllFrames: { bytes: 100, source: "top-document" }, fetchedJsFullPage: { bytes: 100, source: "top-document" } })] };
	const failures = evaluatePerfBaselineBudget(quiet, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	assert.deepEqual(failures.map((failure) => failure.type), ["stale-embedded-frames-budget"]);
	assert.match(formatFailure(failures[0]), /home: has an all-frames budget \(fetchedJsBytesAllFrames, .*\), but no iframe attached/u);
	const fullPageOnly = evaluatePerfBaselineBudget(quiet, { home: { fetchedJsBytes: 1000, fetchedJsBytesFullPage: 5000 } }, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	assert.deepEqual(fullPageOnly.map((failure) => failure.type), ["stale-embedded-frames-budget"], "a full-page budget alone is also stale without an iframe");
});

test("an over-budget all-frames listing marks the assets an iframe fetched", () => {
	const route = createRoute("home", {
		fetchedAllFramesRuns: [{ assets: [{ bytes: 10, frame: "main", kind: "js", path: "/a.js" }, { bytes: 20, frame: "sub", kind: "js", path: "/b.js" }] }],
		fetchedJsAllFrames: { bytes: 30, source: "all-frames" },
		fetchedPath: "/",
	});
	const listing = formatFetchedAssetsForFailures({ routes: [route] }, [{ metricName: "fetchedJsBytesAllFrames", routeId: "home", type: "over-budget" }]).split("\n").map((line) => line.trim());
	assert.deepEqual(listing, ["Fetched by home (/) in all frames, first run:", "10  /a.js", "20  /b.js  (iframe)"]);
});

test("the all-frames CSS and full-page JS budgets are compared, and a full-page failure lists what scrolling fetched", () => {
	const budgets = { home: { fetchedCssBytesAllFrames: 50, fetchedJsBytesAllFrames: 1000, fetchedJsBytesFullPage: 2000 } };
	const route = (overrides) => createRoute("home", {
		fetchedAllFramesRuns: [{ assets: [
			{ bytes: 900, frame: "main", kind: "js", path: "/a.js" },
			{ bytes: 40, frame: "sub", kind: "css", path: "/b.css" },
			{ bytes: 1500, frame: "sub", kind: "js", path: "/project.js", scrolled: true },
		] }],
		fetchedCssAllFrames: { bytes: 40, source: "all-frames" },
		fetchedJsAllFrames: { bytes: 900, source: "all-frames" },
		fetchedJsFullPage: { bytes: 1900, source: "all-frames" },
		fetchedPath: "/",
		...overrides,
	});
	assert.deepEqual(evaluatePerfBaselineBudget({ routes: [route({})] }, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true }), []);
	assert.deepEqual(evaluatePerfBaselineBudget({ routes: [createRoute("home")] }, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true }).map((failure) => failure.metricName), ["fetchedCssBytesAllFrames", "fetchedJsBytesAllFrames", "fetchedJsBytesFullPage"]);
	assert.deepEqual(evaluatePerfBaselineBudget({ routes: [createRoute("home")] }, budgets), [], "a local baseline without fetched numbers skips them");

	// The pre-#2290 home: 20 live project iframes, most below the fold. The viewport JS stays
	// within its budget; only the full-page number sees the rest.
	const scrolledOver = { routes: [route({ fetchedJsFullPage: { bytes: 2400, source: "all-frames" } })] };
	const failures = evaluatePerfBaselineBudget(scrolledOver, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	assert.deepEqual(failures.map((failure) => [failure.type, failure.metricName, failure.value]), [["over-budget", "fetchedJsBytesFullPage", 2400]]);
	assert.match(formatFailure(failures[0]), /fetched JS bytes \(all frames, scrolled to the bottom\) 2400 exceeds budget 2000/u);
	const listing = formatFetchedAssetsForFailures(scrolledOver, failures).split("\n").map((line) => line.trim());
	assert.deepEqual(listing, ["Fetched by home (/) in all frames, scrolled to the bottom, first run:", "900  /a.js", "40  /b.css  (iframe)", "1500  /project.js  (iframe)  (after scrolling)"]);

	const cssOver = { routes: [route({ fetchedCssAllFrames: { bytes: 51, source: "all-frames" } })] };
	const cssFailures = evaluatePerfBaselineBudget(cssOver, budgets, DEFAULT_BUILD_DURATION_BUDGET, { requireFetched: true });
	assert.deepEqual(cssFailures.map((failure) => [failure.metricName, failure.value]), [["fetchedCssBytesAllFrames", 51]]);
	assert.match(formatFailure(cssFailures[0]), /fetched CSS bytes \(all frames\) 51 exceeds budget 50/u);
	assert.deepEqual(formatFetchedAssetsForFailures(cssOver, cssFailures).split("\n").map((line) => line.trim()), ["Fetched by home (/) in all frames, first run:", "900  /a.js", "40  /b.css  (iframe)"], "a viewport failure leaves out what scrolling fetched");
});
