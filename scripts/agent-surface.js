#!/usr/bin/env node

// Runs a prepared shell script in a visible terminal surface when the caller is
// inside herdr, and inline otherwise, then waits for it and exits with its status.
// Each run leaves <script>.start, <script>.exit, and a start and end line in the
// script directory's runs.jsonl.
//
//   node scripts/agent-surface.js run --script <file> --label <name> [--cwd <dir>]
//        [--worktree <path>] [--group <name>] [--no-wait] [--timeout-ms <n>]
//        [--surface auto|herdr|inline]
//
// --label and --group are vpk-<type>-<slug>[-<pane>] names (SURFACE_NAME_PATTERN).
//
// Placement inside herdr:
//   --worktree <path>  the herdr workspace for that git worktree, opened from the main
//                      checkout so it lands in the sidebar even when the caller sits in
//                      a linked worktree; a new tab or split when it is already open
//   --group <name>     a tab with that label in the caller's workspace, split per run
//   neither            a new tab labelled --label in the caller's workspace

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const POLL_INTERVAL_MS = 1000;
const PANE_CHECK_EVERY = 10;

function shellQuote(value) {
	return `'${String(value).replace(/'/gu, `'\\''`)}'`;
}

// One name for every vpk-remote surface: herdr workspace, tab, and pane labels.
const SURFACE_NAME_PATTERN = /^vpk-(feat|fix|refactor|perf|docs|chore|audit|research)-[a-z0-9]+(-[a-z0-9]+)*$/u;

function assertSurfaceName(flag, value) {
	if (!SURFACE_NAME_PATTERN.test(value)) {
		throw new Error(`${flag} ${JSON.stringify(value)} must be vpk-<type>-<slug>[-<pane>], lowercase kebab-case, with type one of feat, fix, refactor, perf, docs, chore, audit, research`);
	}
}

function parseArgs(argv) {
	const [command, ...rest] = argv;
	const options = { command, surface: "auto", wait: true, timeoutMs: 0 };
	for (let index = 0; index < rest.length; index += 1) {
		const flag = rest[index];
		const next = () => {
			const value = rest[index + 1];
			if (value === undefined) throw new Error(`${flag} needs a value`);
			index += 1;
			return value;
		};
		switch (flag) {
			case "--script": options.script = path.resolve(next()); break;
			case "--label": options.label = next(); break;
			case "--cwd": options.cwd = path.resolve(next()); break;
			case "--worktree": options.worktree = path.resolve(next()); break;
			case "--group": options.group = next(); break;
			case "--surface": options.surface = next(); break;
			case "--timeout-ms": options.timeoutMs = Number(next()); break;
			case "--no-wait": options.wait = false; break;
			default: throw new Error(`unknown option ${flag}`);
		}
	}
	if (options.command !== "run") throw new Error("usage: agent-surface.js run --script <file> --label <name> [options]");
	if (!options.script) throw new Error("--script is required");
	if (!options.label) throw new Error("--label is required");
	assertSurfaceName("--label", options.label);
	if (options.group !== undefined) assertSurfaceName("--group", options.group);
	if (!["auto", "herdr", "inline"].includes(options.surface)) throw new Error("--surface must be auto, herdr, or inline");
	options.cwd ??= options.worktree ?? process.cwd();
	return options;
}

function resolveSurface(requested, env = process.env) {
	if (requested !== "auto") return requested;
	return env.HERDR_ENV === "1" ? "herdr" : "inline";
}

// Terminal cells are roughly twice as tall as they are wide.
function splitDirection(rect) {
	return rect.width / 2 >= rect.height ? "right" : "down";
}

function exitFileFor(script) {
	return `${script}.exit`;
}

// Every run's start lands in <script>.start and runs.jsonl before launch, and its end in
// runs.jsonl as soon as the exit is seen. A run script can be reused, so status orders runs
// by these records, never by file times.
function startFileFor(script) {
	return `${script}.start`;
}

function runsFileFor(script) {
	return path.join(path.dirname(script), "runs.jsonl");
}

function recordStart(script, startedAt) {
	fs.writeFileSync(startFileFor(script), `${startedAt}\n`);
	fs.appendFileSync(runsFileFor(script), `${JSON.stringify({ script: path.basename(script), startedAt, endedAt: null, exit: null })}\n`);
}

function recordEnd(script, startedAt, status) {
	fs.appendFileSync(runsFileFor(script), `${JSON.stringify({ script: path.basename(script), startedAt, endedAt: new Date().toISOString(), exit: status })}\n`);
}

// The pane command is written here and run as `bash <runner>`: typed into a shell in
// canonical mode, a line over 1024 bytes is rejected by `herdr pane run`.
function runnerFileFor(script) {
	return `${script}.pane.sh`;
}

// Herdr lifecycle reporting for the pane (see .agents/docs/herdr.md). The pane is
// not a recognised agent, so without these reports it shows as "unknown".
const REPORT_SOURCE = "vpk-agent-surface";
const REPORT_AGENT = "vpk-worker";

// `herdr agent wait <name>` needs [a-z][a-z0-9_-]{0,31}. A surface name that fits is
// used as is; a longer one becomes its first 25 characters plus a 6-character hash of
// the whole label, so labels that differ only past the cut stay distinct.
const AGENT_NAME_MAX = 32;
const AGENT_NAME_HASH_LENGTH = 6;

function agentNameFor(label) {
	if (label.length <= AGENT_NAME_MAX) return label;
	const hash = crypto.createHash("sha256").update(label).digest("hex").slice(0, AGENT_NAME_HASH_LENGTH);
	const prefix = label.slice(0, AGENT_NAME_MAX - AGENT_NAME_HASH_LENGTH - 1).replace(/-+$/u, "");
	return `${prefix}-${hash}`;
}

// The pane closes itself as soon as the exit file is written, success or failure: the
// planner reports the outcome, and herdr drops a tab when its last pane closes. The
// root pane of a workspace opened for the run stays (`closeOnExit: false`), because
// closing it would close the task's sidebar workspace; herdr clears its status once
// the shell prompt returns.
function buildPaneCommand({ script, exitFile, label, seq = Date.now(), startedAt = new Date().toISOString(), closeOnExit = true }) {
	// Seqs must increase per pane across runs and fit in a u64.
	const base = seq * 1000;
	const name = agentNameFor(label);
	// Reports run detached with output discarded, so a slow or failing herdr never blocks or fails the run.
	const bg = (command) => `( { ${command}; } >/dev/null 2>&1 & )`;
	const herdr = (args) => `"$h" ${args} "$HERDR_PANE_ID" --source ${REPORT_SOURCE} --agent ${REPORT_AGENT}`;
	const start = [
		herdr("pane report-agent") + ` --state working --seq ${base}`,
		herdr("pane report-metadata") + ` --title ${shellQuote(label)}`,
		`"$h" agent rename "$HERDR_PANE_ID" ${name}`,
	].join("; ");
	// The pane records the run's end itself, so it lands even with --no-wait or a dead
	// wrapper, and before the exit file, so status never sees an exit without it.
	const record = shellQuote(`${JSON.stringify({ script: path.basename(script), startedAt }).slice(0, -1)},`);
	// Milliseconds, like startedAt: BSD date has no %N, so the node running this wrapper
	// prints it. Should that fail, round up, so the end is never recorded before it happened.
	const endedAt = `"$(${shellQuote(process.execPath)} -e 'process.stdout.write(new Date().toISOString())' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.999Z)"`;
	const steps = [
		`h="${"$"}{HERDR_BIN_PATH:-herdr}"`,
		bg(start),
		`bash ${shellQuote(script)}; s=$?`,
		`printf '%s"endedAt":"%s","exit":%s}\\n' ${record} ${endedAt} "$s" 2>/dev/null >> ${shellQuote(runsFileFor(script))}`,
		// The exit file lands before the close, so the waiting wrapper always finds it.
		`printf '%s\\n' "$s" > ${shellQuote(exitFile)}`,
	];
	if (closeOnExit) steps.push(`"$h" pane close "$HERDR_PANE_ID" >/dev/null 2>&1`);
	return steps.join("; ");
}

function createHerdr(env = process.env) {
	const bin = env.HERDR_BIN_PATH || "herdr";
	return function herdr(args) {
		const result = spawnSync(bin, args, { encoding: "utf8", env });
		if (result.status !== 0) {
			throw new Error(`herdr ${args.slice(0, 2).join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
		}
		// `pane run` acknowledges admission with no output.
		return result.stdout.trim() ? JSON.parse(result.stdout).result : {};
	};
}

