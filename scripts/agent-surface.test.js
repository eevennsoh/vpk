const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	agentNameFor,
	buildPaneCommand,
	parseArgs,
	resolveSurface,
	run,
	splitDirection,
} = require("./agent-surface.js");

function tempScript(body = "exit 0") {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-surface-"));
	const script = path.join(dir, "run.sh");
	fs.writeFileSync(script, `${body}\n`);
	return script;
}

// Fake herdr server: records calls and "runs" the pane command by writing the exit file.
function fakeHerdr({ tabs = [], panes = [], alreadyOpen = false } = {}) {
	const calls = [];
	let nextPane = 50;
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
		if (group === "pane" && verb === "layout") {
			return { layout: { panes: [{ pane_id: panes[0].pane_id, rect: { width: 200, height: 40 } }] } };
		}
		if (group === "pane" && verb === "split") {
			return { pane: { pane_id: `w1:p${nextPane++}`, tab_id: panes[0].tab_id, workspace_id: "w1" } };
		}
		if (group === "worktree" && verb === "open") {
			return {
				already_open: alreadyOpen,
				workspace: { workspace_id: "w7" },
				root_pane: { pane_id: "w7:p1", tab_id: "w7:t1", workspace_id: "w7" },
			};
		}
		if (group === "pane" && verb === "run") {
			const runner = args[3].match(/^bash '([^']+)'$/u)[1];
			const exitFile = fs.readFileSync(runner, "utf8").match(/> '([^']+\.exit)'/u)[1];
			fs.writeFileSync(exitFile, "3\n");
			return {};
		}
		return {};
	};
	return { herdr, calls };
}

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
	assert.throws(() => parseArgs(["run", "--label", "x"]), /--script is required/u);
	assert.throws(() => parseArgs(["run", "--script", "a.sh"]), /--label is required/u);
	const options = parseArgs(["run", "--script", "a.sh", "--label", "x", "--worktree", "/tmp/wt"]);
	assert.equal(options.cwd, "/tmp/wt");
	assert.equal(options.wait, true);
});

test("pane command records the exit status even when the script fails", () => {
	const command = buildPaneCommand({ script: "/tmp/it's.sh", exitFile: "/tmp/x.exit", label: "w" });
	assert.ok(command.includes(`; bash '/tmp/it'\\''s.sh'; s=$?;`));
	assert.ok(command.includes(`> '/tmp/x.exit'`));
	// Herdr's own "finished" notification fires from the lifecycle reports, so no custom toast.
	assert.equal(command.includes("notification show"), false);
});

// Runs the real pane command in bash against a fake herdr that logs each call.
async function runPaneCommand({ body, label = "Worker 1", herdrBody = 'printf "%s\\n" "$*" >> "$LOG"' }) {
	const script = tempScript(body);
	const dir = path.dirname(script);
	const bin = path.join(dir, "fake-herdr");
	const log = path.join(dir, "herdr.log");
	fs.writeFileSync(bin, `#!/bin/sh\n${herdrBody}\n`, { mode: 0o755 });
	const exitFile = `${script}.exit`;
	const command = buildPaneCommand({ script, exitFile, label, seq: 1700000000000, lingerSeconds: 0 });
	const result = spawnSync("bash", ["-c", command], {
		encoding: "utf8",
		env: { PATH: process.env.PATH, HERDR_BIN_PATH: bin, HERDR_PANE_ID: "w1:p5", LOG: log },
	});
	// Reports are detached; give them a moment to land.
	const readLog = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []);
	for (let i = 0; i < 50 && readLog().length < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
	return { result, exit: fs.readFileSync(exitFile, "utf8").trim(), calls: readLog() };
}

test("pane reports working, then settles and releases with increasing seqs", async () => {
	const { result, exit, calls } = await runPaneCommand({ body: "exit 0" });
	assert.equal(result.status, 0);
	assert.equal(exit, "0");
	// Reports are detached, so arrival order can vary; herdr orders them by --seq.
	const reports = calls.filter((line) => line.startsWith("pane report-agent") || line.startsWith("pane release-agent"));
	assert.deepEqual(new Set(reports), new Set([
		"pane report-agent w1:p5 --source vpk-agent-surface --agent vpk-worker --state working --seq 1700000000000000",
		"pane report-agent w1:p5 --source vpk-agent-surface --agent vpk-worker --state idle --seq 1700000000000001",
		"pane release-agent w1:p5 --source vpk-agent-surface --agent vpk-worker --seq 1700000000000002",
	]));
	assert.ok(calls.includes("pane report-metadata w1:p5 --source vpk-agent-surface --agent vpk-worker --title Worker 1"));
	assert.ok(calls.includes("agent rename w1:p5 worker-1"));
});

test("a failing script reports its exit status as the settled message", async () => {
	const { exit, calls } = await runPaneCommand({ body: "exit 7" });
	assert.equal(exit, "7");
	assert.ok(calls.includes("pane report-agent w1:p5 --source vpk-agent-surface --agent vpk-worker --state idle --message exit 7 --seq 1700000000000001"));
	assert.ok(calls.some((line) => line.startsWith("pane report-metadata") && line.includes("--state-label done=exit 7")));
});

