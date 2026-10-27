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
//
// A --worktree run also reports on the task workspace's root pane: working while any of its
// runs goes, then idle or blocked (taskState). `task-state` is the pane's call as its script
// starts and again once it has exited:
//
//   node scripts/agent-surface.js task-state start|end --root <pane> --workspace <id>
//        --script <file> --pid <runner pid> [--exit <status>] [--caller <pane>]

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const POLL_INTERVAL_MS = 1000;
// Every herdr call: the wrapper's as it places and launches a run, and the pane's task-state
// reports as a run starts and ends. A hung herdr then fails a launch it cannot place within
// seconds, and never delays a run's script or its exit file.
const HERDR_TIMEOUT_MS = 3000;
// Longer than a lock holder can take: three herdr calls at HERDR_TIMEOUT_MS.
const LOCK_STALE_MS = 20000;
const LOCK_POLL_MS = 25;
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

// The pane's task-state call. It never fails the run: it always exits 0.
function parseTaskStateArgs([phase, ...rest]) {
	const options = { phase };
	for (let index = 0; index < rest.length; index += 2) {
		const [flag, value] = [rest[index], rest[index + 1]];
		if (value === undefined) throw new Error(`${flag} needs a value`);
		const key = { "--root": "rootPaneId", "--workspace": "workspaceId", "--caller": "callerPaneId", "--script": "script", "--pid": "pid", "--exit": "status" }[flag];
		if (!key) throw new Error(`unknown option ${flag}`);
		options[key] = value;
	}
	const pid = Number(options.pid);
	if (!["start", "end"].includes(phase) || !options.rootPaneId || !options.workspaceId || !options.script || !Number.isInteger(pid) || pid <= 0 || (phase === "end" && options.status === undefined)) {
		throw new Error("usage: agent-surface.js task-state start|end --root <pane> --workspace <id> --script <file> --pid <runner pid> [--exit <status>] [--caller <pane>]");
	}
	return { ...options, pid };
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

// `head` is the task worktree's HEAD as the run ended, so status can tell a renamed branch
// from a landed one once the worktree is gone.
function recordEnd(script, startedAt, status, head = null) {
	fs.appendFileSync(runsFileFor(script), `${JSON.stringify({ script: path.basename(script), startedAt, endedAt: new Date().toISOString(), exit: status, ...(head ? { head } : {}) })}\n`);
}

function worktreeHead(worktree) {
	const result = spawnSync("git", ["-C", worktree, "rev-parse", "HEAD"], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : null;
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

// The pane closes itself once the exit file is written, success or failure: the planner
// reports the outcome, and herdr drops a tab when its last pane closes. The root pane of
// a workspace opened for the run stays (`closeOnExit: false`), because closing it would
// close the task's sidebar workspace. A --worktree run (`task`) reports its task state
// as its script starts and again after the exit file. herdr clears a report once its pane
// is back at a shell prompt, so the root pane then holds at a read until the user presses
// Enter. `worktree` adds the worktree's HEAD to the run's end line.
function buildPaneCommand({ script, exitFile, label, seq = Date.now(), startedAt = new Date().toISOString(), closeOnExit = true, task = null, worktree = null }) {
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
		`"$h" pane rename "$HERDR_PANE_ID" ${shellQuote(label)}`,
	].join("; ");
	// The pane records the run's end itself, so it lands even with --no-wait or a dead
	// wrapper, and before the exit file, so status never sees an exit without it.
	const record = shellQuote(`${JSON.stringify({ script: path.basename(script), startedAt }).slice(0, -1)},`);
	// Milliseconds, like startedAt: BSD date has no %N, so the node running this wrapper
	// prints it. Should that fail, round up, so the end is never recorded before it happened.
	const endedAt = `"$(${shellQuote(process.execPath)} -e 'process.stdout.write(new Date().toISOString())' 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.999Z)"`;
	// $$ is the pane runner, alive until the pane closes or its hold ends: the task's
	// registry of live runs checks that pid. `ts start|end` is the task-state call.
	const caller = task?.callerPaneId ? ` --caller ${shellQuote(task.callerPaneId)}` : "";
	const taskSteps = task ? [
		`ts() { ${shellQuote(process.execPath)} ${shellQuote(__filename)} task-state "$@" --root ${shellQuote(task.rootPaneId)} --workspace ${shellQuote(task.workspaceId)}${caller} --script ${shellQuote(script)} --pid $$; }`,
		// In the background, so a slow herdr or a held lock never delays the script; the end
		// waits for it, so a run never unregisters before it has registered.
		"{ ts start; } & t=$!",
		// A runner killed mid-run (its pane closed) still unregisters, so the workspace does
		// not stay working; only SIGKILL skips this, and the registry prunes that run.
		`trap 'wait "$t" 2>/dev/null; ts end --exit "${"$"}{s:-1}" >/dev/null 2>&1' EXIT`,
	] : [];
	const head = worktree ? `,"head":"%s"` : "";
	const steps = [
		`h="${"$"}{HERDR_BIN_PATH:-herdr}"`,
		bg(start),
		...taskSteps,
		`bash ${shellQuote(script)}; s=$?`,
		...(worktree ? [`hd="$(git -C ${shellQuote(worktree)} rev-parse HEAD 2>/dev/null)"`] : []),
		`printf '%s"endedAt":"%s","exit":%s${head}}\\n' ${record} ${endedAt} "$s"${worktree ? ' "$hd"' : ""} 2>/dev/null >> ${shellQuote(runsFileFor(script))}`,
		// The exit file lands before the task report and the close, so neither delays the
		// waiting wrapper. The registry's lock, not this order, keeps a later run's working.
		`printf '%s\\n' "$s" > ${shellQuote(exitFile)}`,
	];
	if (task) steps.push(`wait "$t"`, `ts end --exit "$s"`, "trap - EXIT");
	if (closeOnExit) steps.push(`"$h" pane close "$HERDR_PANE_ID" >/dev/null 2>&1`);
	else if (task) steps.push(`printf '\\nPress Enter for a shell.\\n'`, "read -r _");
	return steps.join("; ");
}

function createHerdr(env = process.env, { timeoutMs = HERDR_TIMEOUT_MS } = {}) {
	const bin = env.HERDR_BIN_PATH || "herdr";
	return function herdr(args) {
		const result = spawnSync(bin, args, { encoding: "utf8", env, timeout: timeoutMs, killSignal: "SIGKILL" });
		if (result.error?.code === "ETIMEDOUT") {
			throw Object.assign(new Error(`herdr ${args.slice(0, 2).join(" ")} timed out after ${timeoutMs}ms`), { code: "ETIMEDOUT" });
		}
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
// a worktree workspace it just opened. A worktree run also gets its workspace's root pane.
function placePane(herdr, options, env = process.env) {
	if (options.worktree) {
		const opened = herdr([
			"worktree", "open",
			"--cwd", mainCheckoutFor(options.worktree),
			"--path", options.worktree,
			"--label", options.label,
			"--no-focus",
		]);
		const task = { rootPaneId: opened.root_pane.pane_id, workspaceId: opened.workspace.workspace_id, callerPaneId: env.HERDR_PANE_ID ?? null };
		if (!opened.already_open) return { pane: opened.root_pane, closeOnExit: false, task };
		const tabLabel = options.group ?? options.label;
		const existing = findTab(herdr, opened.workspace.workspace_id, tabLabel);
		const pane = existing
			? splitIntoTab(herdr, existing, options.worktree)
			: createTab(herdr, opened.workspace.workspace_id, tabLabel, options.worktree);
		return { pane, closeOnExit: true, task };
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

// A writing task's sidebar workspace keeps its root pane between runs. Each run reports
// there too, so the workspace shows working while any of its runs goes, then idle or
// blocked. Only the root pane of the task's workspace is reported on, never the caller's
// (the planner's) pane, and only while a pane runner holds it: herdr clears a report on a
// pane back at its shell prompt, and a bare prompt may be the user's. Returns what it
// did; herdr errors throw.
function reportTaskState(herdr, { rootPaneId, workspaceId, callerPaneId = null, state, message, seq }) {
	if (rootPaneId === callerPaneId) return "skipped: the caller's pane";
	const { pane } = herdr(["pane", "get", rootPaneId]);
	if (pane.workspace_id !== workspaceId) return "skipped: outside the task workspace";
	if (pane.agent && pane.agent !== REPORT_AGENT) return `skipped: the pane hosts ${pane.agent}`;
	const { foreground_processes: processes = [] } = herdr(["pane", "process-info", "--pane", rootPaneId]).process_info ?? {};
	const held = processes.some(({ argv = [] }) => /^(?:\S*\/)?bash$/u.test(argv[0] ?? "") && (argv[1] ?? "").endsWith(".pane.sh"));
	if (!held) return "skipped: the root pane is at a shell prompt, where herdr clears reports";
	herdr(["pane", "report-agent", rootPaneId, "--source", REPORT_SOURCE, "--agent", REPORT_AGENT, "--state", state, "--message", message, "--seq", String(seq)]);
	return "reported";
}

function endOfRunState(script, status) {
	return status === 0
		? { state: "idle", message: `done · ${path.basename(script)}` }
		: { state: "blocked", message: `failed · exit ${status}` };
}

// The task's live runs: one file per run in its directory's live-runs/, naming the run's
// pane and its pane runner's pid. A run registers before its script starts and
// unregisters once it has exited; each change and the report that follows it happen
// under live-runs.lock, so the root pane's reports land in the order the registry
// changed. A run ending cannot overwrite the working of a run that registered after it,
// and of two runs ending together the second sees the first gone.
function liveRunsDirFor(script) {
	return path.join(path.dirname(script), "live-runs");
}

function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}

// A registered run is live while its pid is still its pane runner, so a crashed run, or
// its pid reused by another process, never holds the workspace at working.
function runnerAlive({ pid, script }) {
	if (!pidAlive(pid)) return false;
	const ps = spawnSync("ps", ["-ww", "-o", "command=", "-p", String(pid)], { encoding: "utf8" });
	if (ps.error) return true;
	return ps.status === 0 && ps.stdout.includes(runnerFileFor(script));
}

// Live runs, oldest first; entries of dead runs are removed.
function liveRuns(dir, isAlive) {
	const entries = fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith(".json")) : [];
	const live = [];
	for (const file of entries) {
		let entry = null;
		try {
			entry = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
		} catch {}
		if (entry && Number.isInteger(entry.pid) && typeof entry.script === "string" && isAlive(entry)) live.push(entry);
		else fs.rmSync(path.join(dir, file), { force: true });
	}
	return live.sort((a, b) => a.registeredAt - b.registeredAt);
}

// One holder at a time: the lock directory appears with its owner file inside, and goes,
// by atomic renames, so it is never empty (a rename may replace an empty directory). A
// holder makes at most three herdr calls of HERDR_TIMEOUT_MS each, so a lock whose holder
// died, or older than LOCK_STALE_MS, is broken.
function withLock(lockDir, fn) {
	const token = `${process.pid} ${crypto.randomUUID()}`;
	const staging = `${lockDir}.${process.pid}`;
	const discard = () => {
		const trash = `${lockDir}.gone.${crypto.randomUUID()}`;
		try {
			fs.renameSync(lockDir, trash);
		} catch {
			return;
		}
		fs.rmSync(trash, { recursive: true, force: true });
	};
	const readOwner = () => {
		try {
			return fs.readFileSync(path.join(lockDir, "owner"), "utf8");
		} catch {
			return "";
		}
	};
	fs.mkdirSync(staging, { recursive: true });
	fs.writeFileSync(path.join(staging, "owner"), token);
	try {
		for (;;) {
			try {
				fs.renameSync(staging, lockDir);
				break;
			} catch (error) {
				if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
			}
			const owner = readOwner();
			const ageMs = Date.now() - (fs.statSync(lockDir, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
			const ownerPid = Number.parseInt(owner, 10);
			if ((Number.isInteger(ownerPid) && !pidAlive(ownerPid)) || ageMs > LOCK_STALE_MS) {
				if (readOwner() === owner) discard();
				continue;
			}
			sleepSync(LOCK_POLL_MS);
		}
	} finally {
		fs.rmSync(staging, { recursive: true, force: true });
	}
	try {
		return fn();
	} finally {
		// A holder slow enough to have its lock broken must not release the next holder's.
		if (readOwner() === token) discard();
	}
}

// Seqs must increase per pane. Above a root pane's own start seq (its launch time × 1000),
// so a root pane that ran the first run takes these reports.
function nextSeq(dir) {
	const file = path.join(dir, "seq");
	const last = Number(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : 0) || 0;
	const seq = Math.max(Date.now() * 1000 + 500, last + 1);
	fs.writeFileSync(file, String(seq));
	return seq;
}

// A herdr that timed out says nothing about the pane, so the wait goes on.
function paneAlive(herdr, paneId) {
	try {
		herdr(["pane", "get", paneId]);
		return true;
	} catch (error) {
		return error.code === "ETIMEDOUT";
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
		recordEnd(options.script, startedAt, status, options.worktree ? worktreeHead(options.worktree) : null);
		fs.writeFileSync(exitFile, `${status}\n`);
		log(JSON.stringify({ exit: status }));
		return status;
	}

	// Every herdr call here times out (HERDR_TIMEOUT_MS). The pane names itself and reports
	// the task state, so only the calls that place and start the run stand before it, and a
	// hung herdr there fails the launch instead of hanging it.
	const { pane, closeOnExit, task = null } = placePane(herdr, options, env);
	const runner = runnerFileFor(options.script);
	fs.writeFileSync(runner, `${buildPaneCommand({ script: options.script, exitFile, label: options.label, startedAt, closeOnExit, task, worktree: options.worktree ?? null })}\n`);
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

// The pane's task-state call, as its script starts (`start`) and once it has exited
// (`end`): register or unregister the run, then report working while any registered run
// is live, otherwise idle or blocked from this run's exit. A failure prints one line and
// still exits 0: the run's status is in its exit file.
function taskState(argv, { env = process.env, herdr = createHerdr(env), log = console.error, isAlive = runnerAlive } = {}) {
	let options;
	try {
		options = parseTaskStateArgs(argv);
		const dir = liveRunsDirFor(options.script);
		const outcome = withLock(`${dir}.lock`, () => {
			const entry = path.join(dir, `${options.pid}.json`);
			fs.mkdirSync(dir, { recursive: true });
			if (options.phase === "start") {
				fs.writeFileSync(entry, `${JSON.stringify({ pid: options.pid, pane: env.HERDR_PANE_ID ?? null, script: options.script, registeredAt: Date.now() })}\n`);
			} else {
				fs.rmSync(entry, { force: true });
			}
			// A run registering is live, whatever its process looks like.
			const live = liveRuns(dir, (run) => (options.phase === "start" && run.pid === options.pid) || isAlive(run));
			const status = Number.parseInt(options.status, 10);
			const next = live.length > 0
				? { state: "working", message: `working · ${path.basename(live.at(-1).script)}` }
				: endOfRunState(options.script, Number.isNaN(status) ? 1 : status);
			return reportTaskState(herdr, { ...options, ...next, seq: nextSeq(dir) });
		});
		if (outcome !== "reported") log(`agent-surface: task workspace state ${outcome}`);
	} catch (error) {
		// An ended run never stays registered, whatever failed.
		if (options?.phase === "end") fs.rmSync(path.join(liveRunsDirFor(options.script), `${options.pid}.json`), { force: true });
		log(`agent-surface: task workspace state not reported: ${error.message}`);
	}
	return 0;
}

if (require.main === module) {
	(async () => {
		if (process.argv[2] === "task-state") {
			process.exitCode = taskState(process.argv.slice(3));
			return;
		}
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
	reportTaskState,
	resolveSurface,
	run,
	runsFileFor,
	shellQuote,
	splitDirection,
	taskState,
	waitForExitFile,
	withLock,
};
