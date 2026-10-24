const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	collectStatus,
	deriveStatus,
	formatAge,
	groupKeyFor,
	main,
	parseArgs,
	parseBlockers,
	parseVerdict,
	renderTable,
	runIndexFor,
	runIsAlive,
	parseProcessList,
	worktreeFromRunScript,
} = require("./vpk-remote-status.js");

// ── Pure status derivation ────────────────────────────────────────────────────

const exited = (exitCode, at) => ({ state: "exited", exitCode, startedAt: at - 1, endedAt: at });
const running = (at) => ({ state: "running", exitCode: null, startedAt: at, endedAt: null });
const stopped = (at) => ({ state: "stopped", exitCode: null, startedAt: at, endedAt: null });

function dir(runs, { blockers = [], verdict = null } = {}) {
	return { runs, report: { nonEmpty: true, blockers, verdict } };
}

function facts(overrides = {}) {
	return {
		kind: "worker",
		worker: dir([exited(0, 100)]),
		reviews: [],
		git: { branch: "vpk/feat-x", localBranch: true, worktree: "/w", worktreeExists: true, ahead: 2 },
		pr: null,
		...overrides,
	};
}

const STATUS_CASES = [
	["running", facts({ worker: dir([running(100)]) }), "wait; ask for status later"],
	["stopped", facts({ worker: dir([stopped(100)]) }), "check git status, re-dispatch"],
	["failed", facts({ worker: dir([exited(1, 100)]) }), "read stderr.log, fix brief, re-dispatch"],
	["blocked", facts({ worker: dir([exited(0, 100)], { blockers: ["needs a token"] }) }), "resolve the report's blocker"],
	["reviewing", facts({ reviews: [dir([running(200)])] }), "wait for the review"],
	["needs fixes", facts({ reviews: [dir([exited(0, 200)], { verdict: "request changes" })] }), "send a correction follow-up"],
	["needs review", facts(), "run the advisor review"],
	["ready to ship", facts({ reviews: [dir([exited(0, 200)], { verdict: "approve" })] }), "/vpk-git-ship"],
	["PR open", facts({ reviews: [dir([exited(0, 200)])], pr: { number: 12, state: "OPEN" } }), "/vpk-git-ship --merge 12"],
	["merged", facts({ pr: { number: 12, state: "MERGED" } }), "/vpk-git-clean"],
	["done", facts({
		pr: { number: 12, state: "MERGED" },
		git: { branch: "vpk/feat-x", localBranch: false, worktree: "/w", worktreeExists: false, ahead: null },
	}), "none"],
	["done (read-only)", facts({
		kind: "research",
		git: { branch: null, localBranch: false, worktree: null, worktreeExists: false, ahead: null },
	}), "read the report"],
];

for (const [status, input, nextAction] of STATUS_CASES) {
	test(`deriveStatus: ${status}`, () => {
		assert.deepEqual(deriveStatus(input), { status, nextAction });
	});
}

test("deriveStatus: a worker run newer than the review clears needs fixes", () => {
	const input = facts({
		worker: dir([exited(0, 100), exited(0, 300)]),
		reviews: [dir([exited(0, 200)], { verdict: "request changes" })],
	});
	assert.equal(deriveStatus(input).status, "needs review");
});

test("deriveStatus: a skipped review goes straight to ready to ship", () => {
	assert.equal(deriveStatus(facts({ advisor: false })).status, "ready to ship");
});

test("deriveStatus: the latest review decides, not the first", () => {
	const input = facts({
		reviews: [
			dir([exited(0, 150)], { verdict: "request changes" }),
			dir([exited(0, 250)], { verdict: "approve" }),
		],
	});
	assert.equal(deriveStatus(input).status, "ready to ship");
});

test("deriveStatus: a merged PR outranks an older failed review", () => {
	const input = facts({ reviews: [dir([exited(1, 200)])], pr: { number: 3, state: "MERGED" } });
	assert.equal(deriveStatus(input).status, "merged");
});

test("deriveStatus: a legacy run whose worktree and branch are gone is done", () => {
	const input = facts({ git: { branch: null, localBranch: false, worktree: "/gone", worktreeExists: false, ahead: null } });
	assert.equal(deriveStatus(input).status, "done");
});

