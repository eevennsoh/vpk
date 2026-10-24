const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	SURFACE_NAME_PATTERN,
	agentNameFor,
	buildPaneCommand,
	createHerdr,
	mainCheckoutFor,
	parseArgs,
	reportTaskState,
	resolveSurface,
	run,
	shellQuote,
	splitDirection,
	taskState,
	waitForExitFile,
	withLock,
} = require("./agent-surface.js");

function tempScript(body = "exit 0") {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-"));
	const script = path.join(dir, "run.sh");
	fs.writeFileSync(script, `${body}\n`);
	return script;
}

const git = (...args) => assert.equal(spawnSync("git", args, { encoding: "utf8" }).status, 0, `git ${args.join(" ")}`);

// A real main checkout with one linked worktree, as the planner creates them.
function linkedWorktree() {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-repo-")));
	const main = path.join(dir, "main");
	const tree = path.join(main, ".claude", "worktrees", "vpk-fix-x");
	git("init", "-q", main);
	git("-C", main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
	git("-C", main, "worktree", "add", "-q", "-b", "vpk/fix-x", tree);
	return { main, tree };
}

// Fake herdr server: records calls and "runs" the pane command by writing the exit file.
function fakeHerdr({ tabs = [], panes = [], alreadyOpen = false, worktreeError = null } = {}) {
	const calls = [];
	let nextPane = 50;
	let startSeen = null;
	const herdr = (args) => {
		calls.push(args);
		const [group, verb] = args;
		if (group === "tab" && verb === "list") return { tabs };
		if (group === "tab" && verb === "create") {
			const label = args[args.indexOf("--label") + 1];
			const workspace = args[args.indexOf("--workspace") + 1];
			return { root_pane: { pane_id: `${workspace}:p${nextPane++}`, tab_id: `${workspace}:t-${label}`, workspace_id: workspace } };
		}
		if (group === "pane" && verb === "list") return { panes };
		if (group === "pane" && verb === "get") return { pane: { pane_id: args[2], workspace_id: args[2].split(":")[0] } };
		if (group === "pane" && verb === "layout") {
			return { layout: { panes: [{ pane_id: panes[0].pane_id, rect: { width: 200, height: 40 } }] } };
		}
		if (group === "pane" && verb === "split") {
			return { pane: { pane_id: `w1:p${nextPane++}`, tab_id: panes[0].tab_id, workspace_id: "w1" } };
		}
		if (group === "worktree" && verb === "open") {
			if (worktreeError) throw new Error(`herdr worktree open failed: ${worktreeError}`);
			return {
				already_open: alreadyOpen,
				workspace: { workspace_id: "w7" },
				root_pane: { pane_id: "w7:p1", tab_id: "w7:t1", workspace_id: "w7" },
			};
		}
		if (group === "pane" && verb === "run") {
			const runner = args[3].match(/^bash '([^']+)'$/u)[1];
			const exitFile = fs.readFileSync(runner, "utf8").match(/> '([^']+\.exit)'/u)[1];
			// The start is on disk before the pane is launched.
			startSeen = fs.existsSync(exitFile.replace(/\.exit$/u, ".start"));
			fs.writeFileSync(exitFile, "3\n");
			return {};
		}
		return {};
	};
	return { herdr, calls, startSeen: () => startSeen };
}

