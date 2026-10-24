const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
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

// Runs the real pane command in bash against a fake herdr that logs each call.
async function runPaneCommand({ body, label = "vpk-feat-live-probe", herdrBody = 'printf "%s\\n" "$*" >> "$LOG"' }) {
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
	assert.ok(calls.includes("pane report-metadata w1:p5 --source vpk-agent-surface --agent vpk-worker --title vpk-feat-live-probe"));
	assert.ok(calls.includes("agent rename w1:p5 vpk-feat-live-probe"));
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
	const command = buildPaneCommand({ script: missing, exitFile: `${missing}.exit`, label: "vpk-fix-x", lingerSeconds: 0 });
	spawnSync("bash", ["-c", command], { env: { PATH: process.env.PATH, HERDR_BIN_PATH: "/nonexistent/herdr", HERDR_PANE_ID: "w1:p5" } });
	assert.equal(fs.readFileSync(`${missing}.exit`, "utf8").trim(), "0");
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

test("default herdr placement opens a labelled tab in the caller's workspace", async () => {
	const script = tempScript();
	const { herdr, calls } = fakeHerdr();
	const status = await run(parseArgs(["run", "--script", script, "--label", "vpk-audit-x"]), { env: herdrEnv, herdr, log: () => {} });
	assert.equal(status, 3);
	const create = calls.find(([group, verb]) => group === "tab" && verb === "create");
	assert.deepEqual(create.slice(2), ["--workspace", "w1", "--cwd", process.cwd(), "--label", "vpk-audit-x", "--no-focus"]);
	assert.ok(calls.some(([group, verb, pane, label]) => group === "pane" && verb === "rename" && pane === "w1:p50" && label === "vpk-audit-x"));
	// The pane only receives a short `bash <runner>` line; the runner holds the reporting command.
	const paneRun = calls.find(([group, verb]) => group === "pane" && verb === "run");
	assert.equal(paneRun[3], `bash '${script}.pane.sh'`);
	const runner = fs.readFileSync(`${script}.pane.sh`, "utf8");
	assert.ok(runner.includes("pane report-agent") && runner.includes("--state working"));
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
});

test("an already-open worktree without a same-label tab gets a new tab instead of its busy root pane", async () => {
	const script = tempScript();
	const { tree } = linkedWorktree();
	const { herdr, calls } = fakeHerdr({ alreadyOpen: true });
	await run(parseArgs(["run", "--script", script, "--label", "vpk-fix-x", "--worktree", tree]), { env: herdrEnv, herdr, log: () => {} });
	const create = calls.find(([group, verb]) => group === "tab" && verb === "create");
	assert.deepEqual(create.slice(2), ["--workspace", "w7", "--cwd", tree, "--label", "vpk-fix-x", "--no-focus"]);
	assert.equal(calls.some(([group, verb, pane]) => group === "pane" && verb === "run" && pane === "w7:p1"), false);
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
