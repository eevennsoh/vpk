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
	parseRunRecords,
	parseVerdict,
	pickPr,
	renderMarkdown,
	roleFor,
	runIndexFor,
	runIsAlive,
	parseProcessList,
	sanitizeTask,
	worktreeFromRunScript,
} = require("./vpk-remote-status.js");

// ── Pure status derivation ────────────────────────────────────────────────────

const exited = (exitCode, at, startedAt = at - 1) => ({ state: "exited", exitCode, startedAt, endedAt: at });
const running = (at) => ({ state: "running", exitCode: null, startedAt: at, endedAt: null });
const stopped = (at) => ({ state: "stopped", exitCode: null, startedAt: at, endedAt: null });
const unknown = (at) => ({ state: "unknown", exitCode: null, startedAt: at, endedAt: null });

// The report belongs to the directory's latest run; give a run its own with `report`.
function dir(runs, { blockers = [], verdict = null } = {}) {
	const report = { nonEmpty: true, blockers, verdict };
	return { runs: runs.map((run, index) => ({ report: index === runs.length - 1 ? report : null, ...run })), report };
}

const GIT = { branch: "vpk/feat-x", localBranch: true, worktree: "/w", worktreeExists: true, ahead: 2 };
const GONE = { branch: null, localBranch: false, worktree: null, worktreeExists: false, ahead: null };

function facts(overrides = {}) {
	return { readOnly: false, workers: [dir([exited(0, 100)])], reviews: [], git: GIT, pr: null, ...overrides };
}

const STATUS_CASES = [
	["running", facts({ workers: [dir([running(100)])] }), "wait; ask for status later"],
	["unknown", facts({ workers: [dir([unknown(100)])] }), "re-run status"],
	["stopped", facts({ workers: [dir([stopped(100)])] }), "check git status, re-dispatch"],
	["not started", facts({ workers: [dir([])] }), "launch run.sh"],
	["failed", facts({ workers: [dir([exited(1, 100)])] }), "read stderr.log, fix brief, re-dispatch"],
	["blocked", facts({ workers: [dir([exited(0, 100)], { blockers: ["needs a token"] })] }), "resolve the report's blocker"],
	["reviewing", facts({ reviews: [dir([running(200)])] }), "wait for the review"],
	["needs fixes", facts({ reviews: [dir([exited(0, 200)], { verdict: "request changes" })] }), "send a correction follow-up"],
	["review unclear", facts({ reviews: [dir([exited(0, 200)])] }), "read the review report"],
	["needs review", facts(), "run the advisor review"],
	["ready to ship", facts({ reviews: [dir([exited(0, 200)], { verdict: "ship" })] }), "/vpk-git-ship"],
	["PR open", facts({ reviews: [dir([exited(0, 200)], { verdict: "ship" })], pr: { number: 12, state: "OPEN" } }), "/vpk-git-ship --merge 12"],
	["PR closed", facts({ reviews: [dir([exited(0, 200)], { verdict: "ship" })], pr: { number: 12, state: "CLOSED" } }), "reopen, or confirm abandoned and run /vpk-git-clean"],
	["merged", facts({ pr: { number: 12, state: "MERGED" } }), "/vpk-git-clean"],
	["done", facts({ pr: { number: 12, state: "MERGED" }, git: { ...GIT, localBranch: false, worktreeExists: false, ahead: null } }), "none"],
	["done (read-only)", facts({ readOnly: true, git: GONE }), "read the report"],
	["no commits", facts({ git: { ...GIT, ahead: 0 } }), "check git status in the worktree"],
];

for (const [status, input, nextAction] of STATUS_CASES) {
	test(`deriveStatus: ${status}`, () => {
		assert.deepEqual(deriveStatus(input), { status, nextAction });
	});
}