// ── Pure parsing ──────────────────────────────────────────────────────────────

test("parseBlockers ignores None and unfilled template lines", () => {
	assert.deepEqual(parseBlockers("## Findings\n- a\n\n## Blockers\n- None.\n"), []);
	assert.deepEqual(parseBlockers("## Blockers\n- None. Playwright ran unsandboxed.\n"), []);
	assert.deepEqual(parseBlockers("## Blockers\n- [only infrastructure or scope blockers]\n"), []);
	assert.deepEqual(parseBlockers("## Blockers\n- Gateway returned 401\n\n## Next\n- x\n"), ["Gateway returned 401"]);
	assert.deepEqual(parseBlockers("no section here"), []);
});

test("parseVerdict reads explicit and implicit verdicts", () => {
	assert.equal(parseVerdict("**Verdict: request changes.**"), "request changes");
	assert.equal(parseVerdict("## Blockers\n\nRequest changes for findings 1–4."), "request changes");
	assert.equal(parseVerdict("Verdict: approve"), "approve");
	assert.equal(parseVerdict("Looks fine."), null);
});

test("groupKeyFor joins a worker with every -review run", () => {
	assert.equal(groupKeyFor("vpk-fix-x-review"), "vpk-fix-x");
	assert.equal(groupKeyFor("vpk-fix-x-review-2"), "vpk-fix-x");
	assert.equal(groupKeyFor("vpk-fix-x"), "vpk-fix-x");
	assert.equal(groupKeyFor("vpk-feat-reviewer"), "vpk-feat-reviewer");
});

test("runIndexFor orders run.sh before follow-ups and skips sidecar files", () => {
	assert.equal(runIndexFor("run.sh"), 0);
	assert.equal(runIndexFor("run-12.sh"), 12);
	assert.equal(runIndexFor("run.sh.exit"), null);
	assert.equal(runIndexFor("run.sh.pane.sh"), null);
});

test("runIsAlive matches the run script exactly, never its pane runner", () => {
	const processes = parseProcessList([
		"  41 bash /o/remote-claude/vpk-fix-x/run.sh.pane.sh",
		"  42 node agent-surface.js run --script /o/remote-claude/vpk-fix-y/run-1.sh --label vpk-fix-y",
		"  43 codex exec -C /w --output-last-message /o/remote-gpt/vpk-fix-z/report.md -",
	].join("\n"));
	assert.equal(runIsAlive("/o/remote-claude/vpk-fix-x/run.sh", "/o/remote-claude/vpk-fix-x", processes), false);
	assert.equal(runIsAlive("/o/remote-claude/vpk-fix-y/run-1.sh", "/o/remote-claude/vpk-fix-y", processes), true);
	assert.equal(runIsAlive("/o/remote-gpt/vpk-fix-z/run.sh", "/o/remote-gpt/vpk-fix-z", processes), true);
});

test("worktreeFromRunScript reads both lanes", () => {
	assert.equal(worktreeFromRunScript('#!/bin/bash\ncd "/r/.claude/worktrees/a" || exit 1\n'), "/r/.claude/worktrees/a");
	assert.equal(worktreeFromRunScript('codex exec --ignore-user-config -C "/r/.claude/worktrees/b" \\\n'), "/r/.claude/worktrees/b");
	assert.equal(worktreeFromRunScript("claude -p < brief.md"), null);
});

test("formatAge", () => {
	assert.equal(formatAge(30_000), "<1m");
	assert.equal(formatAge(12 * 60_000), "12m");
	assert.equal(formatAge((2 * 60 + 10) * 60_000), "2h 10m");
	assert.equal(formatAge(null), "—");
});

test("parseArgs", () => {
	assert.deepEqual(parseArgs(["--all", "--task", "vpk-fix-x"]), { all: true, json: false, task: "vpk-fix-x" });
	assert.throws(() => parseArgs(["--task"]), /needs a name/u);
	assert.throws(() => parseArgs(["--bogus"]), /unknown option/u);
});

// ── Collection against a fixture checkout ─────────────────────────────────────

const NOW = Date.parse("2026-10-24T12:00:00Z");
const MINUTE = 60_000;

function writeFile(file, text, atMs) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, text);
	if (atMs) fs.utimesSync(file, new Date(atMs), new Date(atMs));
}

