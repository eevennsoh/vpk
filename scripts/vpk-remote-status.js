#!/usr/bin/env node

// Lists every task dispatched through /vpk-remote with its status and next action.
// Read-only: it never writes under output/, dispatches, or touches a worktree.
//
//   node scripts/vpk-remote-status.js [--all] [--json | --markdown] [--task <name>]
//
// Prints the facts as JSON by default (--json is an alias), or with --markdown a plain
// GitHub table. It never lays text out for a terminal: the AI tool that shows the result
// renders the table and wraps it to its own pane.
//
// Facts come from the main checkout's output/remote-{claude,gpt}/<name>/ directories
// (task.json, runs.jsonl, run*.sh and their .start/.exit files, report.md and its
// report-<k>.md snapshots), git, `gh`, `ps`, and herdr when
// HERDR_ENV=1. A worker and its <name>-review[-n] advisor runs form one task, across both
// lanes. Every external command goes through one runner with a timeout; one that fails
// records "unknown", never a negative fact such as "no process" or "no commits".

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const LANES = ["claude", "gpt"];
const COMMAND_TIMEOUT_MS = 2000;
// gh makes a network round trip (~1 s); the rest are local and take milliseconds.
const GH_TIMEOUT_MS = 2500;
const EVENTS_TAIL_BYTES = 64 * 1024;

// Statuses in display order; the first group is active work.
const STATUS_ORDER = [
	"running",
	"unknown",
	"stopped",
	"not started",
	"failed",
	"blocked",
	"needs fixes",
	"review unclear",
	"reviewing",
	"needs review",
	"no commits",
	"ready to ship",
	"PR open",
	"PR closed",
	"merged",
	"done (read-only)",
	"done",
];
const DONE_STATUSES = new Set(["done", "done (read-only)"]);
// Throwaway end-to-end runs of the skill itself; --all shows them.
const THROWAWAY_PREFIX = "vpk-chore-e2e-";
const TASK_KINDS = ["worker", "review", "research"];
const TASK_STRING_FIELDS = ["name", "goal", "type", "lane", "model", "effort", "createdAt"];
// Longest first, so "ship with nits" is not read as "ship".
const VERDICTS = ["ship with nits", "request changes", "ship"];
const APPROVALS = new Set(["ship", "ship with nits"]);

function createRunner({ timeoutMs = COMMAND_TIMEOUT_MS, env = process.env } = {}) {
	return function runCommand(command, args, { cwd, timeoutMs: callTimeoutMs = timeoutMs } = {}) {
		return new Promise((resolve) => {
			execFile(command, args, { cwd, env, timeout: callTimeoutMs, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
				resolve({ ok: !error, stdout: stdout ?? "", stderr: stderr ?? "" });
			});
		});
	};
}

// ── Pure parsing ──────────────────────────────────────────────────────────────