test("deriveStatus: a worker run newer than the review clears needs fixes", () => {
	const input = facts({
		workers: [dir([exited(0, 100), exited(0, 300)])],
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
			dir([exited(0, 250)], { verdict: "ship with nits" }),
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

// ── Review findings, one test each ────────────────────────────────────────────

test("finding 1: a missing or unrecognised verdict is review unclear, never approval", () => {
	assert.equal(parseVerdict("Do not ship.\n"), null);
	assert.equal(parseVerdict("Verdict: approve"), null);
	assert.equal(parseVerdict("**Verdict: request changes.**"), "request changes");
	assert.equal(parseVerdict("## Verdict — Ship with nits (two typos)"), "ship with nits");
	assert.equal(parseVerdict("verdict: SHIP"), "ship");
	assert.equal(parseVerdict("Verdict: shipping blocked"), null);
	for (const verdict of [null, "approve"]) {
		const input = facts({ reviews: [dir([exited(0, 200)], { verdict })] });
		assert.deepEqual(deriveStatus(input), { status: "review unclear", nextAction: "read the review report" });
	}
	assert.equal(deriveStatus(facts({ reviews: [dir([exited(0, 200)], { verdict: "ship with nits" })] })).status, "ready to ship");
});

test("finding 2: a failed worker run stays failed after a later approving review", () => {
	const input = facts({
		workers: [dir([exited(1, 100)])],
		reviews: [dir([exited(0, 200)], { verdict: "ship" })],
	});
	assert.equal(deriveStatus(input).status, "failed");
});

test("finding 4: a review only counts for worker runs that ended before it started", () => {
	// The review started at 150, before the correction ended at 300, and finished at 400.
	const startedEarly = facts({
		workers: [dir([exited(0, 100), exited(0, 300, 200)])],
		reviews: [dir([exited(0, 400, 150)], { verdict: "ship" })],
	});
	assert.equal(deriveStatus(startedEarly).status, "needs review");
	// An older review finished after a newer one started: the running one still means reviewing.
	const newerRunning = facts({
		reviews: [dir([exited(0, 500, 150)], { verdict: "ship" }), dir([running(200)])],
	});
	assert.equal(deriveStatus(newerRunning).status, "reviewing");
	// A stopped review is no verdict: the approved review before it still counts.
	const stoppedLast = facts({
		workers: [dir([exited(1, 100), exited(0, 300, 200)])],
		reviews: [dir([exited(0, 400, 350)], { verdict: "ship" }), dir([stopped(450)])],
	});
	assert.equal(deriveStatus(stoppedLast).status, "ready to ship");
});

test("finding 6: unknown git or gh facts give unknown, never a negative fact", () => {
	assert.equal(deriveStatus(facts({ git: { ...GIT, localBranch: null, ahead: null } })).status, "unknown");
	assert.equal(deriveStatus(facts({ git: { ...GIT, ahead: null } })).status, "unknown");
	assert.equal(deriveStatus(facts({ pr: "unknown" })).status, "unknown");
});

test("finding 8: a PR closed without merging stays active even once its branch is gone", () => {
	const input = facts({
		reviews: [dir([exited(0, 200)], { verdict: "ship" })],
		pr: { number: 9, state: "CLOSED" },
		git: { ...GIT, localBranch: false, worktreeExists: false, ahead: null },
	});
	assert.deepEqual(deriveStatus(input), { status: "PR closed", nextAction: "reopen, or confirm abandoned and run /vpk-git-clean" });
});

test("finding 9: read-only work is classified before any shipping check", () => {
	const input = facts({ readOnly: true, git: GIT });
	assert.equal(deriveStatus(input).status, "done (read-only)");
	assert.equal(deriveStatus(facts({ readOnly: true, workers: [dir([exited(1, 100)])] })).status, "failed");
});

test("a review-only task is read-only, and its report's blockers do not block it", () => {
	const input = facts({ readOnly: true, workers: [], reviews: [dir([exited(0, 200)], { blockers: ["The P1 findings block shipping."], verdict: "request changes" })], git: GONE });
	assert.equal(deriveStatus(input).status, "done (read-only)");
	assert.equal(deriveStatus({ ...input, reviews: [dir([running(300)])] }).status, "running");
});

test("finding 10: task.json fields of the wrong type are dropped", () => {
	assert.deepEqual(sanitizeTask({ goal: 42, worktree: { path: "/x" }, branch: 7, kind: "bogus", advisor: "no", name: "vpk-fix-x" }), { name: "vpk-fix-x" });
	assert.deepEqual(sanitizeTask({ branch: null, worktree: null, kind: "research" }), { branch: null, worktree: null, kind: "research" });
	assert.equal(sanitizeTask([1, 2]), null);
	assert.equal(sanitizeTask("x"), null);
});

// ── Second review, one test each ──────────────────────────────────────────────

test("review 2.1: the latest started review decides, even when an older one finishes last", () => {
	// A starts first; B starts later and rejects; A finishes last and approves.
	const input = facts({
		reviews: [
			dir([exited(0, 400, 150)], { verdict: "ship" }),
			dir([exited(0, 300, 200)], { verdict: "request changes" }),
		],
	});
	assert.equal(deriveStatus(input).status, "needs fixes");
});

test("review 2.2: a read-only task with any live run is running", () => {
	// The Claude re-dispatch started at 50 and still runs; the GPT run started at 80 and ended.
	const input = facts({ readOnly: true, git: GONE, workers: [dir([running(50)]), dir([exited(0, 100, 80)])] });
	assert.equal(deriveStatus(input).status, "running");
	const reviewOnly = facts({ readOnly: true, git: GONE, workers: [], reviews: [dir([running(50)]), dir([exited(0, 100, 80)])] });
	assert.equal(deriveStatus(reviewOnly).status, "running");
});

test("review 2.4: the most recently created PR speaks for the branch, not the merged one", () => {
	const merged = { number: 30, state: "MERGED", createdAt: "2026-10-01T00:00:00Z" };
	const closed = { number: 41, state: "CLOSED", createdAt: "2026-10-20T00:00:00Z" };
	const open = { number: 12, state: "OPEN", createdAt: "2026-09-01T00:00:00Z" };
	assert.equal(pickPr([merged, closed]), closed);
	assert.equal(pickPr([open, merged]), merged);
	assert.equal(pickPr([]), null);
});

test("review 2.5: only the worker process counts, never a pager, editor, or grep", () => {
	const script = "/o/remote-gpt/vpk-fix-x/run.sh";
	const live = (command) => runIsAlive(script, "/o/remote-gpt/vpk-fix-x", parseProcessList(`  9 ${command}`));
	for (const command of [`less ${script}`, `vim ${script}`, `grep -n codex ${script}`, `tail -f /o/remote-gpt/vpk-fix-x/events.jsonl`, `cat /o/remote-gpt/vpk-fix-x/report.md`, `rg 'codex exec' /o/remote-gpt/vpk-fix-x/`]) {
		assert.equal(live(command), false, command);
	}
	for (const command of [`bash ${script}`, `/bin/bash ${script}`, `node scripts/agent-surface.js run --script ${script} --label vpk-fix-x`, "codex exec -C /w --output-last-message /o/remote-gpt/vpk-fix-x/report.md -", "/usr/local/bin/codex --ignore-user-config exec --output-last-message /o/remote-gpt/vpk-fix-x/report.md -"]) {
		assert.equal(live(command), true, command);
	}
	// The pane runner and a sibling task's directory are someone else's.
	assert.equal(live(`bash ${script}.pane.sh`), false);
	assert.equal(live("codex exec --output-last-message /o/remote-gpt/vpk-fix-x-review/report.md -"), false);
});

test("review 2.7: Blockers is empty only when blank or just None", () => {
	for (const body of ["", "- None", "- None.", "None"]) {
		assert.deepEqual(parseBlockers(`## Blockers\n${body}\n`), [], JSON.stringify(body));
	}
	assert.deepEqual(parseBlockers("## Blockers\nNone of the required checks could run because the gateway is down.\n"), ["None of the required checks could run because the gateway is down."]);
	assert.deepEqual(parseBlockers("## Blockers\n- None. Playwright ran unsandboxed.\n"), []);
	assert.deepEqual(parseBlockers("## Blockers\n- None — the dev server needed a restart.\n"), []);
	assert.deepEqual(parseBlockers("## Blockers\nNone yet, the gateway is still down.\n"), ["None yet, the gateway is still down."]);
	assert.deepEqual(parseBlockers("## Blockers\n- Nonexistent API key\n"), ["Nonexistent API key"]);
	assert.deepEqual(parseBlockers("## Blockers\n- No blockers, but CI is red\n"), ["No blockers, but CI is red"]);
	const blocked = facts({ advisor: false, workers: [dir([exited(0, 100)], { blockers: parseBlockers("## Blockers\nNone of the checks ran.\n") })] });
	assert.equal(deriveStatus(blocked).status, "blocked");
});

test("parseRunRecords pairs start and end lines per launch and skips junk", () => {
	const records = parseRunRecords([
		'{"script":"run.sh","startedAt":"2026-10-24T10:00:00.000Z","endedAt":null,"exit":null}',
		"not json",
		'{"script":"run.sh","startedAt":"2026-10-24T10:00:00.000Z","endedAt":"2026-10-24T10:05:00Z","exit":0}',
		'{"script":"run.sh","startedAt":"2026-10-24T11:00:00.000Z","endedAt":null,"exit":null}',
		'{"script":"../evil.sh","startedAt":"2026-10-24T11:00:00.000Z"}',
	].join("\n"));
	assert.deepEqual(records, [
		{ script: "run.sh", startedAt: Date.parse("2026-10-24T10:00:00.000Z"), endedAt: Date.parse("2026-10-24T10:05:00Z"), exitCode: 0 },
		{ script: "run.sh", startedAt: Date.parse("2026-10-24T11:00:00.000Z"), endedAt: null, exitCode: null },
	]);
});

// ── Pure parsing ──────────────────────────────────────────────────────────────

test("parseBlockers reads the section up to the next heading", () => {
	assert.deepEqual(parseBlockers("## Findings\n- a\n\n## Blockers\n- None.\n"), []);
	assert.deepEqual(parseBlockers("## Blockers\n- Gateway returned 401\n\n## Next\n- x\n"), ["Gateway returned 401"]);
	assert.deepEqual(parseBlockers("## Blockers\n\n## Next\n- x\n"), []);
	assert.deepEqual(parseBlockers("no section here"), []);
});

test("groupKeyFor and roleFor: task.json kind decides, the name only without it", () => {
	assert.equal(groupKeyFor("vpk-fix-x-review"), "vpk-fix-x");
	assert.equal(groupKeyFor("vpk-fix-x-review-2"), "vpk-fix-x");
	assert.equal(groupKeyFor("vpk-feat-reviewer"), "vpk-feat-reviewer");
	assert.equal(roleFor("vpk-fix-x-review", null), "review");
	assert.equal(roleFor("vpk-feat-code-review", { kind: "worker" }), "worker");
	assert.equal(roleFor("vpk-fix-x", { kind: "review" }), "review");
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
	assert.equal(formatAge(null), null);
});

test("parseArgs: --json is the default's alias; no width options remain", () => {
	assert.deepEqual(parseArgs(["--all", "--task", "vpk-fix-x"]), { all: true, markdown: false, task: "vpk-fix-x" });
	assert.equal(parseArgs(["--json"]).markdown, false);
	assert.equal(parseArgs(["--markdown"]).markdown, true);
	assert.throws(() => parseArgs(["--width", "80"]), /unknown option --width/u);
	assert.throws(() => parseArgs(["--task"]), /needs a name/u);
});

// ── Markdown ──────────────────────────────────────────────────────────────────

function row(name, status, overrides = {}) {
	return { name, status, goal: "", nextAction: "none", pr: null, ...overrides };
}

test("renderMarkdown prints a plain table: header, separator, one row per task", () => {
	const markdown = renderMarkdown([
		row("vpk-feat-ui-generation", "PR open", { goal: "Generate UI", pr: { number: 1984, state: "OPEN" }, nextAction: "/vpk-git-ship --merge 1984" }),
		row("vpk-feat-gh", "unknown", { pr: "unknown", nextAction: "re-run status" }),
	]);
	assert.deepEqual(markdown.split("\n").map(parseTableRow), [
		["Task", "Status", "PR", "Next action"],
		["---", "---", "---", "---"],
		["`vpk-feat-ui-generation` — Generate UI", "PR open", "#1984 open", "/vpk-git-ship --merge 1984"],
		["`vpk-feat-gh`", "unknown", "?", "re-run status"],
	]);
	assert.equal(renderMarkdown([]), "No vpk-remote tasks found.");
	assert.match(renderMarkdown([], { hidden: 3 }), /3 done or e2e hidden \(--all shows them\)/u);
});

// Splits a GFM table row on pipes not escaped by a backslash, then unescapes each cell.
function parseTableRow(line) {
	const cells = [];
	let cell = "";
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (char === "\\" && index + 1 < line.length) {
			cell += line[index + 1];
			index += 1;
		} else if (char === "|") {
			cells.push(cell.trim());
			cell = "";
		} else {
			cell += char;
		}
	}
	cells.push(cell.trim());
	return cells.slice(1, -1);
}

test("review 2.6: backslashes and pipes survive as cell text, newlines as spaces", () => {
	const markdown = renderMarkdown([
		row("vpk-fix-slash", "running", { goal: "split a \\| b\nthen C:\\path\\", nextAction: "wait \\\\| then\r\nship" }),
		row("vpk-feat-plain", "PR open", { pr: { number: 7, state: "OPEN" }, nextAction: "/vpk-git-ship --merge 7" }),
	]);
	const rows = markdown.split("\n").map(parseTableRow);
	assert.deepEqual(rows.map((cells) => cells.length), [4, 4, 4, 4]);
	assert.deepEqual(rows[2], ["`vpk-fix-slash` — split a \\| b then C:\\path\\", "running", "—", "wait \\\\| then ship"]);
	assert.deepEqual(rows[3], ["`vpk-feat-plain`", "PR open", "#7 open", "/vpk-git-ship --merge 7"]);
});

// ── Collection against a fixture checkout ─────────────────────────────────────

const NOW = Date.parse("2026-10-24T12:00:00Z");
const MINUTE = 60_000;

function writeFile(file, text, atMs) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, text);
	if (atMs) fs.utimesSync(file, new Date(atMs), new Date(atMs));
}

// One run: run.sh written at `start`, its exit file (if any) at `end`.
function writeRun(dirPath, { script = "run.sh", start, end, exitCode = 0, report }) {
	writeFile(path.join(dirPath, script), "exit 0\n", start);
	if (end !== undefined) writeFile(path.join(dirPath, `${script}.exit`), `${exitCode}\n`, end);
	if (report !== undefined) writeFile(path.join(dirPath, "report.md"), report, end ?? start);
}

// A main checkout holding output/remote-*/ directories. Nothing here is a real git repo:
// the fake runner answers every git, gh, ps, and herdr call.
function fixtureCheckout() {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-remote-status-")));
	const out = (lane, name) => path.join(root, "output", `remote-${lane}`, name);
	const tree = path.join(root, ".claude", "worktrees", "vpk-feat-alpha");

	// A worker with task.json, finished, reviewed twice; the newer review approves.
	writeFile(path.join(out("claude", "vpk-feat-alpha"), "task.json"), JSON.stringify({
		name: "vpk-feat-alpha", goal: "Add the alpha panel",
		type: "feat", branch: "vpk/feat-alpha", worktree: ".claude/worktrees/vpk-feat-alpha",
		lane: "claude", kind: "worker", createdAt: new Date(NOW - 130 * MINUTE).toISOString(),
	}));
	writeRun(out("claude", "vpk-feat-alpha"), { start: NOW - 120 * MINUTE, end: NOW - 90 * MINUTE, report: "## Findings\n- done\n\n## Blockers\n- None\n" });
	writeRun(out("gpt", "vpk-feat-alpha-review"), { start: NOW - 85 * MINUTE, end: NOW - 80 * MINUTE, report: "**Verdict: request changes.**\n" });
	writeRun(out("gpt", "vpk-feat-alpha-review-2"), { start: NOW - 70 * MINUTE, end: NOW - 60 * MINUTE, report: "**Verdict: ship.**\n" });

	// A legacy worker: no task.json, no exit file, but its process is alive.
	writeFile(path.join(out("claude", "vpk-fix-beta"), "brief.md"), "fix beta\n", NOW - 12 * MINUTE);
	writeRun(out("claude", "vpk-fix-beta"), { start: NOW - 12 * MINUTE });

	// A read-only research run that finished.
	writeRun(out("gpt", "vpk-research-gamma"), { start: NOW - 300 * MINUTE, end: NOW - 290 * MINUTE, report: "found it\n" });

	return { root, tree, out };
}

function fakeRunner({ root, tree }, { gh = "ok", ahead = "3", treeBranch = "vpk/feat-alpha", fail = [], extraTrees = "", prs = {}, branches = [], renames = [] } = {}) {
	const calls = [];
	const ok = (stdout) => ({ ok: true, stdout, stderr: "" });
	const failed = { ok: false, stdout: "", stderr: "timed out" };
	const runCommand = async (command, args) => {
		calls.push([command, ...args]);
		const line = [command, ...args].join(" ");
		if (line === "git worktree list --porcelain") {
			return ok(`worktree ${root}\nHEAD abc\nbranch refs/heads/main\n\nworktree ${tree}\nHEAD def\nbranch refs/heads/${treeBranch}\n${extraTrees}`);
		}
		if (line.startsWith("git for-each-ref")) return fail.includes("branches") ? failed : ok(`${["main", treeBranch, ...branches].join("\n")}\n`);
		if (line.startsWith("git log -g --branches")) {
			return fail.includes("renames") ? failed : ok(renames.map(([from, to]) => `Branch: renamed refs/heads/${from} to refs/heads/${to}\n`).join(""));
		}
		if (line.startsWith("git rev-list --count")) return ok(`${ahead}\n`);
		if (line.startsWith(`git -C ${tree} status`)) return ok("");
		if (command === "ps") {
			return fail.includes("ps") ? failed : ok(`  77 bash ${path.join(root, "output", "remote-claude", "vpk-fix-beta", "run.sh")}\n`);
		}
		if (command === "gh") {
			if (gh === "fail") return { ok: false, stdout: "", stderr: "gh: not logged in" };
			const data = { repository: {} };
			for (const arg of args) {
				const match = /^(b\d+)=(.*)$/u.exec(arg);
				if (match) data.repository[match[1]] = { nodes: prs[match[2]] ?? [] };
			}
			return ok(JSON.stringify({ data }));
		}
		return { ok: false, stdout: "", stderr: `unexpected ${line}` };
	};
	return { runCommand, calls };
}

async function statusOf(fixture, options = {}) {
	const { runCommand, calls } = fakeRunner(fixture, options);
	const result = await collectStatus({ cwd: fixture.root, runCommand, env: options.env ?? {}, now: NOW });
	return { result, calls, byName: Object.fromEntries(result.tasks.map((task) => [task.name, task])) };
}

test("collectStatus groups a worker with its -review runs and reads legacy directories", async () => {
	const fixture = fixtureCheckout();
	const { result, calls, byName } = await statusOf(fixture);

	assert.deepEqual(result.observations, { ps: "ok", branches: "ok", gh: "ok" });
	assert.deepEqual(Object.keys(byName).sort(), ["vpk-feat-alpha", "vpk-fix-beta", "vpk-research-gamma"]);

	const alpha = byName["vpk-feat-alpha"];
	assert.deepEqual(alpha.runs.map((run) => run.dir), ["vpk-feat-alpha", "vpk-feat-alpha-review", "vpk-feat-alpha-review-2"]);
	assert.equal(alpha.status, "ready to ship");
	assert.equal(alpha.ahead, 3);
	assert.equal(alpha.dirty, false);
	assert.equal(alpha.goal, "Add the alpha panel");

	assert.deepEqual([byName["vpk-fix-beta"].status, byName["vpk-fix-beta"].goal, byName["vpk-fix-beta"].kind], ["running", "", "worker"]);
	assert.equal(byName["vpk-research-gamma"].status, "done (read-only)");
	assert.equal(calls.filter(([command]) => command === "gh").length, 1, "one batched gh call");
	assert.equal(calls.some(([command]) => command === "herdr"), false, "herdr skipped outside herdr");
});

test("collectStatus reports PR open and herdr surfaces", async () => {
	const fixture = fixtureCheckout();
	const { runCommand: base } = fakeRunner(fixture, { prs: { "vpk/feat-alpha": [{ number: 7, state: "OPEN", url: "https://x/7" }] } });
	const runCommand = async (command, args) => {
		if (command === "herdr") {
			const key = args[0] === "workspace" ? "workspaces" : "tabs";
			return { ok: true, stdout: JSON.stringify({ result: { [key]: [{ label: "vpk-feat-alpha" }] } }), stderr: "" };
		}
		return base(command, args);
	};
	const result = await collectStatus({ cwd: fixture.root, runCommand, env: { HERDR_ENV: "1" }, now: NOW });
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.deepEqual([alpha.status, alpha.nextAction, alpha.herdrOpen], ["PR open", "/vpk-git-ship --merge 7", true]);
	assert.deepEqual(alpha.pr, { number: 7, state: "OPEN", url: "https://x/7" });
	assert.equal(result.tasks.find((task) => task.name === "vpk-fix-beta").herdrOpen, false);
});

test("a gh failure reads unknown and never throws", async () => {
	const fixture = fixtureCheckout();
	const { result, byName } = await statusOf(fixture, { gh: "fail" });
	assert.equal(result.observations.gh, "failed");
	assert.deepEqual([byName["vpk-feat-alpha"].pr, byName["vpk-feat-alpha"].status], ["unknown", "unknown"]);
});

test("finding 3: the same name in both lanes is one task with both lanes' runs", async () => {
	const fixture = fixtureCheckout();
	// An older, finished GPT dispatch of beta; the Claude re-dispatch is still running.
	writeRun(fixture.out("gpt", "vpk-fix-beta"), { start: NOW - 200 * MINUTE, end: NOW - 190 * MINUTE, report: "done\n" });
	const { result, byName } = await statusOf(fixture);
	assert.equal(result.tasks.filter((task) => task.name === "vpk-fix-beta").length, 1);
	const beta = byName["vpk-fix-beta"];
	assert.equal(beta.status, "running");
	assert.deepEqual(beta.runs.map((run) => `${run.lane}:${run.state}`), ["gpt:exited", "claude:running"]);
	assert.deepEqual(beta.reports.map((report) => report.path.includes("remote-gpt")).sort(), [false, true]);
});

test("finding 5: kind worker is never a review, and a shared legacy worktree is no tie", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-feat-code-review"), "task.json"), JSON.stringify({ name: "vpk-feat-code-review", goal: "Build code review", kind: "worker", branch: "vpk/feat-code-review", worktree: ".claude/worktrees/vpk-feat-code-review" }));
	writeRun(fixture.out("claude", "vpk-feat-code-review"), { start: NOW - 30 * MINUTE });
	writeRun(fixture.out("claude", "vpk-feat-code"), { start: NOW - 40 * MINUTE, end: NOW - 35 * MINUTE });
	// Two unrelated legacy tasks that happened to reuse one worktree path.
	for (const name of ["vpk-fix-one", "vpk-fix-two"]) {
		writeFile(path.join(fixture.out("claude", name), "run.sh"), `cd "${path.join(fixture.root, ".claude", "worktrees", "shared")}" || exit 1\n`, NOW - 50 * MINUTE);
		writeFile(path.join(fixture.out("claude", name), "run.sh.exit"), "0\n", NOW - 45 * MINUTE);
	}
	const { byName } = await statusOf(fixture);
	assert.equal(byName["vpk-feat-code-review"]?.goal, "Build code review");
	assert.deepEqual(byName["vpk-feat-code"].runs.map((run) => run.dir), ["vpk-feat-code"]);
	assert.deepEqual([byName["vpk-fix-one"]?.runs.length, byName["vpk-fix-two"]?.runs.length], [1, 1]);
});