// A main checkout holding output/remote-*/ directories. Nothing here is a real git repo:
// the fake runner answers every git, gh, ps, and herdr call.
function fixtureCheckout() {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-remote-status-")));
	const out = (lane, name, file) => path.join(root, "output", `remote-${lane}`, name, file);
	const tree = path.join(root, ".claude", "worktrees", "vpk-feat-alpha");

	// A worker with task.json, finished, reviewed twice; the newer review approves.
	writeFile(out("claude", "vpk-feat-alpha", "task.json"), JSON.stringify({
		name: "vpk-feat-alpha", goal: "Add the alpha panel with a very long goal that will need truncating at narrow widths",
		type: "feat", branch: "vpk/feat-alpha", worktree: ".claude/worktrees/vpk-feat-alpha",
		lane: "claude", kind: "worker", createdAt: new Date(NOW - 130 * MINUTE).toISOString(),
	}));
	writeFile(out("claude", "vpk-feat-alpha", "run.sh"), "exit 0\n", NOW - 120 * MINUTE);
	writeFile(out("claude", "vpk-feat-alpha", "run.sh.exit"), "0\n", NOW - 90 * MINUTE);
	writeFile(out("claude", "vpk-feat-alpha", "report.md"), "## Findings\n- done\n\n## Blockers\n- None\n", NOW - 90 * MINUTE);
	writeFile(out("gpt", "vpk-feat-alpha-review", "run.sh"), "exit 0\n", NOW - 85 * MINUTE);
	writeFile(out("gpt", "vpk-feat-alpha-review", "run.sh.exit"), "0\n", NOW - 80 * MINUTE);
	writeFile(out("gpt", "vpk-feat-alpha-review", "report.md"), "**Verdict: request changes.**\n", NOW - 80 * MINUTE);
	writeFile(out("gpt", "vpk-feat-alpha-review-2", "run.sh"), "exit 0\n", NOW - 70 * MINUTE);
	writeFile(out("gpt", "vpk-feat-alpha-review-2", "run.sh.exit"), "0\n", NOW - 60 * MINUTE);
	writeFile(out("gpt", "vpk-feat-alpha-review-2", "report.md"), "Verdict: approve\n", NOW - 60 * MINUTE);

	// A legacy worker: no task.json, no exit file, but its process is alive.
	writeFile(out("claude", "vpk-fix-beta", "brief.md"), "fix beta\n", NOW - 12 * MINUTE);
	writeFile(out("claude", "vpk-fix-beta", "run.sh"), "exit 0\n", NOW - 12 * MINUTE);

	// A read-only research run that finished.
	writeFile(out("gpt", "vpk-research-gamma", "run.sh"), "exit 0\n", NOW - 300 * MINUTE);
	writeFile(out("gpt", "vpk-research-gamma", "run.sh.exit"), "0\n", NOW - 290 * MINUTE);
	writeFile(out("gpt", "vpk-research-gamma", "report.md"), "found it\n", NOW - 290 * MINUTE);

	return { root, tree };
}

function fakeRunner({ root, tree }, { gh = "ok", ahead = "3" } = {}) {
	const calls = [];
	const ok = (stdout) => ({ ok: true, stdout, stderr: "" });
	const runCommand = async (command, args) => {
		calls.push([command, ...args]);
		const line = [command, ...args].join(" ");
		if (line === "git worktree list --porcelain") {
			return ok(`worktree ${root}\nHEAD abc\nbranch refs/heads/main\n\nworktree ${tree}\nHEAD def\nbranch refs/heads/vpk/feat-alpha\n`);
		}
		if (line.startsWith("git for-each-ref")) return ok("main\nvpk/feat-alpha\n");
		if (line.startsWith("git rev-list --count")) return ok(`${ahead}\n`);
		if (line.startsWith(`git -C ${tree} status`)) return ok("");
		if (command === "ps") return ok(`  77 bash ${path.join(root, "output", "remote-claude", "vpk-fix-beta", "run.sh")}\n`);
		if (command === "gh") {
			if (gh === "fail") return { ok: false, stdout: "", stderr: "gh: not logged in" };
			const index = args.findIndex((arg) => arg === "b0=vpk/feat-alpha");
			const data = { repository: {} };
			for (const arg of args) {
				const match = /^(b\d+)=/u.exec(arg);
				if (match) data.repository[match[1]] = { nodes: [] };
			}
			if (index !== -1) data.repository.b0.nodes = gh === "open" ? [{ number: 7, state: "OPEN", url: "https://x/7", mergedAt: null }] : [];
			return ok(JSON.stringify({ data }));
		}
		return { ok: false, stdout: "", stderr: `unexpected ${line}` };
	};
	return { runCommand, calls };
}

