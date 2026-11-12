const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	BILLING_STALE_MS,
	GUARDED_MARKDOWN,
	ciMarkerDecision,
	classifyRun,
	collectBillingState,
	collectMainHealth,
	deadlineGh,
	formatHealth,
	hasSkipInstruction,
	isInertPath,
	main,
	oversizedMarkdown,
	originRepository,
	pendingSkipCommits,
	runUrl,
} = require("./main-health");
const { runGhJson } = require("./review-gate-status");

const BILLING_ANNOTATION = { message: "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings", title: "" };
const EXIT_ANNOTATION = { message: "Process completed with exit code 1.", title: "" };
const NOW = Date.parse("2026-11-13T12:00:00Z");
const SHA = "a".repeat(40);

function run(id, { status = "completed", conclusion = "success", updatedAt = "2026-11-13T11:00:00Z" } = {}) {
	return { conclusion, databaseId: id, headSha: String(id).padEnd(40, "0"), status, updatedAt, url: `https://github.com/o/r/actions/runs/${id}` };
}

function job(id, name, conclusion) {
	return { conclusion, databaseId: id, name, status: "completed" };
}

// A fake gh that serves run lists, run jobs and check-run annotations, recording calls.
function fakeGh({ runs = [run(1)], jobs = {}, annotations = {}, fail } = {}) {
	const calls = [];
	const runGh = async (args) => {
		calls.push(args);
		if (fail?.(args)) throw new Error("gh run list failed: HTTP 502");
		if (args[0] === "run" && args[1] === "list") return typeof runs === "function" ? runs(args) : runs;
		if (args[0] === "run" && args[1] === "view") return { jobs: jobs[args[2]] ?? [] };
		const match = /check-runs\/(\d+)\/annotations$/u.exec(args[1] ?? "");
		if (match) {
			if (annotations[match[1]] instanceof Error) throw annotations[match[1]];
			return [annotations[match[1]] ?? []];
		}
		throw new Error(`Unexpected gh call: ${args.join(" ")}`);
	};
	return { calls, runGh };
}

// `commits` are [shortSha, message] pairs, rendered the way `git log --format=%h%x00%B%x1e` prints them.
function fakeGit(paths, remote = "git@github.com:o/r.git", commits = []) {
	return (args) => {
		if (args[0] === "merge-base") return "base\n";
		if (args[0] === "diff") return `${paths.join("\n")}\n`;
		if (args[0] === "remote") return `${remote}\n`;
		if (args[0] === "log") return commits.map(([sha, message]) => `${sha}\x00${message}\n\x1e`).join("\n");
		throw new Error(`Unexpected git call: ${args.join(" ")}`);
	};
}

async function cli(argv, { gh = fakeGh(), paths = [], commits = [] } = {}) {
	let output = "";
	await main(argv, { runGh: gh.runGh, runGit: fakeGit(paths, undefined, commits), write: (text) => { output += text; } });
	return output;
}

test("only markdown outside guarded agent docs, and artifacts, count as inert", () => {
	for (const inert of ["README.md", "docs/notes.mdx", "artifacts/vpk-html/x/index.html", "components/blocks/foo/README.md"]) {
		assert.equal(isInertPath(inert), true, inert);
	}
	for (const code of ["AGENTS.md", ".agents/rules/token-priority.md", ".agents/skills/vpk-git-ship/SKILL.md", "package.json",
		"scripts/check.mjs", "app/page.tsx", "markdown.md.ts", "WORKFLOW.md", "DESIGN.md",
		"components/projects/jira-team-eu26-end/finale/VENDOR.md", "public/1p/rovo-stage-kit/README.md"]) {
		assert.equal(isInertPath(code), false, code);
	}
});