test("finding 6: a failed ps or branch lookup records unknown, not stopped or no commits", async () => {
	const fixture = fixtureCheckout();
	const { result, byName } = await statusOf(fixture, { fail: ["ps", "branches"] });
	assert.deepEqual(result.observations, { ps: "failed", branches: "failed", gh: "ok" });
	assert.deepEqual([byName["vpk-fix-beta"].status, byName["vpk-fix-beta"].nextAction], ["unknown", "re-run status"]);
	assert.deepEqual([byName["vpk-feat-alpha"].localBranch, byName["vpk-feat-alpha"].status], [null, "unknown"]);
});

test("finding 7: the branch checked out in the worktree beats task.json's", async () => {
	const fixture = fixtureCheckout();
	const { byName, calls } = await statusOf(fixture, { treeBranch: "vpk/feat-alpha-panel" });
	assert.equal(byName["vpk-feat-alpha"].branch, "vpk/feat-alpha-panel");
	assert.equal(byName["vpk-feat-alpha"].status, "ready to ship");
	assert.equal(calls.some((call) => call.includes("origin/main..refs/heads/vpk/feat-alpha-panel")), true);
});

test("finding 8: a closed PR whose branch and worktree are gone shows PR closed by default", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-fix-delta"), "task.json"), JSON.stringify({ goal: "Delta", kind: "worker", branch: "vpk/fix-delta", worktree: ".claude/worktrees/vpk-fix-delta" }));
	writeRun(fixture.out("claude", "vpk-fix-delta"), { start: NOW - 60 * MINUTE, end: NOW - 50 * MINUTE });
	writeRun(fixture.out("gpt", "vpk-fix-delta-review"), { start: NOW - 40 * MINUTE, end: NOW - 30 * MINUTE, report: "Verdict: ship\n" });
	const { runCommand } = fakeRunner(fixture, { prs: { "vpk/fix-delta": [{ number: 21, state: "CLOSED", url: "https://x/21" }] } });
	const stdout = captureStdout();
	await main(["--markdown"], { stdout, env: {}, cwd: fixture.root, runCommand, now: NOW });
	assert.match(stdout.text, /\| `vpk-fix-delta` — Delta \| PR closed \| #21 closed \| reopen, or confirm abandoned and run \/vpk-git-clean \|/u);
});

