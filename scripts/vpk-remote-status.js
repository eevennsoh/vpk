#!/usr/bin/env node

// Lists every task dispatched through /vpk-remote with its status and next action.
// Read-only: it never writes under output/, dispatches, or touches a worktree.
//
//   node scripts/vpk-remote-status.js [--all] [--json] [--task <name>]
//
// Facts come from the main checkout's output/remote-{claude,gpt}/<name>/ directories
// (task.json, run*.sh and their .exit files, report.md), git, `gh pr list`, `ps`, and
// herdr when HERDR_ENV=1. A worker and its <name>-review[-n] advisor runs form one task.
// Every external command goes through one runner with a timeout, so a slow or missing
// tool degrades a column to "?" instead of failing the table.

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const LANES = ["claude", "gpt"];
const COMMAND_TIMEOUT_MS = 2000;
// gh makes a network round trip (~1 s); the rest are local and take milliseconds.
const GH_TIMEOUT_MS = 2500;
const DEFAULT_WIDTH = 120;
const EVENTS_TAIL_BYTES = 64 * 1024;

// Statuses in display order; the first group is active work.
const STATUS_ORDER = [
	"running",
	"stopped",
	"not started",
	"failed",
	"blocked",
	"needs fixes",
	"reviewing",
	"needs review",
	"no commits",
	"ready to ship",
	"PR open",
	"merged",
	"done (read-only)",
	"done",
];
const DONE_STATUSES = new Set(["done", "done (read-only)"]);