const readRecords = (script) => fs.readFileSync(path.join(path.dirname(script), "runs.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));

const herdrEnv = { HERDR_ENV: "1", HERDR_WORKSPACE_ID: "w1" };

test("auto surface follows HERDR_ENV", () => {
	assert.equal(resolveSurface("auto", { HERDR_ENV: "1" }), "herdr");
	assert.equal(resolveSurface("auto", {}), "inline");
	assert.equal(resolveSurface("inline", { HERDR_ENV: "1" }), "inline");
});

test("wide panes split right and tall panes split down", () => {
	assert.equal(splitDirection({ width: 249, height: 78 }), "right");
	assert.equal(splitDirection({ width: 100, height: 78 }), "down");
});

test("parseArgs requires script and label and defaults cwd to the worktree", () => {
	assert.throws(() => parseArgs(["run", "--label", "vpk-fix-x"]), /--script is required/u);
	assert.throws(() => parseArgs(["run", "--script", "a.sh"]), /--label is required/u);
	const options = parseArgs(["run", "--script", "a.sh", "--label", "vpk-fix-x", "--worktree", "/tmp/wt"]);
	assert.equal(options.cwd, "/tmp/wt");
	assert.equal(options.wait, true);
});

test("surface names follow vpk-<type>-<slug>[-<pane>]", () => {
	for (const name of ["vpk-feat-ui-generation", "vpk-fix-sidebar", "vpk-audit-tokens-2", "vpk-research-auth-flow-review", "vpk-chore-surface-e2e"]) {
		assert.match(name, SURFACE_NAME_PATTERN);
	}
	for (const name of ["worker-1", "vpk-ui-generation", "vpk-bug-x", "vpk-feat", "vpk-feat-", "vpk-feat-UI", "vpk-feat-a--b", "vpk-feat-a_b", "remote/vpk-feat-x", "fix-x"]) {
		assert.doesNotMatch(name, SURFACE_NAME_PATTERN);
	}
});

test("parseArgs rejects labels and groups outside the naming scheme", () => {
	assert.throws(() => parseArgs(["run", "--script", "a.sh", "--label", "worker-1"]), /--label "worker-1" must be vpk-<type>-<slug>\[-<pane>\]/u);
	assert.throws(() => parseArgs(["run", "--script", "a.sh", "--label", "vpk-audit-x-1", "--group", "fanout"]), /--group "fanout" must be vpk-<type>-<slug>/u);
	assert.equal(parseArgs(["run", "--script", "a.sh", "--label", "vpk-audit-x-2", "--group", "vpk-audit-x"]).group, "vpk-audit-x");
	assert.equal(parseArgs(["run", "--script", "a.sh", "--label", "vpk-feat-x-review"]).label, "vpk-feat-x-review");
});

test("pane command records the exit status even when the script fails", () => {
	const command = buildPaneCommand({ script: "/tmp/it's.sh", exitFile: "/tmp/x.exit", label: "vpk-fix-x" });
	assert.ok(command.includes(`; bash '/tmp/it'\\''s.sh'; s=$?;`));
	assert.ok(command.includes(`> '/tmp/x.exit'`));
	// Herdr's own "finished" notification fires from the lifecycle reports, so no custom toast.
	assert.equal(command.includes("notification show"), false);
});

// Runs the real pane command in bash against a fake herdr that logs each call, and
// whether the exit file already held the status when `pane close` ran.
async function runPaneCommand({ body, label = "vpk-feat-live-probe", closeOnExit, task, paneId = "w1:p5", herdrBody = 'printf "%s\\n" "$*" >> "$LOG"' }) {
	const script = tempScript(body);
	const dir = path.dirname(script);
	const bin = path.join(dir, "fake-herdr");
	const log = path.join(dir, "herdr.log");
	const exitFile = `${script}.exit`;
	const closeProbe = `if [ "$1 $2" = "pane close" ]; then printf 'exit-file-at-close:%s\\n' "$(cat "$EXIT_FILE" 2>/dev/null)" >> "$LOG"; fi`;
	fs.writeFileSync(bin, `#!/bin/sh\n${closeProbe}\n${herdrBody}\n`, { mode: 0o755 });
	const command = buildPaneCommand({ script, exitFile, label, seq: 1700000000000, closeOnExit, task });
	const result = spawnSync("bash", ["-c", command], {
		encoding: "utf8",
		env: { PATH: process.env.PATH, HERDR_BIN_PATH: bin, HERDR_PANE_ID: paneId, LOG: log, EXIT_FILE: exitFile },
	});
	// Start reports are detached; wait for all four, not the close probe's lines.
	const readLog = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []);
	for (let i = 0; i < 250 && readLog().filter((line) => /^(?:pane report-|agent rename|pane rename)/u.test(line)).length < 4; i += 1) {
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return { command, result, exit: fs.readFileSync(exitFile, "utf8").trim(), calls: readLog() };
}

test("pane reports working and names the agent after the label", async () => {
	const { calls } = await runPaneCommand({ body: "exit 0" });
	assert.ok(calls.includes("pane report-agent w1:p5 --source vpk-agent-surface --agent vpk-worker --state working --seq 1700000000000000"));
	assert.ok(calls.includes("pane report-metadata w1:p5 --source vpk-agent-surface --agent vpk-worker --title vpk-feat-live-probe"));
	assert.ok(calls.includes("agent rename w1:p5 vpk-feat-live-probe"));
	assert.ok(calls.includes("pane rename w1:p5 vpk-feat-live-probe"));
});

test("the pane closes itself on exit 0, after the exit file is written", async () => {
	const { result, exit, calls } = await runPaneCommand({ body: "exit 0" });
	assert.equal(result.status, 0);
	assert.equal(exit, "0");
	assert.ok(calls.includes("pane close w1:p5"));
	assert.ok(calls.includes("exit-file-at-close:0"));
});

test("the pane closes itself on a non-zero exit too, after the exit file is written", async () => {
	const { exit, calls } = await runPaneCommand({ body: "exit 7" });
	assert.equal(exit, "7");
	assert.ok(calls.includes("pane close w1:p5"));
	assert.ok(calls.includes("exit-file-at-close:7"));
});

test("the pane command has no linger, sleep, or Ctrl-C escape left", () => {
	const command = buildPaneCommand({ script: "/tmp/a.sh", exitFile: "/tmp/a.exit", label: "vpk-fix-x" });
	assert.doesNotMatch(command, /sleep|linger|Ctrl-C|release-agent|--state idle/u);
	assert.match(command, /> '\/tmp\/a\.exit'; "\$h" pane close "\$HERDR_PANE_ID" >\/dev\/null 2>&1$/u);
});

test("a worktree workspace's root pane is kept: no close, and nothing after the exit file", async () => {
	const { exit, calls, command } = await runPaneCommand({ body: "exit 3", closeOnExit: false });
	assert.equal(exit, "3");
	assert.equal(calls.some((line) => line.startsWith("pane close")), false);
	assert.match(command, /> '[^']+\.exit'$/u);
});

test("a broken herdr never changes the recorded exit status", async () => {
	const { exit } = await runPaneCommand({ body: "exit 5", herdrBody: "echo boom >&2; exit 9" });
	assert.equal(exit, "5");
	const missing = tempScript("exit 0");
	const command = buildPaneCommand({ script: missing, exitFile: `${missing}.exit`, label: "vpk-fix-x" });
	spawnSync("bash", ["-c", command], { env: { PATH: process.env.PATH, HERDR_BIN_PATH: "/nonexistent/herdr", HERDR_PANE_ID: "w1:p5" } });
	assert.equal(fs.readFileSync(`${missing}.exit`, "utf8").trim(), "0");
});

// ── Task workspace state on the root pane ─────────────────────────────────────

const TASK = { rootPaneId: "w7:p1", workspaceId: "w7", callerPaneId: "w1:p9" };
const SURFACE = path.join(__dirname, "agent-surface.js");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, { timeoutMs = 8000, what = "condition" } = {}) {
	const deadline = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > deadline) assert.fail(`timed out waiting for ${what}`);
		await sleep(20);
	}
}