function findTab(herdr, workspaceId, label) {
	return herdr(["tab", "list", "--workspace", workspaceId]).tabs.find((tab) => tab.label === label);
}

function splitIntoTab(herdr, tab, cwd) {
	const panes = herdr(["pane", "list", "--workspace", tab.workspace_id]).panes.filter((pane) => pane.tab_id === tab.tab_id);
	const { layout } = herdr(["pane", "layout", "--pane", panes[0].pane_id]);
	const target = layout.panes.at(-1);
	return herdr([
		"pane", "split", target.pane_id,
		"--direction", splitDirection(target.rect),
		"--cwd", cwd,
		"--no-focus",
	]).pane;
}

function createTab(herdr, workspaceId, label, cwd) {
	return herdr(["tab", "create", "--workspace", workspaceId, "--cwd", cwd, "--label", label, "--no-focus"]).root_pane;
}

// herdr opens worktree workspaces only from the repo parent (`linked_worktree_source`
// otherwise), so `worktree open` gets the main checkout as --cwd, never the worktree.
// Git lists the main working tree first. With --separate-git-dir git keeps no record
// of the main checkout and lists the git dir there instead, so that is refused too.
function mainCheckoutFor(worktree) {
	const git = (...args) => {
		const result = spawnSync("git", ["-C", worktree, ...args], { encoding: "utf8" });
		if (result.status !== 0) throw new Error(`--worktree ${worktree} is not a git worktree: ${result.stderr.trim()}`);
		return result.stdout;
	};
	const lines = git("worktree", "list", "--porcelain").split("\n\n")[0].split("\n");
	if (lines.includes("bare")) throw new Error(`--worktree ${worktree} belongs to a bare repository; herdr needs a main checkout to open it from`);
	const main = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
	if (!main) throw new Error(`--worktree ${worktree}: git worktree list printed no main working tree`);
	if (main === git("rev-parse", "--path-format=absolute", "--git-common-dir").trim()) {
		throw new Error(`--worktree ${worktree}: git does not record the main checkout (separate git dir at ${main}); herdr needs one to open it from`);
	}
	return main;
}