const STATUS_COLOR = {
	running: "yellow",
	reviewing: "yellow",
	"needs review": "yellow",
	"PR open": "yellow",
	"not started": "yellow",
	"no commits": "yellow",
	stopped: "red",
	failed: "red",
	blocked: "red",
	"needs fixes": "red",
	"ready to ship": "green",
	merged: "green",
	done: "dim",
	"done (read-only)": "dim",
};
const ANSI = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m", reset: "\x1b[0m" };

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

function isReviewDir(dirName) {
	return groupKeyFor(dirName) !== dirName;
}

// vpk-<type>-<slug> → vpk/<type>-<slug>, per the skill's naming scheme.
function conventionalBranchFor(name) {
	const match = /^vpk-((?:feat|fix|refactor|perf|docs|chore|audit|research)-[a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(name);
	return match ? `vpk/${match[1]}` : null;
}

function kindFor(dirName, task) {
	if (task?.kind) return task.kind;
	if (isReviewDir(dirName)) return "review";
	return /^vpk-(audit|research)-/u.test(dirName) ? "research" : "worker";
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

// Lines under "## Blockers" other than "None" (or an unfilled "[…]" template line).
function parseBlockers(markdown) {
	const body = sectionBody(markdown ?? "", "Blockers");
	if (!body) return [];
	return body
		.map((line) => line.replace(/^\s*(?:[-*+]|\d+\.)\s+/u, "").trim())
		.filter((line) => line && !/^\**\s*(?:none|no blockers|n\/a)\b/iu.test(line) && !/^\[.*\]$/u.test(line));
}

function parseVerdict(markdown) {
	const text = markdown ?? "";
	const stated = /verdict\W{0,6}(request(?:s|ed)? changes|approved?|lgtm|ship it)/iu.exec(text);
	if (stated) return /request/iu.test(stated[1]) ? "request changes" : "approve";
	if (/\brequest(?:s|ed|ing)? changes\b/iu.test(text)) return "request changes";
	return null;
}

// The worktree a legacy run script worked in: `cd "<path>"` (Claude lane) or `-C "<path>"` (GPT lane).
function worktreeFromRunScript(script) {
	const match = /^\s*cd\s+["']([^"']+)["']/mu.exec(script) ?? /\s-C\s+["']([^"']+)["']/u.exec(script);
	return match ? match[1] : null;
}

function parseProcessList(text) {
	return text.split("\n").map((line) => {
		const match = /^\s*(\d+)\s+(.*)$/u.exec(line);
		return match ? { pid: Number(match[1]), command: match[2] } : null;
	}).filter(Boolean);
}

// `…/run.sh` must not match `…/run.sh.pane.sh` or `…/run.sh.exit`.
function mentionsPath(command, file) {
	for (let at = command.indexOf(file); at !== -1; at = command.indexOf(file, at + 1)) {
		if (/^(?:\s|$)/u.test(command.slice(at + file.length))) return true;
	}
	return false;
}

// claude -p reads its brief on stdin, so its arguments never name the task directory;
// the `bash <dir>/run.sh` (or `agent-surface.js --script <path>`) process does, for exactly
// as long as the run lasts. codex exec names the directory in --output-last-message.
function runIsAlive(scriptPath, dirPath, processes) {
	return processes.some((proc) => mentionsPath(proc.command, scriptPath)
		|| (/(?:^|\/)(?:claude\s+-p|codex\s+exec)\b/u.test(proc.command) && proc.command.includes(`${dirPath}/`)));
}

// Open beats merged beats closed; the newest PR wins within a state.
function pickPr(prs) {
	const rank = { OPEN: 0, MERGED: 1, CLOSED: 2 };
	return [...prs].sort((a, b) => (rank[a.state] ?? 3) - (rank[b.state] ?? 3) || b.number - a.number)[0] ?? null;
}

// ── Status derivation (pure) ──────────────────────────────────────────────────

function latestRun(dir) {
	return dir?.runs.at(-1) ?? null;
}

function runTime(run) {
	return run?.endedAt ?? run?.startedAt ?? 0;
}

function nextActionFor(status, pr) {
	switch (status) {
		case "running": return "wait; ask for status later";
		case "stopped": return "check git status, re-dispatch";
		case "not started": return "launch run.sh";
		case "failed": return "read stderr.log, fix brief, re-dispatch";
		case "blocked": return "resolve the report's blocker";
		case "needs fixes": return "send a correction follow-up";
		case "reviewing": return "wait for the review";
		case "needs review": return "run the advisor review";
		case "no commits": return "check git status in the worktree";
		case "ready to ship": return "/vpk-git-ship";
		case "PR open": return `/vpk-git-ship --merge ${pr.number}`;
		case "merged": return "/vpk-git-clean";
		case "done (read-only)": return "read the report";
		default: return "none";
	}
}

// First match wins, in the order of the skill's status table.
function deriveStatus(task) {
	const status = deriveStatusName(task);
	return { status, nextAction: nextActionFor(status, task.pr) };
}

function deriveStatusName({ kind, worker, reviews, git, pr, advisor }) {
	const workerRun = latestRun(worker);
	const reviewDir = [...reviews].sort((a, b) => runTime(latestRun(a)) - runTime(latestRun(b))).at(-1) ?? null;
	const reviewRun = latestRun(reviewDir);
	const latest = [workerRun, reviewRun].filter(Boolean);

	if (workerRun?.state === "running" || (!worker && reviewRun?.state === "running")) return "running";
	// A merged PR settles the task; older failures and review verdicts are history.
	if (pr?.state === "MERGED") return git.worktreeExists || git.localBranch ? "merged" : "done";
	if (latest.some((run) => run.state === "stopped")) return "stopped";
	if (latest.length === 0) return "not started";
	const finished = latest.filter((run) => run.state === "exited").sort((a, b) => runTime(a) - runTime(b)).at(-1);
	if (finished && finished.exitCode !== 0) return "failed";
	if (worker?.report.blockers.length) return "blocked";
	if (worker && reviewRun?.state === "running") return "reviewing";

	const reviewFresh = Boolean(worker && reviewRun && runTime(reviewRun) > runTime(workerRun));
	if (reviewFresh && reviewDir.report.verdict === "request changes") return "needs fixes";
	const ahead = (git.ahead ?? 0) > 0;
	const prOpen = pr?.state === "OPEN";
	if (worker && workerRun?.exitCode === 0 && ahead && !reviewFresh && advisor !== false && !prOpen) return "needs review";
	if (ahead && !prOpen) return "ready to ship";
	if (prOpen) return "PR open";
	// A run whose worktree and branch are both gone was landed and cleaned, even when
	// no PR can be matched to it (legacy runs predate the branch naming).
	if (git.worktree && !git.worktreeExists && !git.localBranch) return "done";
	if (kind === "research" || kind === "review" || !git.branch) return "done (read-only)";
	return "no commits";
}

// ── Formatting (pure) ─────────────────────────────────────────────────────────

function formatAge(ms) {
	if (ms === null || ms === undefined || ms < 0) return "—";
	const minutes = Math.floor(ms / 60000);
	if (minutes < 1) return "<1m";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ${minutes % 60}m`;
	return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatClock(ms) {
	const date = new Date(ms);
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function prLabel(pr) {
	if (pr === "unknown") return "?";
	if (!pr) return "—";
	return `#${pr.number} ${pr.state.toLowerCase()}`;
}

function truncate(text, width) {
	if (width <= 0) return "";
	return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

function paint(text, color, enabled) {
	return enabled && color ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

function sortTasks(tasks) {
	return [...tasks].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

function headerCounts(tasks, { all }) {
	const done = tasks.filter((task) => DONE_STATUSES.has(task.status)).length;
	const merged = tasks.filter((task) => task.status === "merged").length;
	const parts = [`${tasks.length - done - merged} active`];
	if (merged) parts.push(`${merged} merged`);
	if (done) parts.push(all ? `${done} done` : `${done} done hidden`);
	return parts.join(" · ");
}

const COLUMNS = [
	{ key: "name", title: "Task", min: 16 },
	{ key: "status", title: "Status" },
	{ key: "age", title: "Age" },
	{ key: "pr", title: "PR" },
	{ key: "next", title: "Next action", min: 12 },
];
// Columns give up width in this order once the goal lines are already truncated.
const SHRINK_ORDER = ["next", "name"];

function renderTable(tasks, { width = DEFAULT_WIDTH, color = false, now = Date.now(), all = false } = {}) {
	const header = `vpk-remote tasks · ${headerCounts(tasks, { all })}`;
	const visible = sortTasks(tasks.filter((task) => all || !DONE_STATUSES.has(task.status)));
	if (tasks.length === 0) return "No vpk-remote tasks found.";
	if (visible.length === 0) return `${header} · nothing active (--all shows them)`;

	const rows = visible.map((task) => ({
		name: task.name,
		status: task.status,
		age: formatAge(task.createdAt ? now - task.createdAt : null),
		pr: prLabel(task.pr),
		next: task.nextAction,
		goal: task.goal,
	}));
	const widths = Object.fromEntries(COLUMNS.map((column) => [column.key, Math.max(column.title.length, ...rows.map((row) => row[column.key].length))]));
	const totalWidth = () => COLUMNS.reduce((sum, column) => sum + widths[column.key] + 3, 1);
	for (const key of SHRINK_ORDER) {
		const min = COLUMNS.find((column) => column.key === key).min;
		widths[key] -= Math.min(Math.max(widths[key] - min, 0), Math.max(totalWidth() - width, 0));
	}
	// Goal lines span the table, so widen the last column for them while the terminal allows.
	const longestGoal = Math.max(0, ...rows.map((row) => (row.goal ? row.goal.length + 2 : 0)));
	widths.next += Math.max(Math.min(longestGoal + 4, width) - totalWidth(), 0);
	const total = totalWidth();
	const inner = total - 4;

	const rule = (left, mid, right) => `${left}${COLUMNS.map((column) => "─".repeat(widths[column.key] + 2)).join(mid)}${right}`;
	const cells = (values, colorFor = () => null) => `│ ${COLUMNS.map((column) => {
		const text = truncate(values[column.key], widths[column.key]);
		return paint(text, colorFor(column.key), color) + " ".repeat(widths[column.key] - text.length);
	}).join(" │ ")} │`;

	const clock = formatClock(now);
	const lines = [`${header}${" ".repeat(Math.max(total - header.length - clock.length, 1))}${clock}`];
	lines.push(rule("┌", "┬", "┐"));
	lines.push(cells(Object.fromEntries(COLUMNS.map((column) => [column.key, column.title]))));
	lines.push(rule("├", "┼", "┤"));
	for (const row of rows) {
		lines.push(cells(row, (key) => (key === "status" ? STATUS_COLOR[row.status] : null)));
		if (row.goal) {
			const goal = truncate(`  ${row.goal}`, inner);
			lines.push(`│ ${paint(goal, "dim", color)}${" ".repeat(inner - goal.length)} │`);
		}
	}
	lines.push(rule("└", "┴", "┘"));
	return lines.join("\n");
}

function renderDetail(task, { color = false, now = Date.now() } = {}) {
	const time = (ms) => (ms ? formatClock(ms) : "—");
	const git = task.git;
	const branch = git.branch
		? `${git.branch}${git.localBranch ? "" : " (no local branch)"}${git.ahead === null ? "" : ` · ${git.ahead} ahead of origin/main`}`
		: "—";
	const worktree = git.worktree
		? `${git.worktree} (${git.worktreeExists ? (git.dirty ? "uncommitted changes" : git.dirty === false ? "clean" : "exists") : "missing"})`
		: "—";
	const pr = task.pr === "unknown" ? "? (gh failed)" : task.pr ? `#${task.pr.number} ${task.pr.state.toLowerCase()} ${task.pr.url}` : "—";
	const lines = [
		`${task.name} · ${paint(task.status, STATUS_COLOR[task.status], color)}`,
		`  Goal      ${task.goal || "—"}`,
		`  Kind      ${task.kind}`,
		`  Next      ${task.nextAction}`,
		`  Age       ${formatAge(task.createdAt ? now - task.createdAt : null)}`,
		`  Branch    ${branch}`,
		`  Worktree  ${worktree}`,
		`  PR        ${pr}`,
	];
	if (task.herdrOpen !== null) lines.push(`  herdr     ${task.herdrOpen ? "open" : "not open"}`);
	lines.push("  Runs");
	for (const dir of task.dirs) {
		for (const run of dir.runs) {
			const outcome = run.state === "exited" ? `exit ${run.exitCode}${run.inferred ? " (inferred)" : ""}` : run.state;
			lines.push(`    ${dir.lane}/${dir.name}/${run.script}  ${outcome}  started ${time(run.startedAt)}  ended ${time(run.endedAt)}`);
		}
		if (dir.runs.length === 0) lines.push(`    ${dir.lane}/${dir.name}  no runs`);
	}
	lines.push("  Reports");
	for (const dir of task.dirs) {
		const notes = [dir.report.nonEmpty ? "written" : "empty or missing"];
		if (dir.report.verdict) notes.push(`verdict: ${dir.report.verdict}`);
		if (dir.role === "worker" && dir.report.blockers.length) notes.push(`blockers: ${dir.report.blockers.join("; ")}`);
		lines.push(`    ${dir.report.path} (${notes.join(", ")})`);
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

// Raw facts for one output/remote-<lane>/<name>/ directory. Run state is resolved later,
// once the process list is in.
function readTaskDir(dirPath, lane, name) {
	const reportPath = path.join(dirPath, "report.md");
	const reportText = readText(reportPath) ?? "";
	const runs = fs.readdirSync(dirPath)
		.map((file) => ({ file, index: runIndexFor(file) }))
		.filter(({ index }) => index !== null)
		.sort((a, b) => a.index - b.index)
		.map(({ file, index }) => {
			const scriptPath = path.join(dirPath, file);
			const exitText = readText(`${scriptPath}.exit`)?.trim();
			const exitCode = exitText ? (Number.isNaN(Number.parseInt(exitText, 10)) ? 1 : Number.parseInt(exitText, 10)) : null;
			return {
				script: file,
				scriptPath,
				index,
				exitCode,
				startedAt: statMs(scriptPath),
				endedAt: exitCode === null ? null : statMs(`${scriptPath}.exit`),
				worktreeHint: index === 0 ? worktreeFromRunScript(readText(scriptPath) ?? "") : null,
			};
		});
	const task = readJson(path.join(dirPath, "task.json"));
	return {
		name,
		lane,
		path: dirPath,
		role: isReviewDir(name) ? "review" : "worker",
		task,
		createdAt: Date.parse(task?.createdAt ?? "") || statMs(path.join(dirPath, "brief.md")) || runs[0]?.startedAt || statMs(dirPath),
		runs,
		report: {
			path: reportPath,
			nonEmpty: reportText.trim().length > 0,
			mtime: statMs(reportPath),
			blockers: parseBlockers(reportText),
			verdict: isReviewDir(name) ? parseVerdict(reportText) : null,
		},
	};
}

// A run with no exit file is running while its process lives. Without one, a report
// written after the run started (the formatter only writes on success) means it exited 0,
// and a final error result in its events file means it failed: runs from before the
// wrapper wrote exit files still read correctly. Anything else died without reporting.
function resolveRunStates(dir, processes) {
	dir.runs.forEach((run, position) => {
		delete run.worktreeHint;
		if (run.exitCode !== null) {
			run.state = "exited";
			return;
		}
		if (runIsAlive(run.scriptPath, dir.path, processes)) {
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
			run.state = "stopped";
		}
	});
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
// this whole script's budget. Returns null when gh fails, so the PR column shows "?".
async function fetchPullRequests(runCommand, cwd, branches) {
	if (branches.length === 0) return new Map();
	const vars = branches.map((_, index) => `$b${index}:String!`).join(",");
	const fields = branches.map((_, index) => `b${index}:pullRequests(headRefName:$b${index},first:10){nodes{number state url mergedAt}}`).join(" ");
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

// A worker and its <name>-review[-n] advisors share a name. Runs from before the naming
// scheme (ui-generation-visual-worker-1 beside vpk-feat-ui-generation-review) do not, but
// their run scripts cd into the same worktree, so groups sharing one merge, under the name
// that follows the scheme. The main checkout is no tie: read-only runs all start there.
function groupTaskDirs(dirs, mainCheckout) {
	const byKey = new Map();
	for (const dir of dirs) {
		const key = groupKeyFor(dir.name);
		if (!byKey.has(key)) byKey.set(key, { key, worker: null, reviews: [], related: [] });
		const group = byKey.get(key);
		if (dir.role === "review") group.reviews.push(dir);
		else group.worker = dir;
	}
	const byWorktree = new Map();
	const groups = [];
	for (const group of byKey.values()) {
		const members = [group.worker, ...group.reviews].filter(Boolean);
		const hint = members.some((dir) => dir.task) ? null : members.map((dir) => dir.runs[0]?.worktreeHint).find(Boolean);
		const owner = hint && hint !== mainCheckout ? byWorktree.get(hint) : null;
		if (!owner) {
			if (hint && hint !== mainCheckout) byWorktree.set(hint, group);
			groups.push(group);
			continue;
		}
		if (!owner.worker && group.worker) [owner.worker, group.worker] = [group.worker, owner.worker];
		owner.reviews.push(...group.reviews);
		owner.related.push(...[group.worker].filter(Boolean));
		if (!conventionalBranchFor(owner.key) && conventionalBranchFor(group.key)) owner.key = group.key;
	}
	return groups;
}

async function collectStatus({ cwd = process.cwd(), runCommand = createRunner(), env = process.env, now = Date.now() } = {}) {
	const { mainCheckout, worktrees } = await resolveMainCheckout(runCommand, cwd);
	const dirs = listTaskDirs(mainCheckout).map((dir) => readTaskDir(dir.path, dir.lane, dir.name));
	const base = { generatedAt: new Date(now).toISOString(), mainCheckout, gh: "skipped", tasks: [] };
	if (dirs.length === 0) return base;

	const groups = groupTaskDirs(dirs, mainCheckout);

	const worktreeByPath = new Map(worktrees.map((tree) => [tree.path, tree]));
	const plans = groups.map((group) => {
		const all = [group.worker, ...group.reviews, ...group.related].filter(Boolean);
		const record = group.worker?.task ?? group.reviews.find((dir) => dir.task)?.task ?? null;
		const worktreeHint = all.map((dir) => dir.runs[0]?.worktreeHint).find(Boolean) ?? null;
		const worktreePath = record?.worktree
			? path.resolve(mainCheckout, record.worktree)
			: worktreeHint ?? path.join(mainCheckout, ".claude", "worktrees", group.key);
		const tree = worktreeByPath.get(worktreePath);
		const candidate = record?.branch ?? tree?.branch ?? conventionalBranchFor(group.key)
			?? all.map((dir) => conventionalBranchFor(groupKeyFor(dir.name))).find(Boolean) ?? null;
		return { group, all, record, worktreeHint, worktreePath, tree, candidate };
	});
	const candidates = [...new Set(plans.map((plan) => plan.candidate).filter(Boolean))];

	const [branchList, processList, prs, labels] = await Promise.all([
		runCommand("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], { cwd: mainCheckout }),
		runCommand("ps", ["-axo", "pid=,command="]),
		fetchPullRequests(runCommand, mainCheckout, candidates),
		herdrLabels(runCommand, env),
	]);
	const localBranches = new Set(branchList.ok ? branchList.stdout.split("\n").filter(Boolean) : []);
	const processes = parseProcessList(processList.stdout).filter((proc) => proc.pid !== process.pid);
	base.gh = prs ? "ok" : "failed";
	const prsFor = (branch) => prs?.get(branch) ?? [];

	const tasks = await Promise.all(plans.map(async ({ group, all, record, worktreeHint, worktreePath, tree, candidate }) => {
		for (const dir of all) resolveRunStates(dir, processes);
		// task.json and git name the branch outright; the conventional name only counts
		// once something proves it existed.
		const branch = record?.branch ?? tree?.branch
			?? (candidate && (localBranches.has(candidate) || prsFor(candidate).length) ? candidate : null);

		const [ahead, status] = await Promise.all([
			branch && localBranches.has(branch)
				? runCommand("git", ["rev-list", "--count", `origin/main..refs/heads/${branch}`], { cwd: mainCheckout })
				: null,
			tree ? runCommand("git", ["-C", tree.path, "status", "--porcelain"]) : null,
		]);
		const git = {
			branch,
			localBranch: Boolean(branch && localBranches.has(branch)),
			worktree: record?.worktree || tree || worktreeHint ? worktreePath : null,
			worktreeExists: Boolean(tree),
			dirty: status?.ok ? status.stdout.trim().length > 0 : null,
			ahead: ahead?.ok ? Number.parseInt(ahead.stdout.trim(), 10) : null,
		};
		const pr = !branch ? null : prs ? pickPr(prsFor(branch)) : "unknown";
		const kind = group.worker ? kindFor(group.worker.name, group.worker.task) : kindFor(group.reviews[0].name, record);
		const facts = {
			name: group.key,
			goal: record?.goal ?? "",
			kind,
			advisor: record?.advisor,
			createdAt: Math.min(...all.map((dir) => dir.createdAt).filter(Boolean)),
			worker: group.worker,
			reviews: group.reviews,
			git,
			pr,
		};
		const { status: derived, nextAction } = deriveStatus(facts);
		return {
			name: facts.name,
			goal: facts.goal,
			kind,
			status: derived,
			nextAction,
			createdAt: Number.isFinite(facts.createdAt) ? facts.createdAt : null,
			git,
			pr,
			herdrOpen: labels ? all.some((dir) => labels.has(dir.name)) || labels.has(group.key) : null,
			dirs: all.map(({ task, ...dir }) => dir),
		};
	}));
	base.tasks = sortTasks(tasks);
	return base;
}

function parseArgs(argv) {
	const options = { all: false, json: false, task: null };
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		switch (flag) {
			case "--all": options.all = true; break;
			case "--json": options.json = true; break;
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
	return tasks.find((task) => task.name === name || task.dirs.some((dir) => dir.name === name)) ?? null;
}

async function main(argv = process.argv.slice(2), { stdout = process.stdout, env = process.env, cwd, runCommand, now = Date.now() } = {}) {
	const options = parseArgs(argv);
	if (options.help) {
		stdout.write("usage: vpk-remote-status.js [--all] [--json] [--task <name>]\n");
		return 0;
	}
	const result = await collectStatus({ cwd, runCommand, env, now });
	const color = Boolean(stdout.isTTY) && !env.NO_COLOR;
	if (options.task) {
		const task = findTask(result.tasks, options.task);
		if (!task) throw new Error(`no task named ${options.task}`);
		stdout.write(`${options.json ? JSON.stringify(task, null, "\t") : renderDetail(task, { color, now })}\n`);
		return 0;
	}
	if (options.json) {
		stdout.write(`${JSON.stringify(result, null, "\t")}\n`);
		return 0;
	}
	const width = stdout.isTTY && stdout.columns ? stdout.columns : DEFAULT_WIDTH;
	stdout.write(`${renderTable(result.tasks, { width, color, now, all: options.all })}\n`);
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
	kindFor,
	main,
	parseArgs,
	parseBlockers,
	parseProcessList,
	parseVerdict,
	parseWorktreeList,
	pickPr,
	renderDetail,
	renderTable,
	runIndexFor,
	runIsAlive,
	worktreeFromRunScript,
};