function parseWorktreeList(text) {
	return text.split("\n\n").map((block) => {
		const entry = {};
		for (const line of block.split("\n")) {
			if (line.startsWith("worktree ")) entry.path = line.slice("worktree ".length);
			else if (line.startsWith("branch ")) entry.branch = line.slice("branch ".length).replace(/^refs\/heads\//u, "");
			else if (line === "bare") entry.bare = true;
		}
		return entry;
	}).filter((entry) => entry.path);
}

// run.sh is run 0; follow-ups are run-1.sh, run-2.sh, …
function runIndexFor(fileName) {
	const match = /^run(?:-(\d+))?\.sh$/u.exec(fileName);
	if (!match) return null;
	return match[1] === undefined ? 0 : Number(match[1]);
}

// A worker's advisor runs are <name>-review and <name>-review-<n>.
function groupKeyFor(dirName) {
	return dirName.replace(/-review(?:-\d+)?$/u, "");
}

// task.json's kind decides; a directory without one is a review only by its name.
function roleFor(dirName, task) {
	if (task?.kind) return task.kind === "review" ? "review" : "worker";
	return groupKeyFor(dirName) === dirName ? "worker" : "review";
}

// vpk-<type>-<slug> → vpk/<type>-<slug>, per the skill's naming scheme.
function conventionalBranchFor(name) {
	const match = /^vpk-((?:feat|fix|refactor|perf|docs|chore|audit|research)-[a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(name);
	return match ? `vpk/${match[1]}` : null;
}

// The planner writes task.json by hand. A field of the wrong type counts as missing;
// branch and worktree keep an explicit null, which marks a read-only task.
function sanitizeTask(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const task = {};
	for (const key of TASK_STRING_FIELDS) {
		if (typeof raw[key] === "string") task[key] = raw[key];
	}
	for (const key of ["branch", "worktree"]) {
		if ((typeof raw[key] === "string" && raw[key]) || raw[key] === null) task[key] = raw[key];
	}
	if (TASK_KINDS.includes(raw.kind)) task.kind = raw.kind;
	if (typeof raw.advisor === "boolean") task.advisor = raw.advisor;
	return task;
}

function sectionBody(markdown, heading) {
	const lines = markdown.split("\n");
	const start = lines.findIndex((line) => new RegExp(`^#{1,3}\\s+${heading}\\s*$`, "iu").test(line.trim()));
	if (start === -1) return null;
	const body = [];
	for (const line of lines.slice(start + 1)) {
		if (/^#{1,3}\s/u.test(line)) break;
		body.push(line);
	}
	return body;
}

// The lines under "## Blockers". The section is empty only when it is blank or just
// "None" ("- None", "- None."): any other text, even "None of the checks ran", blocks.
function parseBlockers(markdown) {
	const body = sectionBody(markdown ?? "", "Blockers");
	if (!body) return [];
	const lines = body.map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0 || (lines.length === 1 && /^(?:-\s+none\.?|none)$/iu.test(lines[0]))) return [];
	return lines.map((line) => line.replace(/^(?:[-*+]|\d+\.)\s+/u, ""));
}

// The review's last "Verdict: …" line, read as ship, ship with nits, or request changes.
// Anything else, including no verdict line at all, is null: "review unclear", never approval.
function parseVerdict(markdown) {
	let verdict = null;
	for (const line of (markdown ?? "").split("\n")) {
		const match = /^[\s*_#>-]*verdict[\s*_]*[:—–-][\s*_]*(.*)$/iu.exec(line);
		if (!match) continue;
		const value = match[1].toLowerCase();
		verdict = VERDICTS.find((name) => new RegExp(`^${name}(?:$|[\\s*_]*[.,;:(—–!-])`, "u").test(value.replace(/[\s*_]+$/u, ""))) ?? null;
	}
	return verdict;
}

// The worktree a legacy run script worked in: `cd "<path>"` (Claude lane) or `-C "<path>"` (GPT lane).
function worktreeFromRunScript(script) {
	const match = /^\s*cd\s+["']([^"']+)["']/mu.exec(script) ?? /\s-C\s+["']([^"']+)["']/u.exec(script);
	return match ? match[1] : null;
}

// runs.jsonl holds a start line per run and an end line once its exit is seen. The
// script and startedAt together name a run; a line that is not a run record is skipped.
function parseRunRecords(text) {
	const byRun = new Map();
	for (const line of (text ?? "").split("\n")) {
		let record;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}
		if (typeof record?.script !== "string" || runIndexFor(record.script) === null) continue;
		const startedAt = Date.parse(record.startedAt);
		if (!Number.isFinite(startedAt)) continue;
		const key = `${record.script}\n${startedAt}`;
		const run = byRun.get(key) ?? { script: record.script, startedAt, endedAt: null, exitCode: null };
		const endedAt = Date.parse(record.endedAt ?? "");
		if (Number.isFinite(endedAt) && Number.isInteger(record.exit)) Object.assign(run, { endedAt, exitCode: record.exit });
		byRun.set(key, run);
	}
	return [...byRun.values()];
}

function parseProcessList(text) {
	return text.split("\n").map((line) => {
		const match = /^\s*(\d+)\s+(.*)$/u.exec(line);
		return match ? { pid: Number(match[1]), command: match[2] } : null;
	}).filter(Boolean);
}

// `…/run.sh` must not match `…/run.sh.pane.sh` or `…/run.sh.exit`.
function startsWithPath(text, file) {
	return text.startsWith(file) && /^(?:\s|$)/u.test(text.slice(file.length));
}

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

// Only the worker itself counts, never a pager, editor, or grep that names its files:
// `bash <script>` (the pane and inline runs), the agent-surface wrapper for that exact
// script, or claude -p / codex exec naming the task directory. claude -p reads its brief
// on stdin, so only its `bash <script>` parent identifies it; codex exec names the
// directory in --output-last-message.
function runIsAlive(scriptPath, dirPath, processes) {
	const shell = /^(?:\S*\/)?(?:bash|sh|zsh)\s+(?:-\S+\s+)*/u;
	const wrapper = /^(?:\S*\/)?node\s+\S*agent-surface\.js\s+run\s/u;
	const agent = /^(?:\S*\/)?(?:node\s+\S*\/)?(?:claude\s+(?:\S+\s+)*?(?:-p|--print)|codex\s+(?:\S+\s+)*?exec)(?:\s|$)/u;
	const inDir = new RegExp(`(?:^|\\s)${escapeRegExp(dirPath)}/`, "u");
	return processes.some(({ command }) => {
		const shellMatch = shell.exec(command);
		if (shellMatch && startsWithPath(command.slice(shellMatch[0].length), scriptPath)) return true;
		if (wrapper.test(command) && command.split(/\s--script\s+/u).slice(1).some((rest) => startsWithPath(rest, scriptPath))) return true;
		return agent.test(command) && inDir.test(command);
	});
}

// The most recently created PR speaks for the branch, whatever its state: an older merged
// PR must not hide newer work closed unmerged.
function pickPr(prs) {
	return [...prs].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) || b.number - a.number)[0] ?? null;
}

// ── Status derivation (pure) ──────────────────────────────────────────────────

// When a run finished, or when it started if it has not.
function runTime(run) {
	return run.endedAt ?? run.startedAt ?? 0;
}

// Every run in these directories, by start time: the latest started run speaks last, even
// if an older one finishes after it. Each run carries its own report (see assignReports).
function runsOf(dirs) {
	return dirs.flatMap((dir) => dir.runs).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
}

function nextActionFor(status, pr) {
	switch (status) {
		case "running": return "wait; ask for status later";
		case "unknown": return "re-run status";
		case "stopped": return "check git status, re-dispatch";
		case "not started": return "launch run.sh";
		case "failed": return "read stderr.log, fix brief, re-dispatch";
		case "blocked": return "resolve the report's blocker";
		case "needs fixes": return "send a correction follow-up";
		case "review unclear": return "read the review report";
		case "reviewing": return "wait for the review";
		case "needs review": return "run the advisor review";
		case "no commits": return "check git status in the worktree";
		case "ready to ship": return "/vpk-git-ship";
		case "PR open": return `/vpk-git-ship --merge ${pr.number}`;
		case "PR closed": return "reopen, or confirm abandoned and run /vpk-git-clean";
		case "merged": return "/vpk-git-clean";
		case "done (read-only)": return "read the report";
		default: return "none";
	}
}

function deriveStatus(task) {
	const status = deriveStatusName(task);
	return { status, nextAction: nextActionFor(status, task.pr) };
}

// A review's "## Blockers" block the worker's change, not the review: only worker
// reports can mark a task blocked.
function runOutcome(run, { reportBlocks = true } = {}) {
	if (!run) return "not started";
	if (run.state === "running" || run.state === "unknown" || run.state === "stopped") return run.state;
	if (run.exitCode !== 0) return "failed";
	return reportBlocks && run.report?.blockers.length ? "blocked" : null;
}

// First match wins, in the order of the skill's status list.
function deriveStatusName({ readOnly, advisor, workers, reviews, git, pr }) {
	// Read-only work never ships, so no branch, PR, or review check applies to it.
	if (readOnly) {
		if (runsOf([...workers, ...reviews]).some((run) => run.state === "running")) return "running";
		const own = workers.length > 0 ? workers : reviews;
		return runOutcome(runsOf(own).at(-1), { reportBlocks: workers.length > 0 }) ?? "done (read-only)";
	}

	const workerRuns = runsOf(workers);
	const workerRun = workerRuns.at(-1) ?? null;
	// Runs in two lanes can overlap, so any live one counts, not just the latest.
	if (workerRuns.some((run) => run.state === "running")) return "running";
	if (workerRun?.state === "unknown") return "unknown";
	// A merged PR settles the task; older failures and review verdicts are history.
	if (pr?.state === "MERGED") return git.worktreeExists || git.localBranch ? "merged" : "done";
	// The worker's latest run decides on its own: a later review cannot mask its failure.
	const outcome = runOutcome(workerRun);
	if (outcome) return outcome;

	const reviewRuns = runsOf(reviews);
	if (reviewRuns.some((run) => run.state === "running")) return "reviewing";
	// A review speaks for the worker's latest run only if it started after that run ended,
	// and the latest started review decides. A stopped or failed review reached no verdict.
	const fresh = reviewRuns.filter((run) => (run.startedAt ?? 0) >= runTime(workerRun) && run.state !== "stopped");
	if (fresh.some((run) => run.state === "unknown")) return "unknown";
	const review = fresh.filter((run) => run.exitCode === 0).at(-1);
	if (review?.report?.verdict === "request changes") return "needs fixes";
	if (review && !APPROVALS.has(review.report?.verdict)) return "review unclear";
	const approved = Boolean(review) || advisor === false;

	// Past here every answer rests on git and the PR; a failed lookup proves nothing.
	if (pr === "unknown" || git.localBranch === null || (git.localBranch && git.ahead === null)) return "unknown";
	if (pr?.state === "OPEN") return "PR open";
	if (pr?.state === "CLOSED") return "PR closed";
	if (git.ahead > 0) return approved ? "ready to ship" : "needs review";
	// A run whose worktree and branch are both gone was landed and cleaned, even when
	// no PR can be matched to it (legacy runs predate the branch naming).
	if (git.worktree && !git.worktreeExists && !git.localBranch) return "done";
	if (!git.branch) return "done (read-only)";
	return "no commits";
}

// ── Formatting (pure) ─────────────────────────────────────────────────────────

function formatAge(ms) {
	if (ms === null || ms === undefined || ms < 0) return null;
	const minutes = Math.floor(ms / 60000);
	if (minutes < 1) return "<1m";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ${minutes % 60}m`;
	return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function prLabel(pr) {
	if (pr === "unknown") return "?";
	if (!pr) return "—";
	return `#${pr.number} ${pr.state.toLowerCase()}`;
}

function isThrowaway(task) {
	return task.name.startsWith(THROWAWAY_PREFIX);
}

function sortTasks(tasks) {
	return [...tasks].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
		|| (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
}

// Done tasks and e2e runs show only with --all.
function visibleTasks(tasks, all) {
	return sortTasks(tasks.filter((task) => all || (!DONE_STATUSES.has(task.status) && !isThrowaway(task))));
}

// A plain GitHub table: Task (goal in the same cell), Status, PR, Next action. The tool
// showing it renders and wraps it, so cells are neither padded nor cut.
function renderMarkdown(tasks, { hidden = 0 } = {}) {
	if (tasks.length === 0) {
		return hidden ? `No active vpk-remote tasks; ${hidden} done or e2e hidden (--all shows them).` : "No vpk-remote tasks found.";
	}
	// Backslashes first, so an escaped pipe in the text cannot become a column break.
	const cell = (text) => String(text).replace(/\s*[\r\n]+\s*/gu, " ").replace(/\\/gu, "\\\\").replace(/\|/gu, "\\|");
	const lines = ["| Task | Status | PR | Next action |", "| --- | --- | --- | --- |"];
	for (const task of tasks) {
		const name = task.goal ? `\`${cell(task.name)}\` — ${cell(task.goal)}` : `\`${cell(task.name)}\``;
		lines.push(`| ${name} | ${cell(task.status)} | ${cell(prLabel(task.pr))} | ${cell(task.nextAction)} |`);
	}
	return lines.join("\n");
}

// ── Fact collection (filesystem + runner) ────────────────────────────────────

function statMs(file) {
	try {
		return fs.statSync(file).mtimeMs;
	} catch {
		return null;
	}
}

function readText(file) {
	try {
		return fs.readFileSync(file, "utf8");
	} catch {
		return null;
	}
}

function readJson(file) {
	const text = readText(file);
	if (text === null) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function isoOrNull(ms) {
	return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Whether the final stream-json event in an events file is an error result.
function eventsEndInError(file) {
	let fd;
	try {
		fd = fs.openSync(file, "r");
		const { size } = fs.fstatSync(fd);
		const length = Math.min(size, EVENTS_TAIL_BYTES);
		const buffer = Buffer.alloc(length);
		fs.readSync(fd, buffer, 0, length, size - length);
		const last = buffer.toString("utf8").trimEnd().split("\n").at(-1) ?? "";
		if (!/"type":"result"/u.test(last)) return null;
		return /"is_error":true/u.test(last);
	} catch {
		return null;
	} finally {
		if (fd !== undefined) fs.closeSync(fd);
	}
}

function readReport(reportPath, role) {
	const text = readText(reportPath);
	if (text === null) return null;
	return {
		path: reportPath,
		nonEmpty: text.trim().length > 0,
		mtime: statMs(reportPath),
		blockers: parseBlockers(text),
		verdict: role === "review" ? parseVerdict(text) : null,
	};
}

function readExitCode(exitFile) {
	const text = readText(exitFile)?.trim();
	if (!text) return null;
	const code = Number.parseInt(text, 10);
	return Number.isNaN(code) ? 1 : code;
}

// One script's runs. Recorded runs (runs.jsonl) carry their own start and end; a reused
// script has one per launch. The latest may predate the pane writing its end line, so its
// exit file stands in. A script with no record is a legacy run, timed by its .start file
// or, failing that, by file times: the pane runner is rewritten on every herdr launch, so
// it dates a reused script's latest launch better than the script does.
function runsForScript(dirPath, file, records) {
	const scriptPath = path.join(dirPath, file);
	const index = runIndexFor(file);
	const exitFile = `${scriptPath}.exit`;
	const fileExit = readExitCode(exitFile);
	if (records.length > 0) {
		return records.map((record, position) => {
			const run = { script: file, scriptPath, index, exitCode: record.exitCode, startedAt: record.startedAt, endedAt: record.endedAt };
			const latest = position === records.length - 1;
			if (latest && run.endedAt === null && fileExit !== null && (statMs(exitFile) ?? 0) >= run.startedAt) {
				Object.assign(run, { exitCode: fileExit, endedAt: statMs(exitFile) });
			}
			return run;
		});
	}
	const started = Date.parse(readText(`${scriptPath}.start`)?.trim() ?? "");
	const startedAt = Number.isFinite(started) ? started : Math.max(statMs(scriptPath) ?? 0, statMs(`${scriptPath}.pane.sh`) ?? 0) || null;
	return [{ script: file, scriptPath, index, exitCode: fileExit, startedAt, endedAt: fileExit === null ? null : statMs(exitFile) }];
}

// Raw facts for one output/remote-<lane>/<name>/ directory, runs ordered by start. Run
// state is resolved later, once the process list is in.
function readTaskDir(dirPath, lane, name) {
	const reportPath = path.join(dirPath, "report.md");
	const task = sanitizeTask(readJson(path.join(dirPath, "task.json")));
	const role = roleFor(name, task);
	const records = parseRunRecords(readText(path.join(dirPath, "runs.jsonl")));
	const scripts = new Set([...fs.readdirSync(dirPath).filter((file) => runIndexFor(file) !== null), ...records.map((record) => record.script)]);
	const runs = [...scripts]
		.sort((a, b) => runIndexFor(a) - runIndexFor(b))
		.flatMap((file) => runsForScript(dirPath, file, records.filter((record) => record.script === file).sort((a, b) => a.startedAt - b.startedAt)))
		.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
	const firstScript = runs.find((run) => run.index === 0) ?? runs[0];
	return {
		name,
		lane,
		path: dirPath,
		role,
		task,
		worktreeHint: firstScript ? worktreeFromRunScript(readText(firstScript.scriptPath) ?? "") : null,
		createdAt: Date.parse(task?.createdAt ?? "") || statMs(path.join(dirPath, "brief.md")) || runs[0]?.startedAt || statMs(dirPath),
		runs,
		report: readReport(reportPath, role) ?? { path: reportPath, nonEmpty: false, mtime: null, blockers: [], verdict: null },
	};
}

// Runs in one directory never overlap, so report.md belongs to the latest run that started
// before it was last written (the Claude lane empties it at start; a failed run may leave
// the previous run's). Every other run has only its snapshot, report-<k>.md for the k-th
// run by start, if the planner kept one.
function assignReports(dir) {
	const written = dir.report.mtime ?? Number.POSITIVE_INFINITY;
	const owner = dir.runs.findLast((run) => (run.startedAt ?? 0) <= written) ?? dir.runs.at(-1);
	dir.runs.forEach((run, position) => {
		run.report = run === owner ? dir.report : readReport(path.join(dir.path, `report-${position}.md`), dir.role);
	});
}

// A run with no exit file is running while its process lives. Without one, a report
// written after the run started (the formatter only writes on success) means it exited 0,
// and a final error result in its events file means it failed: runs from before the
// wrapper wrote exit files still read correctly. Anything else died without reporting,
// unless `ps` failed (processes is null), in which case nobody can tell.
function resolveRunStates(dir, processes) {
	dir.runs.forEach((run, position) => {
		if (run.exitCode !== null) {
			run.state = "exited";
			return;
		}
		// A later launch of the same script owns any live process for it.
		const relaunched = dir.runs.slice(position + 1).some((later) => later.script === run.script);
		if (processes && !relaunched && runIsAlive(run.scriptPath, dir.path, processes)) {
			run.state = "running";
			return;
		}
		const isLatest = position === dir.runs.length - 1;
		const eventsFile = path.join(dir.path, run.index === 0 ? "events.jsonl" : `events-${run.index}.jsonl`);
		if (isLatest && dir.report.nonEmpty && (dir.report.mtime ?? 0) >= (run.startedAt ?? 0)) {
			Object.assign(run, { state: "exited", exitCode: 0, inferred: true, endedAt: dir.report.mtime });
		} else if (isLatest && eventsEndInError(fs.existsSync(eventsFile) ? eventsFile : path.join(dir.path, "events.jsonl"))) {
			Object.assign(run, { state: "exited", exitCode: 1, inferred: true, endedAt: statMs(eventsFile) });
		} else {
			run.state = processes ? "stopped" : "unknown";
		}
	});
	assignReports(dir);
	return dir;
}

function listTaskDirs(mainCheckout) {
	const dirs = [];
	for (const lane of LANES) {
		const laneRoot = path.join(mainCheckout, "output", `remote-${lane}`);
		let entries;
		try {
			entries = fs.readdirSync(laneRoot, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.isDirectory()) dirs.push({ lane, name: entry.name, path: path.join(laneRoot, entry.name) });
		}
	}
	return dirs;
}

async function resolveMainCheckout(runCommand, cwd) {
	const result = await runCommand("git", ["worktree", "list", "--porcelain"], { cwd });
	if (!result.ok) throw new Error(`not inside a git checkout: ${result.stderr.trim()}`);
	const worktrees = parseWorktreeList(result.stdout);
	if (!worktrees[0] || worktrees[0].bare) throw new Error("git worktree list printed no main checkout");
	return { mainCheckout: worktrees[0].path, worktrees };
}

// One GraphQL round trip for every branch, matched on headRefName exactly. `gh pr list
// --head` takes one branch per call, and listing every PR in the repo is slower than
// this whole script's budget. Returns null when gh fails, so the PR reads "unknown".
async function fetchPullRequests(runCommand, cwd, branches) {
	if (branches.length === 0) return new Map();
	const vars = branches.map((_, index) => `$b${index}:String!`).join(",");
	const fields = branches.map((_, index) => `b${index}:pullRequests(headRefName:$b${index},first:10){nodes{number state url createdAt mergedAt}}`).join(" ");
	const query = `query($owner:String!,$name:String!,${vars}){repository(owner:$owner,name:$name){${fields}}}`;
	const args = ["api", "graphql", "-F", "owner={owner}", "-F", "name={repo}", "-f", `query=${query}`];
	branches.forEach((branch, index) => args.push("-f", `b${index}=${branch}`));
	const result = await runCommand("gh", args, { cwd, timeoutMs: GH_TIMEOUT_MS });
	if (!result.ok) return null;
	try {
		const repository = JSON.parse(result.stdout).data.repository;
		return new Map(branches.map((branch, index) => [branch, repository[`b${index}`].nodes]));
	} catch {
		return null;
	}
}

async function herdrLabels(runCommand, env) {
	if (env.HERDR_ENV !== "1") return null;
	const bin = env.HERDR_BIN_PATH || "herdr";
	const [workspaces, tabs] = await Promise.all([
		runCommand(bin, ["workspace", "list"]),
		runCommand(bin, ["tab", "list"]),
	]);
	const labels = new Set();
	try {
		if (workspaces.ok) for (const workspace of JSON.parse(workspaces.stdout).result.workspaces) labels.add(workspace.label);
		if (tabs.ok) for (const tab of JSON.parse(tabs.stdout).result.tabs) labels.add(tab.label);
	} catch {
		return null;
	}
	return workspaces.ok || tabs.ok ? labels : null;
}

// One task per name. A worker directory joins its <name>-review[-n] advisors, and the same
// name in both lanes (a re-dispatch on the other family) merges into one task.
function groupTaskDirs(dirs) {
	const byKey = new Map();
	for (const dir of dirs) {
		const key = dir.role === "review" ? groupKeyFor(dir.name) : dir.name;
		if (!byKey.has(key)) byKey.set(key, { key, workers: [], reviews: [] });
		byKey.get(key)[dir.role === "review" ? "reviews" : "workers"].push(dir);
	}
	return [...byKey.values()];
}

function kindFor(group) {
	const worker = group.workers.find((dir) => dir.task?.kind) ?? group.workers[0];
	if (!worker) return "review";
	if (worker.task?.kind) return worker.task.kind;
	return /^vpk-(audit|research)-/u.test(worker.name) ? "research" : "worker";
}

function newestFirst(dirs) {
	return [...dirs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

// The worktree, branch candidate, and kind of one task, before any git or gh call.
function planTask(group, { mainCheckout, worktreeByPath }) {
	const dirs = [...group.workers, ...group.reviews];
	const record = newestFirst(group.workers).find((dir) => dir.task)?.task ?? newestFirst(group.reviews).find((dir) => dir.task)?.task ?? null;
	const kind = kindFor(group);
	const readOnly = kind === "research" || kind === "review" || (record?.branch === null && record?.worktree === null);
	const worktreeHint = dirs.map((dir) => dir.worktreeHint).find(Boolean) ?? null;
	let worktreePath = null;
	if (typeof record?.worktree === "string") worktreePath = path.resolve(mainCheckout, record.worktree);
	else if (record?.worktree !== null) worktreePath = worktreeHint ?? path.join(mainCheckout, ".claude", "worktrees", group.key);
	const tree = worktreePath ? worktreeByPath.get(worktreePath) : undefined;
	// The branch checked out in the worktree wins, so a rename after dispatch is followed;
	// task.json's branch stands in once the worktree is gone (or its HEAD is detached).
	const named = tree?.branch ?? record?.branch ?? null;
	const candidate = named ?? conventionalBranchFor(group.key);
	return { group, dirs, record, kind, readOnly, worktreeHint, worktreePath, tree, named, candidate };
}

async function collectStatus({ cwd = process.cwd(), runCommand = createRunner(), env = process.env, now = Date.now() } = {}) {
	const { mainCheckout, worktrees } = await resolveMainCheckout(runCommand, cwd);
	const dirs = listTaskDirs(mainCheckout).map((dir) => readTaskDir(dir.path, dir.lane, dir.name));
	const base = { generatedAt: new Date(now).toISOString(), mainCheckout, observations: { ps: "skipped", branches: "skipped", gh: "skipped" }, tasks: [] };
	if (dirs.length === 0) return base;

	const worktreeByPath = new Map(worktrees.map((tree) => [tree.path, tree]));
	const plans = groupTaskDirs(dirs).map((group) => planTask(group, { mainCheckout, worktreeByPath }));
	const candidates = [...new Set(plans.filter((plan) => !plan.readOnly).map((plan) => plan.candidate).filter(Boolean))];

	const [branchList, processList, prs, labels] = await Promise.all([
		runCommand("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], { cwd: mainCheckout }),
		runCommand("ps", ["-axo", "pid=,command="]),
		fetchPullRequests(runCommand, mainCheckout, candidates),
		herdrLabels(runCommand, env),
	]);
	// null means the lookup failed: unknown, not empty.
	const localBranches = branchList.ok ? new Set(branchList.stdout.split("\n").filter(Boolean)) : null;
	const processes = processList.ok ? parseProcessList(processList.stdout).filter((proc) => proc.pid !== process.pid) : null;
	base.observations = { ps: processes ? "ok" : "failed", branches: localBranches ? "ok" : "failed", gh: candidates.length === 0 ? "skipped" : prs ? "ok" : "failed" };
	const prsFor = (branch) => prs?.get(branch) ?? [];

	const tasks = await Promise.all(plans.map(async ({ group, dirs: taskDirs, record, kind, readOnly, worktreeHint, worktreePath, tree, named, candidate }) => {
		for (const dir of taskDirs) resolveRunStates(dir, processes);
		// The conventional name only counts once something proves it existed; while git or gh
		// failed, it stays in play so the task reads unknown rather than done.
		const proven = candidate && (!localBranches || !prs || localBranches.has(candidate) || prsFor(candidate).length > 0);
		const branch = readOnly ? null : named ?? (proven ? candidate : null);
		const localBranch = !branch ? false : localBranches ? localBranches.has(branch) : null;

		const [ahead, status] = await Promise.all([
			localBranch ? runCommand("git", ["rev-list", "--count", `origin/main..refs/heads/${branch}`], { cwd: mainCheckout }) : null,
			tree ? runCommand("git", ["-C", tree.path, "status", "--porcelain"]) : null,
		]);
		const git = {
			branch,
			localBranch,
			worktree: worktreePath && (typeof record?.worktree === "string" || tree || worktreeHint) ? worktreePath : null,
			worktreeExists: Boolean(tree),
			dirty: status?.ok ? status.stdout.trim().length > 0 : null,
			ahead: ahead?.ok ? Number.parseInt(ahead.stdout.trim(), 10) : null,
		};
		const pr = !branch ? null : prs ? pickPr(prsFor(branch)) : "unknown";
		const { status: derived, nextAction } = deriveStatus({ readOnly, advisor: record?.advisor, workers: group.workers, reviews: group.reviews, git, pr });

		const runs = runsOf(taskDirs).map((run) => {
			const dir = taskDirs.find((candidateDir) => run.scriptPath.startsWith(`${candidateDir.path}/`));
			return {
				dir: dir.name,
				lane: dir.lane,
				role: dir.role,
				script: run.script,
				state: run.state,
				exitCode: run.exitCode,
				...(run.inferred ? { inferred: true } : {}),
				startedAt: isoOrNull(run.startedAt),
				endedAt: isoOrNull(run.endedAt),
				report: run.report?.path ?? null,
				...(dir.role === "review" ? { verdict: run.report?.verdict ?? null } : {}),
			};
		});
		const createdAt = Math.min(...taskDirs.map((dir) => dir.createdAt).filter(Number.isFinite));
		const lastActivity = Math.max(...runsOf(taskDirs).map(runTime));
		return {
			name: group.key,
			goal: record?.goal ?? "",
			kind,
			status: derived,
			nextAction,
			pr: pr && pr !== "unknown" ? { number: pr.number, state: pr.state, url: pr.url } : pr,
			...git,
			createdAt: isoOrNull(createdAt),
			age: Number.isFinite(createdAt) ? formatAge(now - createdAt) : null,
			lastActivityAt: lastActivity > 0 ? isoOrNull(lastActivity) : null,
			idle: lastActivity > 0 ? formatAge(now - lastActivity) : null,
			herdrOpen: labels ? taskDirs.some((dir) => labels.has(dir.name)) || labels.has(group.key) : null,
			runs,
			reports: taskDirs.map((dir) => ({
				dir: dir.name,
				path: dir.report.path,
				written: dir.report.nonEmpty,
				verdict: dir.report.verdict,
				blockers: dir.report.blockers,
			})),
		};
	}));
	base.tasks = sortTasks(tasks);
	return base;
}

function parseArgs(argv) {
	const options = { all: false, markdown: false, task: null };
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		switch (flag) {
			case "--all": options.all = true; break;
			case "--json": options.markdown = false; break;
			case "--markdown": options.markdown = true; break;
			case "--task":
				options.task = argv[index + 1];
				if (!options.task) throw new Error("--task needs a name");
				index += 1;
				break;
			case "-h":
			case "--help": options.help = true; break;
			default: throw new Error(`unknown option ${flag}`);
		}
	}
	return options;
}

function findTask(tasks, name) {
	return tasks.find((task) => task.name === name || task.reports.some((report) => report.dir === name)) ?? null;
}

async function main(argv = process.argv.slice(2), { stdout = process.stdout, env = process.env, cwd, runCommand, now = Date.now() } = {}) {
	const options = parseArgs(argv);
	if (options.help) {
		stdout.write("usage: vpk-remote-status.js [--all] [--json | --markdown] [--task <name>]\n");
		return 0;
	}
	const { tasks: allTasks, ...result } = await collectStatus({ cwd, runCommand, env, now });
	let tasks;
	if (options.task) {
		const task = findTask(allTasks, options.task);
		if (!task) throw new Error(`no task named ${options.task}`);
		tasks = [task];
	} else {
		tasks = visibleTasks(allTasks, options.all);
	}
	const shown = new Set(tasks);
	const unshown = allTasks.filter((task) => !shown.has(task));
	const hidden = { e2e: unshown.filter(isThrowaway).length, done: unshown.filter((task) => !isThrowaway(task) && DONE_STATUSES.has(task.status)).length };
	if (options.markdown) {
		stdout.write(`${renderMarkdown(tasks, { hidden: options.task ? 0 : hidden.e2e + hidden.done })}\n`);
		return 0;
	}
	stdout.write(`${JSON.stringify({ ...result, hidden: options.task ? undefined : hidden, tasks }, null, "\t")}\n`);
	return 0;
}

if (require.main === module) {
	main().then(
		(code) => { process.exitCode = code; },
		(error) => {
			console.error(`vpk-remote-status: ${error.message}`);
			process.exitCode = 2;
		},
	);
}

module.exports = {
	STATUS_ORDER,
	collectStatus,
	conventionalBranchFor,
	createRunner,
	deriveStatus,
	formatAge,
	groupKeyFor,
	main,
	parseArgs,
	parseBlockers,
	parseProcessList,
	parseRunRecords,
	parseVerdict,
	parseWorktreeList,
	pickPr,
	renderMarkdown,
	roleFor,
	runIndexFor,
	runIsAlive,
	sanitizeTask,
	worktreeFromRunScript,
};