// A task workspace w7 (root pane w7:p1) served by scripts/fixtures/fake-herdr.js, which keeps
// herdr's state across processes: real pane runners call it, and its pane run starts them.
function taskWorkspace(config = {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-herdr-"));
	const bin = path.join(dir, "herdr");
	fs.writeFileSync(bin, `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(path.join(__dirname, "fixtures", "fake-herdr.js"))} "$@"\n`, { mode: 0o755 });
	const settings = { workspace: "w7", rootPane: "w7:p1", alreadyOpen: true, rootHeld: true, ...config };
	fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify(settings));
	const lines = (file) => (fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
	const rootReports = () => lines("reports.jsonl").filter((report) => report.pane === "w7:p1" && report.message !== null).sort((a, b) => a.seq - b.seq);
	return {
		env: { PATH: process.env.PATH, HERDR_ENV: "1", HERDR_BIN_PATH: bin, FAKE_HERDR_DIR: dir, HERDR_PANE_ID: "w1:p9", HERDR_WORKSPACE_ID: "w1" },
		calls: () => lines("calls.jsonl"),
		reports: () => lines("reports.jsonl"),
		rootReports,
		rootState: () => rootReports().at(-1) ?? null,
		closed: (pane) => lines("panes.jsonl").some((event) => event.pane === pane && event.event === "close"),
	};
}

// One task directory; each script marks that it started, then waits for its .go file.
function taskScripts(...exits) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-task-"));
	return exits.map((exit, index) => {
		const script = path.join(dir, index === 0 ? "run.sh" : `run-${index}.sh`);
		fs.writeFileSync(script, `touch "$0.started"\nwhile [ ! -f "$0.go" ]; do sleep 0.02; done\nexit ${exit}\n`);
		return script;
	});
}
const started = (script) => fs.existsSync(`${script}.started`);
const release = (script) => fs.writeFileSync(`${script}.go`, "");
const liveRunFiles = (script) => {
	const dir = path.join(path.dirname(script), "live-runs");
	return fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith(".json")) : [];
};

// The planner's launch: `agent-surface.js run --worktree … --no-wait` in a child process.
function launch(ws, tree, script) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [SURFACE, "run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree, "--no-wait"], { env: ws.env });
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("close", (code) => resolve({ code, stderr }));
	});
}

test("task workspace: a run that exits 0 reports working, then idle on the root pane, then holds it", () => {
	const ws = taskWorkspace();
	const script = tempScript("exit 0");
	const command = buildPaneCommand({ script, exitFile: `${script}.exit`, label: "vpk-fix-x", closeOnExit: false, task: TASK });
	fs.writeFileSync(`${script}.pane.sh`, `${command}\n`);
	spawnSync("bash", [`${script}.pane.sh`], { env: { ...ws.env, HERDR_PANE_ID: "w7:p1" }, stdio: "ignore" });
	assert.deepEqual(ws.rootReports().map(({ state, message }) => [state, message]), [["working", "working · run.sh"], ["idle", "done · run.sh"]]);
	assert.match(command, /read -r _$/u);
	assert.equal(ws.calls().some(({ key }) => key === "pane close"), false);
	assert.deepEqual(liveRunFiles(script), [], "unregistered");
});

test("task workspace: a run that fails reports blocked with its exit status, and its own pane closes", () => {
	const ws = taskWorkspace();
	const script = tempScript("exit 7");
	fs.writeFileSync(`${script}.pane.sh`, `${buildPaneCommand({ script, exitFile: `${script}.exit`, label: "vpk-fix-x", task: TASK })}\n`);
	spawnSync("bash", [`${script}.pane.sh`], { env: { ...ws.env, HERDR_PANE_ID: "w7:p4" }, stdio: "ignore" });
	assert.deepEqual([ws.rootState().state, ws.rootState().message], ["blocked", "failed · exit 7"]);
	assert.equal(ws.closed("w7:p4"), true);
});