test("finding 9: research in an existing feature worktree is read-only, not shippable", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("gpt", "vpk-feat-alpha-notes"), "task.json"), JSON.stringify({ goal: "Survey alpha", kind: "worker", branch: null, worktree: null }));
	writeFile(path.join(fixture.out("gpt", "vpk-feat-alpha-notes"), "run.sh"), `codex exec -C "${fixture.tree}" \\\n`, NOW - 20 * MINUTE);
	writeFile(path.join(fixture.out("gpt", "vpk-feat-alpha-notes"), "run.sh.exit"), "0\n", NOW - 10 * MINUTE);
	const { byName } = await statusOf(fixture, { treeBranch: "vpk/feat-alpha" });
	const notes = byName["vpk-feat-alpha-notes"];
	assert.deepEqual([notes.status, notes.branch, notes.pr], ["done (read-only)", null, null]);
});

test("finding 10: malformed task.json fields neither crash collection nor rendering", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-fix-odd"), "task.json"), JSON.stringify({ goal: 42, worktree: { path: "/x" }, branch: ["a"], kind: 7, createdAt: 5, advisor: "no" }));
	writeRun(fixture.out("claude", "vpk-fix-odd"), { start: NOW - 5 * MINUTE, end: NOW - 4 * MINUTE });
	writeFile(path.join(fixture.out("claude", "vpk-fix-broken"), "task.json"), "{ not json");
	writeRun(fixture.out("claude", "vpk-fix-broken"), { start: NOW - 5 * MINUTE, end: NOW - 4 * MINUTE });
	const { runCommand } = fakeRunner(fixture);
	const stdout = captureStdout();
	await main(["--markdown", "--all"], { stdout, env: {}, cwd: fixture.root, runCommand, now: NOW });
	assert.match(stdout.text, /\| `vpk-fix-odd` \| /u);
	assert.match(stdout.text, /\| `vpk-fix-broken` \| /u);
});