test("collectStatus groups a worker with its -review runs and reads legacy directories", async () => {
	const fixture = fixtureCheckout();
	const { runCommand, calls } = fakeRunner(fixture);
	const result = await collectStatus({ cwd: fixture.root, runCommand, env: {}, now: NOW });

	assert.equal(result.gh, "ok");
	const byName = Object.fromEntries(result.tasks.map((task) => [task.name, task]));
	assert.deepEqual(Object.keys(byName).sort(), ["vpk-feat-alpha", "vpk-fix-beta", "vpk-research-gamma"]);

	const alpha = byName["vpk-feat-alpha"];
	assert.deepEqual(alpha.dirs.map((d) => d.name), ["vpk-feat-alpha", "vpk-feat-alpha-review", "vpk-feat-alpha-review-2"]);
	assert.equal(alpha.status, "ready to ship");
	assert.equal(alpha.git.ahead, 3);
	assert.equal(alpha.git.dirty, false);
	assert.equal(alpha.goal.startsWith("Add the alpha panel"), true);

	const beta = byName["vpk-fix-beta"];
	assert.equal(beta.goal, "");
	assert.equal(beta.status, "running");
	assert.equal(beta.kind, "worker");

	assert.equal(byName["vpk-research-gamma"].status, "done (read-only)");
	assert.equal(calls.filter(([command]) => command === "gh").length, 1, "one batched gh call");
	assert.equal(calls.some(([command]) => command === "herdr"), false, "herdr skipped outside herdr");
});

test("collectStatus reports PR open and herdr surfaces", async () => {
	const fixture = fixtureCheckout();
	const { runCommand: base } = fakeRunner(fixture, { gh: "open" });
	const runCommand = async (command, args) => {
		if (command === "herdr") {
			const key = args[0] === "workspace" ? "workspaces" : "tabs";
			return { ok: true, stdout: JSON.stringify({ result: { [key]: [{ label: "vpk-feat-alpha" }] } }), stderr: "" };
		}
		return base(command, args);
	};
	const result = await collectStatus({ cwd: fixture.root, runCommand, env: { HERDR_ENV: "1" }, now: NOW });
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.equal(alpha.status, "PR open");
	assert.equal(alpha.nextAction, "/vpk-git-ship --merge 7");
	assert.equal(alpha.herdrOpen, true);
	assert.equal(result.tasks.find((task) => task.name === "vpk-fix-beta").herdrOpen, false);
});

test("a gh failure shows ? in the PR column and never throws", async () => {
	const fixture = fixtureCheckout();
	const { runCommand } = fakeRunner(fixture, { gh: "fail" });
	const result = await collectStatus({ cwd: fixture.root, runCommand, env: {}, now: NOW });
	assert.equal(result.gh, "failed");
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.equal(alpha.pr, "unknown");
	const row = renderTable(result.tasks, { now: NOW }).split("\n").find((line) => line.includes("vpk-feat-alpha"));
	assert.match(row, /│ \? +│/u);
});

test("renderTable truncates the goal first and fits a narrow terminal", async () => {
	const fixture = fixtureCheckout();
	const { runCommand } = fakeRunner(fixture);
	const { tasks } = await collectStatus({ cwd: fixture.root, runCommand, env: {}, now: NOW });

	const wide = renderTable(tasks, { width: 200, now: NOW }).split("\n");
	assert.equal(wide.some((line) => line.includes("…")), false, "nothing truncated when it fits");

	const narrow = renderTable(tasks, { width: 80, now: NOW }).split("\n");
	assert.equal(narrow.every((line) => line.length <= 80), true, narrow.join("\n"));
	const goal = narrow.find((line) => line.includes("Add the alpha panel"));
	assert.equal(goal.includes("…"), true);
	assert.equal(narrow.some((line) => line.includes("│ vpk-feat-alpha ")), true, "task names stay whole");
});