test("a broken herdr never changes the recorded exit status", async () => {
	const { exit } = await runPaneCommand({ body: "exit 5", herdrBody: "echo boom >&2; exit 9" });
	assert.equal(exit, "5");
	const missing = tempScript("exit 0");
	const command = buildPaneCommand({ script: missing, exitFile: `${missing}.exit`, label: "x", lingerSeconds: 0 });
	spawnSync("bash", ["-c", command], { env: { PATH: process.env.PATH, HERDR_BIN_PATH: "/nonexistent/herdr", HERDR_PANE_ID: "w1:p5" } });
	assert.equal(fs.readFileSync(`${missing}.exit`, "utf8").trim(), "0");
});

test("agent names derived from labels satisfy herdr's name rule", () => {
	assert.equal(agentNameFor("worker-1"), "worker-1");
	assert.equal(agentNameFor("Fix Auth/Middleware!"), "fix-auth-middleware");
	assert.equal(agentNameFor("42-retry"), "w-42-retry");
	assert.equal(agentNameFor("***"), null);
	const long = agentNameFor("a".repeat(40));
	assert.match(long, /^[a-z][a-z0-9_-]{0,31}$/u);
	assert.equal(buildPaneCommand({ script: "/tmp/s", exitFile: "/tmp/s.exit", label: "***" }).includes("agent rename"), false);
});

test("inline surface runs the script and returns its status", async () => {
	const script = tempScript("exit 4");
	const status = await run(parseArgs(["run", "--script", script, "--label", "x", "--surface", "inline"]), {
		env: { PATH: process.env.PATH },
		herdr: () => assert.fail("inline must not call herdr"),
		log: () => {},
	});
	assert.equal(status, 4);
	assert.equal(fs.readFileSync(`${script}.exit`, "utf8").trim(), "4");
});

test("default herdr placement opens a labelled tab in the caller's workspace", async () => {
	const script = tempScript();
	const { herdr, calls } = fakeHerdr();
	const status = await run(parseArgs(["run", "--script", script, "--label", "worker-1"]), { env: herdrEnv, herdr, log: () => {} });
	assert.equal(status, 3);
	const create = calls.find(([group, verb]) => group === "tab" && verb === "create");
	assert.deepEqual(create.slice(2), ["--workspace", "w1", "--cwd", process.cwd(), "--label", "worker-1", "--no-focus"]);
	assert.ok(calls.some(([group, verb, pane, label]) => group === "pane" && verb === "rename" && pane === "w1:p50" && label === "worker-1"));
	// The pane only receives a short `bash <runner>` line; the runner holds the reporting command.
	const paneRun = calls.find(([group, verb]) => group === "pane" && verb === "run");
	assert.equal(paneRun[3], `bash '${script}.pane.sh'`);
	const runner = fs.readFileSync(`${script}.pane.sh`, "utf8");
	assert.ok(runner.includes("pane report-agent") && runner.includes("--state working"));
});

test("a group reuses its tab and splits beside the last pane", async () => {
	const script = tempScript();
	const { herdr, calls } = fakeHerdr({
		tabs: [{ label: "fanout", tab_id: "w1:t4", workspace_id: "w1" }],
		panes: [{ pane_id: "w1:p8", tab_id: "w1:t4" }, { pane_id: "w1:p2", tab_id: "w1:t1" }],
	});
	await run(parseArgs(["run", "--script", script, "--label", "worker-2", "--group", "fanout"]), { env: herdrEnv, herdr, log: () => {} });
	assert.equal(calls.some(([group, verb]) => group === "tab" && verb === "create"), false);
	const split = calls.find(([group, verb]) => group === "pane" && verb === "split");
	assert.deepEqual(split.slice(2), ["w1:p8", "--direction", "right", "--cwd", process.cwd(), "--no-focus"]);
});

test("a fresh worktree runs in the root pane of its new workspace", async () => {
	const script = tempScript();
	const { herdr, calls } = fakeHerdr();
	await run(parseArgs(["run", "--script", script, "--label", "fix-x", "--worktree", "/tmp/wt"]), { env: herdrEnv, herdr, log: () => {} });
	assert.ok(calls.some(([group, verb, pane]) => group === "pane" && verb === "run" && pane === "w7:p1"));
	assert.equal(calls.some(([group, verb]) => group === "tab" && verb === "create"), false);
});

test("an already-open worktree gets a new tab instead of its busy root pane", async () => {
	const script = tempScript();
	const { herdr, calls } = fakeHerdr({ alreadyOpen: true });
	await run(parseArgs(["run", "--script", script, "--label", "fix-x", "--worktree", "/tmp/wt"]), { env: herdrEnv, herdr, log: () => {} });
	const create = calls.find(([group, verb]) => group === "tab" && verb === "create");
	assert.deepEqual(create.slice(2, 4), ["--workspace", "w7"]);
	assert.equal(calls.some(([group, verb, pane]) => group === "pane" && verb === "run" && pane === "w7:p1"), false);
});

test("herdr surface outside a herdr workspace fails loudly", async () => {
	const script = tempScript();
	const { herdr } = fakeHerdr();
	await assert.rejects(
		run(parseArgs(["run", "--script", script, "--label", "x", "--surface", "herdr"]), { env: {}, herdr, log: () => {} }),
		/HERDR_WORKSPACE_ID is not set/u,
	);
});