// A runs.jsonl as agent-surface writes it: a start line per launch, an end line per exit.
function writeRunRecords(dirPath, runs) {
	const lines = runs.flatMap(({ script = "run.sh", start, end, exitCode = 0 }) => {
		const startedAt = new Date(start).toISOString();
		const begin = JSON.stringify({ script, startedAt, endedAt: null, exit: null });
		return end === undefined ? [begin] : [begin, JSON.stringify({ script, startedAt, endedAt: new Date(end).toISOString(), exit: exitCode })];
	});
	writeFile(path.join(dirPath, "runs.jsonl"), `${lines.join("\n")}\n`);
}

test("a reused review directory: the second run's request changes gives needs fixes", async () => {
	const fixture = fixtureCheckout();
	const review = fixture.out("gpt", "vpk-feat-alpha-review-2");
	// run.sh is written once, before the worker's correction; it then runs twice.
	writeRun(fixture.out("claude", "vpk-feat-alpha"), { script: "run-1.sh", start: NOW - 55 * MINUTE, end: NOW - 40 * MINUTE });
	writeRunRecords(review, [
		{ start: NOW - 70 * MINUTE, end: NOW - 60 * MINUTE },
		{ start: NOW - 35 * MINUTE, end: NOW - 25 * MINUTE },
	]);
	writeFile(path.join(review, "report-0.md"), "Verdict: ship\n", NOW - 60 * MINUTE);
	writeFile(path.join(review, "report.md"), "Verdict: request changes\n", NOW - 25 * MINUTE);
	writeFile(path.join(review, "run.sh.exit"), "0\n", NOW - 25 * MINUTE);
	const { byName } = await statusOf(fixture);
	const alpha = byName["vpk-feat-alpha"];
	assert.equal(alpha.status, "needs fixes");
	const reviewRuns = alpha.runs.filter((run) => run.dir === "vpk-feat-alpha-review-2");
	assert.deepEqual(reviewRuns.map((run) => [run.script, run.verdict, path.basename(run.report)]), [["run.sh", "ship", "report-0.md"], ["run.sh", "request changes", "report.md"]]);
});

test("report.md belongs to the run that last wrote it; earlier runs read their snapshot", async () => {
	const fixture = fixtureCheckout();
	const worker = fixture.out("claude", "vpk-feat-alpha");
	// A second run is live and has emptied report.md; the first run's report is report-0.md.
	writeRunRecords(worker, [{ start: NOW - 120 * MINUTE, end: NOW - 90 * MINUTE }, { script: "run-1.sh", start: NOW - 5 * MINUTE }]);
	writeFile(path.join(worker, "run-1.sh"), "exit 0\n", NOW - 5 * MINUTE);
	writeFile(path.join(worker, "report.md"), "", NOW - 5 * MINUTE);
	writeFile(path.join(worker, "report-0.md"), "## Blockers\n- Gateway returned 401\n", NOW - 90 * MINUTE);
	const { runCommand } = fakeRunner(fixture);
	const withWorker = async (command, args) => (command === "ps" ? { ok: true, stdout: `  90 bash ${path.join(worker, "run-1.sh")}\n`, stderr: "" } : runCommand(command, args));
	const result = await collectStatus({ cwd: fixture.root, runCommand: withWorker, env: {}, now: NOW });
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.deepEqual(alpha.runs.filter((run) => run.role === "worker").map((run) => [run.script, run.state, path.basename(run.report ?? "-")]), [["run.sh", "exited", "report-0.md"], ["run-1.sh", "running", "report.md"]]);
});