test("task workspace: a run is registered with its pane and runner pid while its script runs", () => {
	const ws = taskWorkspace();
	// The script waits for its own registry entry, which a background step writes, and keeps it.
	const script = tempScript('for i in $(seq 250); do cat "$(dirname "$0")"/live-runs/*.json > "$0.entry" 2>/dev/null && break; sleep 0.02; done');
	fs.writeFileSync(`${script}.pane.sh`, `${buildPaneCommand({ script, exitFile: `${script}.exit`, label: "vpk-fix-x", task: TASK })}\n`);
	spawnSync("bash", [`${script}.pane.sh`], { env: { ...ws.env, HERDR_PANE_ID: "w7:p4" }, stdio: "ignore" });
	const entry = JSON.parse(fs.readFileSync(`${script}.entry`, "utf8"));
	assert.deepEqual([entry.pane, entry.script, Number.isInteger(entry.pid)], ["w7:p4", script, true]);
	assert.deepEqual(liveRunFiles(script), []);
});

test("review 5.1: two runs ending together leave the workspace idle, not working", async () => {
	// A slow pane list made both old end-of-run checks see the other run still working.
	const ws = taskWorkspace({ delayMs: { "pane list": 500 } });
	const { tree } = linkedWorktree();
	const [first, second] = taskScripts(0, 0);
	await launch(ws, tree, first);
	await launch(ws, tree, second);
	await waitFor(() => started(first) && started(second), { what: "both runs to start" });
	release(first);
	release(second);
	await waitFor(() => ws.closed("w7:p100") && ws.closed("w7:p101"), { what: "both panes to close" });
	assert.equal(ws.rootState().state, "idle");
	assert.deepEqual(liveRunFiles(first), []);
});

test("review 5.1: a run ending while another starts, or still runs, leaves working until the last ends", async () => {
	// The first run's end is slow: a stale answer and a delayed report, as from a busy herdr.
	const ws = taskWorkspace({ delayMs: { "w7:p100 pane list": 1500, "w7:p100 pane report-agent": 1500 } });
	const { tree } = linkedWorktree();
	const [first, second] = taskScripts(0, 7);
	await launch(ws, tree, first);
	await waitFor(() => started(first), { what: "the first run to start" });
	release(first);
	// The second launches once the first has started its end-of-run decision.
	const deciding = ({ caller, key, args }) => caller === "w7:p100" && (key === "pane list" || (key === "pane report-agent" && args[0] === "w7:p1" && args[args.indexOf("--state") + 1] !== "working"));
	await waitFor(() => ws.calls().some(deciding), { what: "the first run's end-of-run report" });
	await launch(ws, tree, second);
	await waitFor(() => started(second) && ws.closed("w7:p100"), { what: "the first run to end" });
	await sleep(300);
	assert.equal(ws.rootState().state, "working", "the second run still runs");
	release(second);
	await waitFor(() => ws.closed("w7:p101"), { what: "the second run to end" });
	assert.deepEqual([ws.rootState().state, ws.rootState().message], ["blocked", "failed · exit 7"]);
});

test("review 5.1: a crashed run's registry entry never holds the workspace at working", async () => {
	const ws = taskWorkspace();
	const { tree } = linkedWorktree();
	const [crashed, next] = taskScripts(0, 0);
	await launch(ws, tree, crashed);
	await waitFor(() => started(crashed) && ws.reports().some((report) => report.pane === "w7:p100") && ws.rootState()?.state === "working", { what: "the first run to start and report" });
	// SIGKILL: no EXIT trap, no end-of-run report, the pane stays open showing working.
	spawnSync("pkill", ["-KILL", "-f", crashed]);
	await launch(ws, tree, next);
	release(next);
	await waitFor(() => ws.closed("w7:p101"), { what: "the second run to end" });
	assert.equal(ws.closed("w7:p100"), false, "the crashed run's pane is still open");
	assert.deepEqual([ws.rootState().state, ws.rootState().message], ["idle", "done · run-1.sh"]);
	assert.deepEqual(liveRunFiles(crashed), [], "the dead run's entry was pruned");
});

test("review 5.1: the registry lock admits one process at a time and breaks a dead or stale holder's", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-lock-"));
	const lock = path.join(dir, "live-runs.lock");
	const log = path.join(dir, "log");
	// Each holder logs its entry, holds the lock for 30 ms, then logs its exit.
	const holder = `const { withLock } = require(${JSON.stringify(SURFACE)}); const fs = require("node:fs");
for (let i = 0; i < 5; i += 1) withLock(${JSON.stringify(lock)}, () => {
	fs.appendFileSync(${JSON.stringify(log)}, "in\\n");
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30);
	fs.appendFileSync(${JSON.stringify(log)}, "out\\n");
});`;
	const exits = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve) => spawn(process.execPath, ["-e", holder], { stdio: "inherit" }).on("exit", resolve))));
	assert.deepEqual(exits, [0, 0, 0, 0]);
	const lines = fs.readFileSync(log, "utf8").trim().split("\n");
	assert.equal(lines.length, 40);
	assert.ok(lines.every((line, index) => line === (index % 2 === 0 ? "in" : "out")), "two holders overlapped");
	assert.equal(fs.existsSync(lock), false, "released");

	// A lock whose holder died, or one older than any holder takes, is broken.
	const dead = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout;
	fs.mkdirSync(lock);
	fs.writeFileSync(path.join(lock, "owner"), `${dead} x`);
	assert.equal(withLock(lock, () => "taken"), "taken");
	fs.mkdirSync(lock);
	fs.writeFileSync(path.join(lock, "owner"), `${process.ppid} x`);
	fs.utimesSync(lock, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
	assert.equal(withLock(lock, () => "taken"), "taken");
});