test("markdown that code reads is guarded, and the list names real tracked files", () => {
	const repoRoot = path.resolve(__dirname, "../../../..");
	for (const file of GUARDED_MARKDOWN) {
		assert.equal(isInertPath(file), false, file);
		assert.ok(existsSync(path.join(repoRoot, file)), `${file} no longer exists; drop it from GUARDED_MARKDOWN`);
	}
	// The readers that justify each entry still read it.
	assert.match(readFileSync(path.join(repoRoot, "scripts/symphony.sh"), "utf8"), /WORKFLOW\.md/u);
	const finale = readFileSync(path.join(repoRoot, "components/projects/jira-team-eu26-end/finale/lib/finale-wall-pieces.test.js"), "utf8");
	assert.match(finale, /"\.\.\/VENDOR\.md"/u);
	assert.match(finale, /path\.join\(kit, "README\.md"\)/u);
});

test("a docs-only change past the file-size threshold runs CI, because verify:file-size budgets markdown", (t) => {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-main-health-md-"));
	t.after(() => rmSync(root, { force: true, recursive: true }));
	writeFileSync(path.join(root, "small.md"), "# ok\n");
	writeFileSync(path.join(root, "big.md"), "line\n".repeat(1001));
	assert.deepEqual(oversizedMarkdown(["small.md", "big.md", "gone.md", "app.ts"], { root, threshold: 1000 }), ["big.md"]);
	const decision = ciMarkerDecision({ billing: null, oversized: ["big.md"], paths: ["small.md", "big.md"] });
	assert.equal(decision.skipCi, false);
	assert.match(decision.reason, /file-size threshold \(big\.md\)/u);
	assert.equal(ciMarkerDecision({ billing: null, paths: ["small.md"] }).skipCi, true);
});

test("the fast-ship marker is added only for inert diffs or a current billing block", () => {
	assert.deepEqual(ciMarkerDecision({ billing: { blocked: false }, paths: ["app/page.tsx", "README.md"] }).skipCi, false);
	assert.deepEqual(ciMarkerDecision({ billing: { blocked: false }, paths: ["README.md", "artifacts/a.html"] }).skipCi, true);
	assert.deepEqual(ciMarkerDecision({ billing: { blocked: false }, paths: [] }).skipCi, false);
	assert.match(ciMarkerDecision({ billing: { blocked: true, url: "u" }, paths: ["app/page.tsx"] }).reason, /billing-blocked/u);
	assert.equal(ciMarkerDecision({ billing: { blocked: true, url: "u" }, paths: ["app/page.tsx"] }).skipCi, true);
});

test("an unpushed commit that already skips CI makes a code push start CI explicitly", async () => {
	for (const message of ["Fix x [skip ci]", "Fix x [CI SKIP]", "[no ci] Fix", "Fix [skip actions]", "Fix [actions skip]", "Fix x\n\nskip-checks: true"]) {
		assert.equal(hasSkipInstruction(message), true, message);
	}
	for (const message of ["Fix the skip ci helper", "Mention skip-checks in docs", "skip-checks: false"]) {
		assert.equal(hasSkipInstruction(message), false, message);
	}
	const commits = [["aaa1111", "Retry fast ship [skip ci]\n\nbody"], ["bbb2222", "Plain commit"]];
	assert.deepEqual(pendingSkipCommits({ runGit: fakeGit([], undefined, commits) }), ["aaa1111"]);

	const output = JSON.parse(await cli(["--ci-marker", "--json"], { commits, paths: ["app/page.tsx"] }));
	assert.equal(output.skipCi, false);
	assert.equal(output.dispatchAfterPush, true);
	assert.deepEqual(output.markedCommits, ["aaa1111"]);
	assert.match(output.reason, /gh workflow run ci\.yml --ref main/u);

	// When the push should skip CI anyway, an existing marker changes nothing.
	const docs = JSON.parse(await cli(["--ci-marker", "--json"], { commits, paths: ["README.md"] }));
	assert.equal(docs.skipCi, true);
	assert.equal(docs.dispatchAfterPush, false);
	assert.equal(JSON.parse(await cli(["--ci-marker", "--json"], { paths: ["app/page.tsx"] })).dispatchAfterPush, false);
});