test("the latest started review wins over an older one that finished last", async () => {
	const fixture = fixtureCheckout();
	const a = fixture.out("gpt", "vpk-feat-alpha-review");
	const b = fixture.out("gpt", "vpk-feat-alpha-review-2");
	writeRunRecords(a, [{ start: NOW - 85 * MINUTE, end: NOW - 50 * MINUTE }]);
	writeFile(path.join(a, "report.md"), "Verdict: ship\n", NOW - 50 * MINUTE);
	writeFile(path.join(a, "run.sh.exit"), "0\n", NOW - 50 * MINUTE);
	writeRunRecords(b, [{ start: NOW - 75 * MINUTE, end: NOW - 65 * MINUTE }]);
	writeFile(path.join(b, "report.md"), "Verdict: request changes\n", NOW - 65 * MINUTE);
	writeFile(path.join(b, "run.sh.exit"), "0\n", NOW - 65 * MINUTE);
	const { byName } = await statusOf(fixture);
	assert.equal(byName["vpk-feat-alpha"].status, "needs fixes");
});

test("a legacy reused run script is dated by its pane runner, not the stale script", async () => {
	const fixture = fixtureCheckout();
	const review = fixture.out("gpt", "vpk-feat-alpha-review-2");
	writeRun(fixture.out("claude", "vpk-feat-alpha"), { script: "run-1.sh", start: NOW - 55 * MINUTE, end: NOW - 40 * MINUTE });
	// No runs.jsonl: run.sh dates from the first review, its .pane.sh from the relaunch.
	writeFile(path.join(review, "run.sh.pane.sh"), "bash run.sh\n", NOW - 35 * MINUTE);
	writeFile(path.join(review, "report.md"), "Verdict: request changes\n", NOW - 25 * MINUTE);
	writeFile(path.join(review, "run.sh.exit"), "0\n", NOW - 25 * MINUTE);
	const { byName } = await statusOf(fixture);
	assert.equal(byName["vpk-feat-alpha"].status, "needs fixes");
	// A .start file outranks both file times.
	writeFile(path.join(review, "run.sh.start"), `${new Date(NOW - 65 * MINUTE).toISOString()}\n`);
	assert.equal((await statusOf(fixture)).byName["vpk-feat-alpha"].status, "needs review");
});

test("review 2.3: a legacy task whose branch and worktree are gone is unknown when gh fails", async () => {
	const fixture = fixtureCheckout();
	const legacy = fixture.out("claude", "vpk-fix-legacy");
	writeFile(path.join(legacy, "run.sh"), `cd "${path.join(fixture.root, ".claude", "worktrees", "vpk-fix-legacy")}" || exit 1\n`, NOW - 50 * MINUTE);
	writeFile(path.join(legacy, "run.sh.exit"), "0\n", NOW - 45 * MINUTE);
	const { byName } = await statusOf(fixture, { gh: "fail" });
	assert.deepEqual([byName["vpk-fix-legacy"].status, byName["vpk-fix-legacy"].pr], ["unknown", "unknown"]);
	assert.equal((await statusOf(fixture)).byName["vpk-fix-legacy"].status, "done");
});

test("review 2.4: a newer closed PR beats an older merged one once the branch is gone", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-fix-delta"), "task.json"), JSON.stringify({ goal: "Delta", kind: "worker", branch: "vpk/fix-delta", worktree: ".claude/worktrees/vpk-fix-delta", advisor: false }));
	writeRun(fixture.out("claude", "vpk-fix-delta"), { start: NOW - 60 * MINUTE, end: NOW - 50 * MINUTE });
	const prs = { "vpk/fix-delta": [
		{ number: 30, state: "MERGED", url: "https://x/30", createdAt: "2026-10-01T00:00:00Z" },
		{ number: 41, state: "CLOSED", url: "https://x/41", createdAt: "2026-10-20T00:00:00Z" },
	] };
	const { byName } = await statusOf(fixture, { prs });
	assert.deepEqual([byName["vpk-fix-delta"].status, byName["vpk-fix-delta"].pr.number], ["PR closed", 41]);
});

test("review 2.5: a pager left open on a dead worker's run script is not the worker", async () => {
	const fixture = fixtureCheckout();
	const script = path.join(fixture.out("claude", "vpk-fix-beta"), "run.sh");
	const { runCommand } = fakeRunner(fixture);
	const withPager = async (command, args) => (command === "ps" ? { ok: true, stdout: `  88 less ${script}\n  89 vim ${script}\n`, stderr: "" } : runCommand(command, args));
	const result = await collectStatus({ cwd: fixture.root, runCommand: withPager, env: {}, now: NOW });
	assert.equal(result.tasks.find((task) => task.name === "vpk-fix-beta").status, "stopped");
});

test("review 2.7: a worker report whose Blockers start with 'None of' is blocked", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-fix-eps"), "task.json"), JSON.stringify({ goal: "Eps", kind: "worker", branch: "vpk/feat-alpha", worktree: ".claude/worktrees/vpk-feat-alpha", advisor: false }));
	writeRun(fixture.out("claude", "vpk-fix-eps"), { start: NOW - 20 * MINUTE, end: NOW - 10 * MINUTE, report: "## Findings\n- x\n\n## Blockers\nNone of the required checks could run because the gateway is down.\n" });
	const { byName } = await statusOf(fixture);
	assert.equal(byName["vpk-fix-eps"].status, "blocked");
});

// ── Third review, one test each ───────────────────────────────────────────────

test("review 3.1: a truncated runs.jsonl line loses only itself, never the record after it", () => {
	const records = parseRunRecords([
		'{"script":"run.sh","startedAt":"2026-10-24T10:00:00.000Z","endedAt":null,"exit":null}',
		// The end line was cut off mid-write; the next launch's start was appended to it.
		'{"script":"run.sh","startedAt":"2026-10-24T10:00:00.000Z","endedAt":"2026-10-2{"script":"run.sh","startedAt":"2026-10-24T11:00:00.000Z","endedAt":null,"exit":null}',
	].join("\n"));
	assert.deepEqual(records.map((record) => [new Date(record.startedAt).toISOString(), record.endedAt]), [["2026-10-24T10:00:00.000Z", null], ["2026-10-24T11:00:00.000Z", null]]);
});

test("review 3.1: a .start newer than every record is a newer run, even with its start line lost", async () => {
	const fixture = fixtureCheckout();
	const worker = fixture.out("claude", "vpk-feat-alpha");
	// The first run's records are whole; the relaunch's start line was lost to a cut-off write.
	writeRunRecords(worker, [{ start: NOW - 120 * MINUTE, end: NOW - 90 * MINUTE }]);
	fs.appendFileSync(path.join(worker, "runs.jsonl"), '{"script":"run.sh","startedAt":"2026-10-24T11:5');
	writeFile(path.join(worker, "run.sh.start"), `${new Date(NOW - 5 * MINUTE).toISOString()}\n`);
	const { runCommand } = fakeRunner(fixture);
	const withWorker = async (command, args) => (command === "ps" ? { ok: true, stdout: `  90 bash ${path.join(worker, "run.sh")}\n`, stderr: "" } : runCommand(command, args));
	const result = await collectStatus({ cwd: fixture.root, runCommand: withWorker, env: {}, now: NOW });
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.equal(alpha.status, "running");
	assert.deepEqual(alpha.runs.filter((run) => run.role === "worker").map((run) => run.state), ["exited", "running"]);
});