test("review 5.2: a hung herdr at launch still starts the worker; a hung placement fails fast", async () => {
	const ws = taskWorkspace({ hang: ["pane get", "pane process-info", "pane report-agent", "pane report-metadata", "pane rename", "agent rename"] });
	const { tree } = linkedWorktree();
	const script = tempScript('touch "$0.started"');
	const begin = Date.now();
	const launching = launch(ws, tree, script);
	await waitFor(() => started(script), { timeoutMs: 2500, what: "the worker to start despite the hung herdr" });
	assert.equal((await launching).code, 0);
	await waitFor(() => fs.existsSync(`${script}.exit`), { timeoutMs: 2500, what: "the exit file" });
	assert.ok(Date.now() - begin < 3000, "neither waited on a herdr timeout");

	const placing = taskWorkspace({ hang: ["worktree open"] });
	const before = Date.now();
	const { code, stderr } = await launch(placing, tree, tempScript());
	assert.equal(code, 2);
	assert.match(stderr, /herdr worktree open timed out after 3000ms/u);
	assert.ok(Date.now() - before < 6000);
});

test("review 5.3: the exit file lands before a slow workspace report", async () => {
	const ws = taskWorkspace({ delayMs: { "w7:p4 pane get": 1500 } });
	const script = tempScript(`"${process.execPath}" -e 'process.stdout.write(String(Date.now()))' > "$0.done"`);
	fs.writeFileSync(`${script}.pane.sh`, `${buildPaneCommand({ script, exitFile: `${script}.exit`, label: "vpk-fix-x", task: TASK })}\n`);
	const child = spawn("bash", [`${script}.pane.sh`], { env: { ...ws.env, HERDR_PANE_ID: "w7:p4" }, stdio: "ignore" });
	await waitFor(() => fs.existsSync(`${script}.exit`) && fs.readFileSync(`${script}.exit`, "utf8").trim() !== "", { what: "the exit file" });
	const exitAt = Date.now();
	assert.ok(exitAt - Number(fs.readFileSync(`${script}.done`, "utf8")) < 1000, "the exit file waited on the report");
	assert.notEqual(ws.rootState()?.state, "idle", "the report is still on its way");
	await new Promise((resolve) => child.on("exit", resolve));
	assert.equal(ws.rootState().state, "idle");
});

const PYTHON = spawnSync("python3", ["-I", "-c", "import pty"]).status === 0;

test("task workspace: in a real terminal the root pane holds at Press Enter, its report kept, until Enter", { skip: !PYTHON && "needs python3 for a pseudo-terminal" }, async () => {
	const ws = taskWorkspace();
	const script = tempScript("exit 0");
	fs.writeFileSync(`${script}.pane.sh`, `${buildPaneCommand({ script, exitFile: `${script}.exit`, label: "vpk-fix-x", closeOnExit: false, task: TASK })}\n`);
	// pty.spawn gives bash a real terminal on stdin, as a herdr pane does, so read blocks.
	const child = spawn("python3", ["-I", "-c", "import pty, sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)", "bash", `${script}.pane.sh`], { env: { ...ws.env, HERDR_PANE_ID: "w7:p1" } });
	let output = "";
	let exit = null;
	child.stdout.on("data", (chunk) => { output += chunk; });
	child.on("exit", (code) => { exit = code; });
	await waitFor(() => output.includes("Press Enter for a shell.") && ws.rootState()?.state === "idle", { what: "the hold" });
	await sleep(1000);
	assert.equal(exit, null, "still holding a second later");
	child.stdin.write("\r");
	await waitFor(() => exit !== null, { what: "the runner to end on Enter" });
	assert.equal(exit, 0);
});

test("task workspace: the wrapper makes no report call; the runner registers and reports before its script", async () => {
	const script = tempScript();
	const { tree } = linkedWorktree();
	const { herdr, calls } = fakeHerdr({ alreadyOpen: true });
	await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree]), { env: { ...herdrEnv, HERDR_PANE_ID: "w1:p9" }, herdr, log: () => {} });
	assert.deepEqual(calls.map(([group, verb]) => `${group} ${verb}`), ["worktree open", "tab list", "tab create", "pane run"]);
	const runner = fs.readFileSync(`${script}.pane.sh`, "utf8");
	assert.match(runner, /task-state "\$@" --root 'w7:p1' --workspace 'w7' --caller 'w1:p9' --script '[^']+' --pid \$\$/u);
	assert.ok(runner.indexOf("ts start") < runner.indexOf(`bash '${script}'`));
});