test("a failed run is billing-blocked only when every non-aggregate failure carries the billing annotation", () => {
	const failed = run(5, { conclusion: "failure" });
	const jobs = [job(51, "Static validation", "failure"), job(52, "Unit shard 1/4", "failure"), job(53, "PR checks", "failure")];
	const billed = new Map([[51, [BILLING_ANNOTATION]], [52, [BILLING_ANNOTATION]], [53, [EXIT_ANNOTATION]]]);
	assert.equal(classifyRun({ annotations: billed, jobs, run: failed }).state, "billing-blocked");

	const mixed = new Map([[51, [BILLING_ANNOTATION]], [52, [EXIT_ANNOTATION]], [53, [EXIT_ANNOTATION]]]);
	const red = classifyRun({ annotations: mixed, jobs, run: failed });
	assert.equal(red.state, "red");
	assert.deepEqual(red.failedJobs, ["Static validation", "Unit shard 1/4", "PR checks"]);

	// Unreadable annotations never prove billing.
	assert.equal(classifyRun({ annotations: new Map([[51, null], [52, null], [53, null]]), jobs, run: failed }).state, "red");
	// The aggregate alone is billing-blocked only with its own billing annotation.
	assert.equal(classifyRun({ annotations: new Map([[53, [BILLING_ANNOTATION]]]), jobs: [job(53, "PR checks", "failure")], run: failed }).state, "billing-blocked");
	assert.equal(classifyRun({ annotations: new Map(), jobs: [job(53, "PR checks", "failure")], run: failed }).state, "red");
});

test("main health reports the newest settled run on main, skipping superseded cancellations", async () => {
	const gh = fakeGh({
		annotations: { 71: [EXIT_ANNOTATION] },
		jobs: { 7: [job(70, "Static validation", "success"), job(71, "Unit shard 2/4", "failure"), job(72, "PR checks", "failure")] },
		runs: [run(9, { conclusion: null, status: "in_progress" }), run(8, { conclusion: "cancelled" }), run(7, { conclusion: "failure" }), run(6)],
	});
	const health = await collectMainHealth({ repository: "o/r", runGh: gh.runGh });
	assert.equal(health.state, "red");
	assert.equal(health.runId, 7);
	assert.deepEqual(health.failedJobs, ["Unit shard 2/4", "PR checks"]);
	assert.equal(health.inProgress.url, "https://github.com/o/r/actions/runs/9");
	const line = formatHealth(health);
	assert.match(line, /^main health: RED at 700000000; failed: Unit shard 2\/4, PR checks/u);
	assert.match(line, /newer run in progress/u);
	const list = gh.calls.find((args) => args[1] === "list");
	// Runs on main only (push and the explicit dispatch fast ship may start), never PR runs.
	assert.deepEqual(list.slice(list.indexOf("--branch"), list.indexOf("--branch") + 2), ["--branch", "main"]);
	assert.equal(list.includes("--event"), false);
	// Annotations are read only for failed jobs, never for the passing one.
	assert.deepEqual(gh.calls.filter((args) => args[0] === "api").map((args) => args[1]).sort(),
		["repos/o/r/check-runs/71/annotations", "repos/o/r/check-runs/72/annotations"]);
});