test("review 3.2: an old merged PR does not settle work that came after it", () => {
	const merged = { number: 30, state: "MERGED", mergedAt: new Date(150).toISOString() };
	// A correction run started after the merge: status comes from the runs as usual.
	const rerun = facts({ workers: [dir([exited(0, 100, 50), exited(0, 300, 200)])], pr: merged });
	assert.equal(deriveStatus(rerun).status, "needs review");
	// Commits on the branch past the merged head, with no newer run on record.
	assert.equal(deriveStatus(facts({ pr: merged, git: { ...GIT, aheadOfMergedPr: 2 } })).status, "needs review");
	assert.equal(deriveStatus(facts({ pr: merged, git: { ...GIT, aheadOfMergedPr: 0 } })).status, "merged");
});

test("review 3.2: a retained merged branch with new commits reads from its runs, not merged", async () => {
	const fixture = fixtureCheckout();
	const prs = { "vpk/feat-alpha": [{ number: 30, state: "MERGED", url: "https://x/30", createdAt: "2026-10-24T09:00:00Z", mergedAt: "2026-10-24T10:30:00Z", headRefOid: "abc123" }] };
	const { runCommand } = fakeRunner(fixture, { prs });
	const pastHead = async (command, args) => (command === "git" && args.includes("abc123..refs/heads/vpk/feat-alpha") ? { ok: true, stdout: "2\n", stderr: "" } : runCommand(command, args));
	const result = await collectStatus({ cwd: fixture.root, runCommand: pastHead, env: {}, now: NOW });
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.deepEqual([alpha.status, alpha.aheadOfMergedPr], ["ready to ship", 2]);
	// The same branch at the merged head is merged.
	const atHead = async (command, args) => (command === "git" && args.includes("abc123..refs/heads/vpk/feat-alpha") ? { ok: true, stdout: "0\n", stderr: "" } : runCommand(command, args));
	const settled = await collectStatus({ cwd: fixture.root, runCommand: atHead, env: {}, now: NOW });
	assert.equal(settled.tasks.find((task) => task.name === "vpk-feat-alpha").status, "merged");
});

test("review 3.3: an unresolved older run leaves the task unknown, even after a completed one", () => {
	// The Claude run's liveness is unknown (ps failed); the GPT re-dispatch started later and finished.
	const workers = [dir([unknown(50)]), dir([exited(0, 100, 80)])];
	assert.equal(deriveStatus(facts({ readOnly: true, git: GONE, workers })).status, "unknown");
	assert.equal(deriveStatus(facts({ advisor: false, workers })).status, "unknown");
	// A review of an earlier worker run may still be live too.
	const reviews = [dir([unknown(60)]), dir([exited(0, 300, 200)], { verdict: "ship" })];
	assert.equal(deriveStatus(facts({ reviews })).status, "unknown");
});

test("review 3.4: a review starting 300 ms after the worker ends counts; one 300 ms before does not", () => {
	const end = Date.parse("2026-10-24T10:00:10.900Z");
	const worker = [dir([exited(0, end, end - 60_000)])];
	const reviewAt = (start) => facts({ workers: worker, reviews: [dir([exited(0, start + 60_000, start)], { verdict: "ship" })] });
	assert.equal(deriveStatus(reviewAt(end + 300)).status, "ready to ship");
	assert.equal(deriveStatus(reviewAt(end - 300)).status, "needs review");
});

test("review 3.5: a merged task whose branch list failed is never done", async () => {
	const unlisted = facts({ pr: { number: 12, state: "MERGED" }, git: { ...GIT, localBranch: null, worktreeExists: false, ahead: null } });
	assert.deepEqual(deriveStatus(unlisted), { status: "merged", nextAction: "re-run status" });
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-fix-delta"), "task.json"), JSON.stringify({ goal: "Delta", kind: "worker", branch: "vpk/fix-delta", worktree: ".claude/worktrees/vpk-fix-delta" }));
	writeRun(fixture.out("claude", "vpk-fix-delta"), { start: NOW - 60 * MINUTE, end: NOW - 50 * MINUTE });
	const prs = { "vpk/fix-delta": [{ number: 21, state: "MERGED", url: "https://x/21", mergedAt: new Date(NOW - 40 * MINUTE).toISOString() }] };
	const { byName } = await statusOf(fixture, { prs, fail: ["branches"] });
	assert.deepEqual([byName["vpk-fix-delta"].status, byName["vpk-fix-delta"].nextAction], ["merged", "re-run status"]);
	assert.equal((await statusOf(fixture, { prs })).byName["vpk-fix-delta"].status, "done");
});

// ── Fourth review, one test each ──────────────────────────────────────────────

test("review 4.1: a recorded rerun that left an older legacy report has no report of its own", async () => {
	const fixture = fixtureCheckout();
	// review-2's legacy run approved at -60m; a recorded rerun ran -30m to -20m and did not rewrite report.md.
	writeRunRecords(fixture.out("gpt", "vpk-feat-alpha-review-2"), [{ start: NOW - 30 * MINUTE, end: NOW - 20 * MINUTE }]);
	const { byName } = await statusOf(fixture);
	const alpha = byName["vpk-feat-alpha"];
	assert.equal(alpha.status, "review unclear");
	assert.deepEqual(alpha.runs.filter((run) => run.dir === "vpk-feat-alpha-review-2").map((run) => [run.verdict, run.report]), [[null, null]]);
	// A worker's stale blockers do not block its rerun either.
	const eps = fixture.out("claude", "vpk-fix-eps");
	writeFile(path.join(eps, "task.json"), JSON.stringify({ goal: "Eps", kind: "worker", branch: "vpk/feat-alpha", worktree: ".claude/worktrees/vpk-feat-alpha" }));
	writeRun(eps, { start: NOW - 50 * MINUTE, end: NOW - 45 * MINUTE, report: "## Blockers\n- Gateway returned 401\n" });
	writeRunRecords(eps, [{ start: NOW - 30 * MINUTE, end: NOW - 20 * MINUTE }]);
	assert.equal((await statusOf(fixture)).byName["vpk-fix-eps"].status, "needs review");
});