// A fake herdr binary for the pane's task-state calls: the root pane is in w7 and held by
// its pane runner; every call is logged.
const TASK_HERDR = [
	'printf "%s\\n" "$*" >> "$LOG"',
	'case "$1 $2" in',
	'"pane get") printf \'{"result":{"pane":{"pane_id":"%s","workspace_id":"w7"}}}\' "$3" ;;',
	'"pane process-info") printf \'{"result":{"process_info":{"foreground_processes":[{"argv":["bash","/o/run.sh.pane.sh"]}]}}}\' ;;',
	'"pane report-agent") echo "invalid_state" >&2; exit 1 ;;',
	"esac",
].join("\n");

test("task workspace: a rejected report logs one line per report and never changes the run's exit", async () => {
	const { exit, result } = await runPaneCommand({ body: "exit 5", closeOnExit: true, task: TASK, paneId: "w7:p4", herdrBody: TASK_HERDR });
	assert.equal(exit, "5");
	const line = "agent-surface: task workspace state not reported: herdr pane report-agent failed: invalid_state";
	assert.deepEqual(result.stderr.trim().split("\n"), [line, line], "one as the run starts, one as it ends");
});

test("task workspace: never the planner's pane, a pane in another workspace, or a bare prompt", () => {
	const calls = [];
	const herdr = ({ workspace = "w7", held = true } = {}) => (args) => {
		calls.push(args);
		if (args[1] === "get") return { pane: { pane_id: args[2], workspace_id: workspace } };
		if (args[1] === "process-info") return { process_info: { foreground_processes: held ? [{ argv: ["bash", "/o/run.sh.pane.sh"] }] : [{ argv: ["-zsh"] }] } };
		return {};
	};
	const reported = () => calls.some((args) => args[1] === "report-agent");
	const report = (options, fake) => reportTaskState(fake, { ...TASK, state: "idle", message: "done · run.sh", seq: 1, ...options });
	assert.equal(report({ callerPaneId: "w7:p1" }, herdr()), "skipped: the caller's pane");
	assert.equal(report({}, herdr({ workspace: "w1" })), "skipped: outside the task workspace");
	assert.match(report({}, herdr({ held: false })), /^skipped: the root pane is at a shell prompt/u);
	assert.equal(reported(), false);
	assert.equal(report({}, herdr()), "reported");
	assert.equal(taskState(["end", "--root", "w7:p1"], { herdr: herdr(), log: () => {} }), 0, "bad arguments still exit 0");
});

test("a pane that closed itself after writing the exit file is a result, not an error", async () => {
	const script = tempScript();
	const exitFile = `${script}.exit`;
	// The close lands between the poll that missed the file and the liveness check.
	let checks = 0;
	const status = await waitForExitFile(exitFile, {
		timeoutMs: 0,
		isAlive: () => {
			checks += 1;
			fs.writeFileSync(exitFile, "6\n");
			return false;
		},
		pollIntervalMs: 0,
	});
	assert.equal(status, 6);
	assert.equal(checks, 1);
	fs.rmSync(exitFile);
	await assert.rejects(waitForExitFile(exitFile, { timeoutMs: 0, isAlive: () => false, pollIntervalMs: 0 }), /surface closed before/u);
});

test("agent names are the surface name, or a hashed prefix that keeps long labels distinct", () => {
	const AGENT_NAME = /^[a-z][a-z0-9_-]{0,31}$/u;
	assert.equal(agentNameFor("vpk-fix-sidebar"), "vpk-fix-sidebar");
	const exact = "vpk-research-authentication-midd";
	assert.equal(exact.length, 32);
	assert.equal(agentNameFor(exact), exact);

	const first = agentNameFor("vpk-research-authentication-middleware-1");
	const second = agentNameFor("vpk-research-authentication-middleware-2");
	assert.notEqual(first, second);
	for (const name of [first, second]) {
		assert.match(name, AGENT_NAME);
		assert.match(name, /^vpk-research-authenticati-[0-9a-f]{6}$/u);
	}
	// Stable across runs, so `herdr agent wait` can be given the same name later.
	assert.equal(agentNameFor("vpk-research-authentication-middleware-1"), first);
	// A cut that lands on a dash drops it rather than doubling it before the hash.
	const dashAt25 = agentNameFor("vpk-docs-abcdefghijklmnop-qrstuvwxyz");
	assert.match(dashAt25, /^vpk-docs-abcdefghijklmnop-[0-9a-f]{6}$/u);
	assert.doesNotMatch(dashAt25, /--/u);
});

test("inline surface runs the script and returns its status", async () => {
	const script = tempScript("exit 4");
	const status = await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--surface", "inline"]), {
		env: { PATH: process.env.PATH },
		herdr: () => assert.fail("inline must not call herdr"),
		log: () => {},
	});
	assert.equal(status, 4);
	assert.equal(fs.readFileSync(`${script}.exit`, "utf8").trim(), "4");
});