// Returns the pane to run in, and whether it may close on exit: never the root pane of
// a worktree workspace it just opened.
function placePane(herdr, options, env = process.env) {
	if (options.worktree) {
		const opened = herdr([
			"worktree", "open",
			"--cwd", mainCheckoutFor(options.worktree),
			"--path", options.worktree,
			"--label", options.label,
			"--no-focus",
		]);
		if (!opened.already_open) return { pane: opened.root_pane, closeOnExit: false };
		const tabLabel = options.group ?? options.label;
		const existing = findTab(herdr, opened.workspace.workspace_id, tabLabel);
		const pane = existing
			? splitIntoTab(herdr, existing, options.worktree)
			: createTab(herdr, opened.workspace.workspace_id, tabLabel, options.worktree);
		return { pane, closeOnExit: true };
	}

	const workspaceId = env.HERDR_WORKSPACE_ID;
	if (!workspaceId) throw new Error("HERDR_WORKSPACE_ID is not set; run inside a herdr pane or pass --surface inline");
	if (options.group) {
		const existing = findTab(herdr, workspaceId, options.group);
		const pane = existing ? splitIntoTab(herdr, existing, options.cwd) : createTab(herdr, workspaceId, options.group, options.cwd);
		return { pane, closeOnExit: true };
	}
	return { pane: createTab(herdr, workspaceId, options.label, options.cwd), closeOnExit: true };
}