test("review 4.2: a branch renamed before its worktree was removed is followed, not done", async () => {
	const fixture = fixtureCheckout();
	writeFile(path.join(fixture.out("claude", "vpk-fix-delta"), "task.json"), JSON.stringify({ goal: "Delta", kind: "worker", branch: "vpk/fix-delta", worktree: ".claude/worktrees/vpk-fix-delta" }));
	writeRun(fixture.out("claude", "vpk-fix-delta"), { start: NOW - 60 * MINUTE, end: NOW - 50 * MINUTE });
	const renamed = { branches: ["vpk/fix-delta-final"], renames: [["vpk/fix-delta", "vpk/fix-delta-panel"], ["vpk/fix-delta-panel", "vpk/fix-delta-final"]] };
	const { byName, calls } = await statusOf(fixture, renamed);
	assert.deepEqual([byName["vpk-fix-delta"].status, byName["vpk-fix-delta"].branch, byName["vpk-fix-delta"].localBranch], ["needs review", "vpk/fix-delta-final", true]);
	assert.equal(calls.some((call) => call.includes("origin/main..refs/heads/vpk/fix-delta-final")), true);
	// Rename history that cannot be read leaves a gone branch unknown; with none, it is done.
	assert.equal((await statusOf(fixture, { ...renamed, fail: ["renames"] })).byName["vpk-fix-delta"].status, "unknown");
	assert.equal((await statusOf(fixture, { branches: ["vpk/fix-delta-final"] })).byName["vpk-fix-delta"].status, "done");
});

test("review 4.3: a run that completes between the file reads and ps is exited, not stopped", async () => {
	const fixture = fixtureCheckout();
	const worker = fixture.out("claude", "vpk-feat-alpha");
	const startedAt = new Date(NOW - 5 * MINUTE).toISOString();
	writeFile(path.join(worker, "run-1.sh"), "exit 0\n", NOW - 5 * MINUTE);
	writeRunRecords(worker, [{ start: NOW - 120 * MINUTE, end: NOW - 90 * MINUTE }, { script: "run-1.sh", start: NOW - 5 * MINUTE }]);
	const { runCommand } = fakeRunner(fixture);
	// The pane writes its end line, exit file, and report while ps runs; ps no longer sees it.
	const finishing = async (command, args) => {
		if (command !== "ps") return runCommand(command, args);
		fs.appendFileSync(path.join(worker, "runs.jsonl"), `${JSON.stringify({ script: "run-1.sh", startedAt, endedAt: new Date(NOW - MINUTE).toISOString(), exit: 0 })}\n`);
		writeFile(path.join(worker, "run-1.sh.exit"), "0\n", NOW - MINUTE);
		writeFile(path.join(worker, "report.md"), "## Blockers\n- None\n", NOW - MINUTE);
		return { ok: true, stdout: "", stderr: "" };
	};
	const result = await collectStatus({ cwd: fixture.root, runCommand: finishing, env: {}, now: NOW });
	const alpha = result.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.deepEqual(alpha.runs.filter((run) => run.role === "worker").map((run) => [run.script, run.state, run.exitCode]), [["run.sh", "exited", 0], ["run-1.sh", "exited", 0]]);
	assert.equal(alpha.status, "needs review");
});

function captureStdout() {
	let text = "";
	return { write: (chunk) => { text += chunk; }, get text() { return text; } };
}

async function run(fixture, argv) {
	const { runCommand } = fakeRunner(fixture);
	const stdout = captureStdout();
	await main(argv, { stdout, env: {}, cwd: fixture.root, runCommand, now: NOW });
	return stdout.text;
}

test("default output is the JSON facts, and --json prints the same", async () => {
	const fixture = fixtureCheckout();
	const text = await run(fixture, []);
	assert.equal(await run(fixture, ["--json"]), text);
	const parsed = JSON.parse(text);
	assert.equal(parsed.mainCheckout, fixture.root);
	assert.deepEqual(parsed.hidden, { e2e: 0, done: 1 });
	const alpha = parsed.tasks.find((task) => task.name === "vpk-feat-alpha");
	assert.deepEqual(Object.keys(alpha), [
		"name", "goal", "kind", "status", "nextAction", "pr",
		"branch", "localBranch", "worktree", "worktreeExists", "dirty", "ahead", "aheadOfMergedPr",
		"createdAt", "age", "lastActivityAt", "idle", "herdrOpen", "runs", "reports",
	]);
	assert.deepEqual([alpha.branch, alpha.worktree, alpha.age, alpha.idle], ["vpk/feat-alpha", fixture.tree, "2h 10m", "1h 0m"]);
	assert.deepEqual(alpha.runs[0], {
		dir: "vpk-feat-alpha", lane: "claude", role: "worker", script: "run.sh", state: "exited", exitCode: 0,
		startedAt: new Date(NOW - 120 * MINUTE).toISOString(), endedAt: new Date(NOW - 90 * MINUTE).toISOString(),
		report: path.join(fixture.out("claude", "vpk-feat-alpha"), "report.md"),
	});
	assert.equal(alpha.runs.at(-1).verdict, "ship");
	assert.deepEqual(alpha.reports.at(-1).verdict, "ship");
});

test("--all shows done tasks and e2e runs; without it they are counted as hidden", async () => {
	const fixture = fixtureCheckout();
	writeRun(fixture.out("claude", "vpk-chore-e2e-ping"), { start: NOW - 5 * MINUTE, end: NOW - 4 * MINUTE, exitCode: 1 });
	const names = (text) => JSON.parse(text).tasks.map((task) => task.name).sort();
	assert.deepEqual(names(await run(fixture, [])), ["vpk-feat-alpha", "vpk-fix-beta"]);
	assert.deepEqual(JSON.parse(await run(fixture, [])).hidden, { e2e: 1, done: 1 });
	assert.deepEqual(names(await run(fixture, ["--all"])), ["vpk-chore-e2e-ping", "vpk-feat-alpha", "vpk-fix-beta", "vpk-research-gamma"]);
	const markdown = await run(fixture, ["--markdown"]);
	assert.match(markdown, /^\| Task \| Status \| PR \| Next action \|\n/u);
	assert.equal(markdown.includes("vpk-chore-e2e-ping"), false);
	assert.equal((await run(fixture, ["--markdown", "--all"])).includes("vpk-chore-e2e-ping"), true);
});

test("--task picks one task by any of its directory names, done or not", async () => {
	const fixture = fixtureCheckout();
	const parsed = JSON.parse(await run(fixture, ["--task", "vpk-feat-alpha-review"]));
	assert.deepEqual(parsed.tasks.map((task) => task.name), ["vpk-feat-alpha"]);
	assert.equal(JSON.parse(await run(fixture, ["--task", "vpk-research-gamma"])).tasks[0].status, "done (read-only)");
	assert.match(await run(fixture, ["--task", "vpk-fix-beta", "--markdown"]), /\| `vpk-fix-beta` \| running \|/u);
	await assert.rejects(run(fixture, ["--task", "vpk-fix-nope"]), /no task named/u);
});

test("no task directories prints an empty task list", async () => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-remote-status-empty-")));
	const runCommand = async () => ({ ok: true, stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/main\n`, stderr: "" });
	const json = captureStdout();
	await main([], { stdout: json, env: {}, cwd: root, runCommand, now: NOW });
	assert.deepEqual(JSON.parse(json.text).tasks, []);
	const markdown = captureStdout();
	await main(["--markdown"], { stdout: markdown, env: {}, cwd: root, runCommand, now: NOW });
	assert.equal(markdown.text, "No vpk-remote tasks found.\n");
});