test("each inline run records its start before launch and its end, so a reused script keeps both runs", async () => {
	const script = tempScript('test -f "$0.start" || exit 9; exit 4');
	for (let i = 0; i < 2; i += 1) {
		await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--surface", "inline"]), { env: { PATH: process.env.PATH }, herdr: () => assert.fail("inline"), log: () => {} });
	}
	const records = readRecords(script);
	assert.deepEqual(records.map(({ script: name, endedAt, exit }) => [name, endedAt === null, exit]), [["run.sh", true, null], ["run.sh", false, 4], ["run.sh", true, null], ["run.sh", false, 4]]);
	assert.equal(records[0].startedAt, records[1].startedAt);
	assert.notEqual(records[0].startedAt, records[2].startedAt);
	assert.ok(Date.parse(records[1].endedAt) >= Date.parse(records[1].startedAt));
	assert.equal(fs.readFileSync(`${script}.start`, "utf8").trim(), records[2].startedAt);
});

test("the pane appends the run's end to runs.jsonl before it writes the exit file", async () => {
	const { exit, command } = await runPaneCommand({ body: "exit 7" });
	const script = command.match(/; bash '([^']+)'; s=\$\?/u)[1];
	assert.equal(exit, "7");
	const [record] = readRecords(script);
	assert.equal(record.script, "run.sh");
	assert.equal(record.exit, 7);
	assert.ok(Number.isFinite(Date.parse(record.startedAt)) && Number.isFinite(Date.parse(record.endedAt)));
	assert.ok(command.indexOf("runs.jsonl") < command.indexOf(".exit'"));
});

test("review 3.4: the pane records its end with milliseconds, never before the work finished", async () => {
	// The script's last act is to note the time; the recorded end must not precede it.
	const { command } = await runPaneCommand({ body: `sleep 0.2; "${process.execPath}" -e 'process.stdout.write(String(Date.now()))' > "$0.lastwork"` });
	const script = command.match(/; bash '([^']+)'; s=\$\?/u)[1];
	const [record] = readRecords(script);
	for (const field of ["startedAt", "endedAt"]) assert.match(record[field], /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u, field);
	assert.ok(Date.parse(record.endedAt) >= Date.parse(record.startedAt));
	assert.ok(Date.parse(record.endedAt) >= Number(fs.readFileSync(`${script}.lastwork`, "utf8")), `${record.endedAt} is before the work finished`);
});

test("default herdr placement opens a labelled tab in the caller's workspace", async () => {
	const script = tempScript();
	const { herdr, calls, startSeen } = fakeHerdr();
	const status = await run(parseArgs(["run", "--script", script, "--label", "vpk-audit-x"]), { env: herdrEnv, herdr, log: () => {} });
	assert.equal(startSeen(), true, "the .start file exists before pane run");
	assert.equal(readRecords(script)[0].endedAt, null, "the wrapper wrote the start line; the pane writes the end");
	assert.equal(status, 3);
	const create = calls.find(([group, verb]) => group === "tab" && verb === "create");
	assert.deepEqual(create.slice(2), ["--workspace", "w1", "--cwd", process.cwd(), "--label", "vpk-audit-x", "--no-focus"]);
	// The pane names itself, so a slow herdr never holds up the launch.
	assert.equal(calls.some(([group, verb]) => group === "pane" && verb === "rename"), false);
	// The pane only receives a short `bash <runner>` line; the runner holds the reporting command.
	const paneRun = calls.find(([group, verb]) => group === "pane" && verb === "run");
	assert.equal(paneRun[3], `bash '${script}.pane.sh'`);
	const runner = fs.readFileSync(`${script}.pane.sh`, "utf8");
	assert.ok(runner.includes("pane report-agent") && runner.includes("--state working"));
	assert.ok(runner.includes(`pane rename "$HERDR_PANE_ID" 'vpk-audit-x'`));
	assert.ok(runner.includes(`pane close "$HERDR_PANE_ID"`));
});

test("a group reuses its tab and splits beside the last pane", async () => {
	const script = tempScript();
	const { herdr, calls } = fakeHerdr({
		tabs: [{ label: "vpk-audit-x", tab_id: "w1:t4", workspace_id: "w1" }],
		panes: [{ pane_id: "w1:p8", tab_id: "w1:t4" }, { pane_id: "w1:p2", tab_id: "w1:t1" }],
	});
	await run(parseArgs(["run", "--script", script, "--label", "vpk-audit-x-2", "--group", "vpk-audit-x"]), { env: herdrEnv, herdr, log: () => {} });
	assert.equal(calls.some(([group, verb]) => group === "tab" && verb === "create"), false);
	const split = calls.find(([group, verb]) => group === "pane" && verb === "split");
	assert.deepEqual(split.slice(2), ["w1:p8", "--direction", "right", "--cwd", process.cwd(), "--no-focus"]);
});

test("the main checkout is git's first worktree, from a linked worktree and from itself", () => {
	const { main, tree } = linkedWorktree();
	assert.equal(mainCheckoutFor(tree), main);
	assert.equal(mainCheckoutFor(main), main);
	assert.throws(() => mainCheckoutFor(os.tmpdir()), /is not a git worktree/u);
});