function paneAlive(herdr, paneId) {
	try {
		herdr(["pane", "get", paneId]);
		return true;
	} catch {
		return false;
	}
}

// An empty file is one the shell has created but not yet written.
function readExitFile(exitFile) {
	const text = fs.existsSync(exitFile) ? fs.readFileSync(exitFile, "utf8").trim() : "";
	if (!text) return null;
	const status = Number.parseInt(text, 10);
	return Number.isNaN(status) ? 1 : status;
}

async function waitForExitFile(exitFile, { timeoutMs, isAlive, pollIntervalMs = POLL_INTERVAL_MS }) {
	const startedAt = Date.now();
	for (let poll = 1; ; poll += 1) {
		const status = readExitFile(exitFile);
		if (status !== null) return status;
		if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
			throw new Error(`timed out after ${timeoutMs}ms waiting for ${exitFile}`);
		}
		// The pane closes itself right after writing the exit file, so look again before
		// calling a closed pane an error.
		if (poll % PANE_CHECK_EVERY === 0 && !isAlive()) {
			const late = readExitFile(exitFile);
			if (late !== null) return late;
			throw new Error(`surface closed before ${exitFile} was written`);
		}
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
}

async function run(options, { env = process.env, herdr = createHerdr(env), log = console.log } = {}) {
	if (!fs.existsSync(options.script)) throw new Error(`script not found: ${options.script}`);
	const exitFile = exitFileFor(options.script);
	fs.rmSync(exitFile, { force: true });
	const surface = resolveSurface(options.surface, env);
	const startedAt = new Date().toISOString();

	if (surface === "inline") {
		log(JSON.stringify({ surface, script: options.script, exit_file: exitFile }));
		recordStart(options.script, startedAt);
		const result = spawnSync("bash", [options.script], { cwd: options.cwd, stdio: "inherit", env });
		const status = result.status ?? 1;
		recordEnd(options.script, startedAt, status);
		fs.writeFileSync(exitFile, `${status}\n`);
		log(JSON.stringify({ exit: status }));
		return status;
	}

	const { pane, closeOnExit } = placePane(herdr, options, env);
	herdr(["pane", "rename", pane.pane_id, options.label]);
	const runner = runnerFileFor(options.script);
	fs.writeFileSync(runner, `${buildPaneCommand({ script: options.script, exitFile, label: options.label, startedAt, closeOnExit })}\n`);
	recordStart(options.script, startedAt);
	herdr(["pane", "run", pane.pane_id, `bash ${shellQuote(runner)}`]);
	log(JSON.stringify({
		surface,
		workspace_id: pane.workspace_id,
		tab_id: pane.tab_id,
		pane_id: pane.pane_id,
		exit_file: exitFile,
	}));
	if (!options.wait) return 0;

	const status = await waitForExitFile(exitFile, {
		timeoutMs: options.timeoutMs,
		isAlive: () => paneAlive(herdr, pane.pane_id),
	});
	log(JSON.stringify({ exit: status }));
	return status;
}

if (require.main === module) {
	(async () => {
		try {
			process.exitCode = await run(parseArgs(process.argv.slice(2)));
		} catch (error) {
			console.error(`agent-surface: ${error.message}`);
			process.exitCode = 2;
		}
	})();
}

module.exports = {
	SURFACE_NAME_PATTERN,
	agentNameFor,
	assertSurfaceName,
	buildPaneCommand,
	createHerdr,
	mainCheckoutFor,
	parseArgs,
	resolveSurface,
	run,
	runsFileFor,
	shellQuote,
	splitDirection,
	waitForExitFile,
};