test("renderTable hides done tasks unless --all, and says so", async () => {
	const fixture = fixtureCheckout();
	const { runCommand } = fakeRunner(fixture);
	const { tasks } = await collectStatus({ cwd: fixture.root, runCommand, env: {}, now: NOW });

	const hidden = renderTable(tasks, { now: NOW });
	assert.match(hidden.split("\n")[0], /2 active · 1 done hidden/u);
	assert.equal(hidden.includes("vpk-research-gamma"), false);
	const lines = hidden.split("\n");
	assert.ok(lines.findIndex((line) => line.includes("vpk-fix-beta")) < lines.findIndex((line) => line.includes("vpk-feat-alpha")), "running sorts first");

	const all = renderTable(tasks, { now: NOW, all: true });
	assert.match(all.split("\n")[0], /2 active · 1 done(?! hidden)/u);
	assert.equal(all.includes("vpk-research-gamma"), true);
});

test("renderTable with no tasks prints one line", () => {
	assert.equal(renderTable([], { now: NOW }), "No vpk-remote tasks found.");
});

function captureStdout({ isTTY = false, columns } = {}) {
	let text = "";
	return { isTTY, columns, write: (chunk) => { text += chunk; }, get text() { return text; } };
}

test("--json prints facts plus status and next action per task", async () => {
	const fixture = fixtureCheckout();
	const { runCommand } = fakeRunner(fixture);
	const stdout = captureStdout();
	await main(["--json"], { stdout, env: {}, cwd: fixture.root, runCommand, now: NOW });
	const parsed = JSON.parse(stdout.text);
	assert.equal(parsed.mainCheckout, fixture.root);
	assert.equal(parsed.gh, "ok");
	const alpha = parsed.tasks.find((task) => task.name === "vpk-feat-alpha");
	for (const key of ["name", "goal", "kind", "status", "nextAction", "createdAt", "git", "pr", "herdrOpen", "dirs"]) {
		assert.equal(key in alpha, true, `task has ${key}`);
	}
	assert.deepEqual(Object.keys(alpha.git).sort(), ["ahead", "branch", "dirty", "localBranch", "worktree", "worktreeExists"]);
	const run = alpha.dirs[0].runs[0];
	assert.deepEqual([run.script, run.state, run.exitCode], ["run.sh", "exited", 0]);
	assert.equal(alpha.dirs[0].report.path.endsWith(path.join("vpk-feat-alpha", "report.md")), true);
});

test("--task shows one task in detail, matched by any of its directory names", async () => {
	const fixture = fixtureCheckout();
	const { runCommand } = fakeRunner(fixture);
	const stdout = captureStdout();
	await main(["--task", "vpk-feat-alpha-review"], { stdout, env: {}, cwd: fixture.root, runCommand, now: NOW });
	assert.match(stdout.text, /^vpk-feat-alpha · ready to ship/u);
	assert.match(stdout.text, /gpt\/vpk-feat-alpha-review-2\/run\.sh {2}exit 0/u);
	assert.match(stdout.text, /verdict: approve/u);
	await assert.rejects(main(["--task", "vpk-fix-nope"], { stdout, env: {}, cwd: fixture.root, runCommand, now: NOW }), /no task named/u);
});

test("colour only on a TTY with NO_COLOR unset", async () => {
	const fixture = fixtureCheckout();
	const { runCommand } = fakeRunner(fixture);
	const render = async (env, isTTY) => {
		const stdout = captureStdout({ isTTY, columns: 140 });
		await main([], { stdout, env, cwd: fixture.root, runCommand, now: NOW });
		return stdout.text;
	};
	const escape = "\x1b[";
	assert.equal((await render({}, true)).includes(escape), true);
	assert.equal((await render({ NO_COLOR: "1" }, true)).includes(escape), false);
	assert.equal((await render({}, false)).includes(escape), false);
});

test("collectStatus with no task directories returns no tasks", async () => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-remote-status-empty-")));
	const runCommand = async () => ({ ok: true, stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/main\n`, stderr: "" });
	const stdout = captureStdout();
	await main([], { stdout, env: {}, cwd: root, runCommand, now: NOW });
	assert.equal(stdout.text, "No vpk-remote tasks found.\n");
});