test("a separate git dir, where git keeps no main checkout path, is refused with a clear error", () => {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-sep-")));
	const main = path.join(dir, "checkout");
	const tree = path.join(dir, "linked");
	fs.mkdirSync(path.join(dir, "metadata"));
	git("init", "-q", "--separate-git-dir", path.join(dir, "metadata", "project.git"), main);
	git("-C", main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
	git("-C", main, "worktree", "add", "-q", "-b", "vpk/fix-x", tree);
	assert.throws(() => mainCheckoutFor(tree), /git does not record the main checkout/u);
	assert.throws(() => mainCheckoutFor(main), /git does not record the main checkout/u);
});

test("a worktree of a bare repository is refused with a clear error", () => {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-bare-")));
	const seed = path.join(dir, "seed");
	git("init", "-q", seed);
	git("-C", seed, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "init");
	git("clone", "-q", "--bare", seed, path.join(dir, "bare.git"));
	const tree = path.join(dir, "linked");
	git("-C", path.join(dir, "bare.git"), "worktree", "add", "-q", "-b", "vpk/fix-x", tree);
	assert.throws(() => mainCheckoutFor(tree), /belongs to a bare repository/u);
});

test("a linked worktree opens its own workspace from the main checkout and runs in its root pane", async () => {
	const script = tempScript();
	const { main, tree } = linkedWorktree();
	const { herdr, calls } = fakeHerdr();
	await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree]), { env: herdrEnv, herdr, log: () => {} });
	const open = calls.find(([group, verb]) => group === "worktree" && verb === "open");
	assert.deepEqual(open.slice(2), ["--cwd", main, "--path", tree, "--label", "vpk-fix-x", "--no-focus"]);
	assert.ok(calls.some(([group, verb, pane]) => group === "pane" && verb === "run" && pane === "w7:p1"));
	assert.equal(calls.some(([group, verb]) => group === "tab" && verb === "create"), false);
	// Closing the root pane would close the task's sidebar workspace.
	assert.equal(fs.readFileSync(`${script}.pane.sh`, "utf8").includes("pane close"), false);
});

test("an already-open worktree without a same-label tab gets a new tab instead of its busy root pane", async () => {
	const script = tempScript();
	const { tree } = linkedWorktree();
	const { herdr, calls } = fakeHerdr({ alreadyOpen: true });
	await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree]), { env: herdrEnv, herdr, log: () => {} });
	const create = calls.find(([group, verb]) => group === "tab" && verb === "create");
	assert.deepEqual(create.slice(2), ["--workspace", "w7", "--cwd", tree, "--label", "vpk-fix-x", "--no-focus"]);
	assert.equal(calls.some(([group, verb, pane]) => group === "pane" && verb === "run" && pane === "w7:p1"), false);
	assert.ok(fs.readFileSync(`${script}.pane.sh`, "utf8").includes(`pane close "$HERDR_PANE_ID"`));
});

test("an already-open worktree splits into its existing tab with the same label", async () => {
	const script = tempScript();
	const { tree } = linkedWorktree();
	const { herdr, calls } = fakeHerdr({
		alreadyOpen: true,
		tabs: [{ label: "vpk-fix-x", tab_id: "w7:t3", workspace_id: "w7" }],
		panes: [{ pane_id: "w7:p4", tab_id: "w7:t3" }, { pane_id: "w7:p1", tab_id: "w7:t1" }],
	});
	await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree]), { env: herdrEnv, herdr, log: () => {} });
	const list = calls.find(([group, verb]) => group === "tab" && verb === "list");
	assert.deepEqual(list.slice(2), ["--workspace", "w7"]);
	assert.equal(calls.some(([group, verb]) => group === "tab" && verb === "create"), false);
	const split = calls.find(([group, verb]) => group === "pane" && verb === "split");
	assert.deepEqual(split.slice(2), ["w7:p4", "--direction", "right", "--cwd", tree, "--no-focus"]);
	assert.equal(calls.some(([group, verb, pane]) => group === "pane" && verb === "run" && pane === "w7:p1"), false);
});

test("a failed worktree open throws instead of falling back to a tab", async () => {
	const script = tempScript();
	const { tree } = linkedWorktree();
	const { herdr, calls } = fakeHerdr({ worktreeError: "linked_worktree_source" });
	await assert.rejects(
		run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree]), { env: herdrEnv, herdr, log: () => {} }),
		/worktree open failed: linked_worktree_source/u,
	);
	assert.equal(calls.some(([group, verb]) => (group === "tab" && verb === "create") || (group === "pane" && verb === "run")), false);
});

test("real herdr failures surface herdr's own error text", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-"));
	const bin = path.join(dir, "fake-herdr");
	// Verbatim stderr from `herdr worktree open --cwd <linked worktree>`.
	fs.writeFileSync(bin, `#!/bin/sh\necho '{"error":{"code":"linked_worktree_source","message":"New and open worktree actions start from the repo parent workspace."},"id":"cli:worktree:open"}' >&2\nexit 1\n`, { mode: 0o755 });
	const herdr = createHerdr({ PATH: process.env.PATH, HERDR_BIN_PATH: bin });
	assert.throws(() => herdr(["worktree", "open"]), /herdr worktree open failed: .*linked_worktree_source/u);
});

test("herdr surface outside a herdr workspace fails loudly", async () => {
	const script = tempScript();
	const { herdr } = fakeHerdr();
	await assert.rejects(
		run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--surface", "herdr"]), { env: {}, herdr, log: () => {} }),
		/HERDR_WORKSPACE_ID is not set/u,
	);
});