test("a green main needs one GitHub read and gh failures degrade to unknown, never throw", async () => {
	const green = fakeGh({ runs: [run(4)] });
	const health = await collectMainHealth({ repository: "o/r", runGh: green.runGh });
	assert.equal(health.state, "green");
	assert.equal(green.calls.length, 1);
	assert.match(formatHealth(health), /^main health: green at 400000000/u);

	const broken = fakeGh({ fail: () => true });
	const unknown = await collectMainHealth({ repository: "o/r", runGh: broken.runGh });
	assert.equal(unknown.state, "unknown");
	assert.match(formatHealth(unknown), /^main health: unknown \(gh run list failed/u);

	assert.equal((await collectMainHealth({ repository: "o/r", runGh: fakeGh({ runs: [run(3, { conclusion: "cancelled" })] }).runGh })).state, "unknown");
});

test("billing state reads any event's runs and expires after a day so CI is retried", async () => {
	const billingRun = (updatedAt) => fakeGh({
		annotations: { 21: [BILLING_ANNOTATION] },
		jobs: { 2: [job(21, "Static validation", "failure"), job(22, "PR checks", "failure")] },
		runs: [run(2, { conclusion: "failure", updatedAt })],
	});
	const fresh = billingRun(new Date(NOW - 60_000).toISOString());
	assert.equal((await collectBillingState({ now: () => NOW, repository: "o/r", runGh: fresh.runGh })).blocked, true);
	const list = fresh.calls.find((args) => args[1] === "list");
	assert.equal(list.includes("--event"), false);
	assert.equal(list.includes("--branch"), false);

	const stale = billingRun(new Date(NOW - BILLING_STALE_MS - 1).toISOString());
	assert.equal((await collectBillingState({ now: () => NOW, repository: "o/r", runGh: stale.runGh })).blocked, false);
	assert.equal((await collectBillingState({ now: () => NOW, repository: "o/r", runGh: fakeGh({ fail: () => true }).runGh })).blocked, false);
});

test("fast-ship marker: billing-blocked Actions adds the marker without a question; code changes run CI", async () => {
	const blocked = fakeGh({
		annotations: { 21: [BILLING_ANNOTATION] },
		jobs: { 2: [job(21, "Static validation", "failure")] },
		runs: [run(2, { conclusion: "failure", updatedAt: new Date().toISOString() })],
	});
	const blockedOutput = JSON.parse(await cli(["--ci-marker", "--json"], { gh: blocked, paths: ["app/page.tsx"] }));
	assert.equal(blockedOutput.skipCi, true);
	assert.equal(blockedOutput.marker, "[skip ci]");
	assert.match(blockedOutput.reason, /billing-blocked/u);

	assert.equal(await cli(["--ci-marker"], { paths: ["app/page.tsx"] }), "CI marker: none (code change; CI runs after the push)\n");

	const docs = fakeGh();
	assert.equal(await cli(["--ci-marker"], { gh: docs, paths: ["README.md"] }), "CI marker: add [skip ci] (docs- or artifacts-only change)\n");
	assert.equal(docs.calls.length, 0, "a docs-only decision needs no GitHub read");
});

test("the run URL falls back to the commit checks page when no run is queued yet", async () => {
	assert.equal(await runUrl({ repository: "o/r", runGh: fakeGh({ runs: [run(5)] }).runGh, sha: SHA }), "https://github.com/o/r/actions/runs/5");
	assert.equal(await runUrl({ repository: "o/r", runGh: fakeGh({ runs: [] }).runGh, sha: SHA }), `https://github.com/o/r/commit/${SHA}/checks`);
	assert.equal(await runUrl({ repository: "o/r", runGh: fakeGh({ fail: () => true }).runGh, sha: SHA }), `https://github.com/o/r/commit/${SHA}/checks`);
	await assert.rejects(runUrl({ repository: "o/r", runGh: fakeGh().runGh, sha: "abc" }), /full commit SHA/u);
});

test("the repository comes from the origin remote without a network call", () => {
	assert.equal(originRepository(fakeGit([], "git@github.com:eevennsoh/vpk.git")), "eevennsoh/vpk");
	assert.equal(originRepository(fakeGit([], "https://github.com/eevennsoh/vpk")), "eevennsoh/vpk");
	assert.equal(originRepository(fakeGit([], "https://example.test/x.git")), undefined);
});

test("workflow run reads retry transient failures; other run subcommands do not", async () => {
	for (const [args, expected] of [[["run", "list", "--json", "url"], 2], [["run", "view", "7", "--json", "jobs"], 2], [["run", "rerun", "7"], 1], [["run", "cancel", "7"], 1]]) {
		let calls = 0;
		const spawn = async () => (++calls === 1 ? { status: 1, stderr: "HTTP 502" } : { status: 0, stdout: "{}" });
		const result = runGhJson(args, { spawn, sleep: async () => {} });
		if (expected === 2) assert.deepEqual(await result, {});
		else await assert.rejects(result);
		assert.equal(calls, expected, args.join(" "));
	}
});

test("CLI exits 0 and reports unknown when gh is unavailable", () => {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-main-health-"));
	try {
		const fake = path.join(root, "gh");
		writeFileSync(fake, `#!${process.execPath}\nprocess.stderr.write("HTTP 401: Bad credentials");\nprocess.exit(1);\n`);
		chmodSync(fake, 0o755);
		const result = spawnSync(process.execPath, [path.join(__dirname, "main-health.js"), "--repo", "o/r"], {
			encoding: "utf8", env: { PATH: root }, timeout: 10000,
		});
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /^main health: unknown \(gh run list failed: HTTP 401/u);
	} finally { rmSync(root, { force: true, recursive: true }); }
});

// A gh that never answers: every mode must still answer, with its safe default, at its deadline.
const hangingGh = () => new Promise(() => {});

test("every mode answers with its safe default when GitHub never responds", async () => {
	const elapsed = async (work) => {
		const started = Date.now();
		const value = await work();
		return { ms: Date.now() - started, value };
	};
	const health = await elapsed(() => collectMainHealth({ deadlineMs: 50, repository: "o/r", runGh: hangingGh }));
	assert.equal(health.value.state, "unknown");
	assert.match(health.value.reason, /did not answer within 0\.05s/u);
	assert.ok(health.ms < 1000, `health took ${health.ms}ms`);

	const billing = await elapsed(() => collectBillingState({ deadlineMs: 50, repository: "o/r", runGh: hangingGh }));
	assert.equal(billing.value.blocked, false);
	assert.ok(billing.ms < 1000);

	const url = await elapsed(() => runUrl({ deadlineMs: 50, repository: "o/r", runGh: hangingGh, sha: SHA }));
	assert.equal(url.value, `https://github.com/o/r/commit/${SHA}/checks`);
	assert.ok(url.ms < 1000);

	let output = "";
	const marker = await elapsed(() => main(["--ci-marker"], {
		deadlines: { ciMarker: 50, health: 50, runUrl: 50 }, runGh: hangingGh, runGit: fakeGit(["app/page.tsx"]), write: (text) => { output += text; },
	}));
	assert.equal(output, "CI marker: none (code change; CI runs after the push)\n");
	assert.ok(marker.ms < 1000);
});

test("the deadline gh runner kills a gh that never exits instead of waiting for it", async (t) => {
	const root = mkdtempSync(path.join(tmpdir(), "vpk-main-health-hang-"));
	t.after(() => rmSync(root, { force: true, recursive: true }));
	const pidFile = path.join(root, "pid");
	const fake = path.join(root, "gh");
	writeFileSync(fake, `#!${process.execPath}\nrequire("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => {}, 1000);\n`);
	chmodSync(fake, 0o755);
	const previousPath = process.env.PATH;
	process.env.PATH = `${root}${path.delimiter}${previousPath}`;
	t.after(() => { process.env.PATH = previousPath; });
	// Long enough for the fake to start and record its pid even on a loaded machine.
	const started = Date.now();
	await assert.rejects(deadlineGh(2000)(["run", "list", "--json", "url"]), /gh run list failed/u);
	assert.ok(Date.now() - started < 6000, "the child was killed at the deadline");
	const pid = Number(readFileSync(pidFile, "utf8"));
	assert.throws(() => process.kill(pid, 0), /ESRCH/u, "no gh process is left behind");
});
