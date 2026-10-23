#!/usr/bin/env node

// Runs a prepared shell script in a visible terminal surface when the caller is
// inside herdr, and inline otherwise, then waits for it and exits with its status.
//
//   node scripts/agent-surface.js run --script <file> --label <slug> [--cwd <dir>]
//        [--worktree <path>] [--group <tab-label>] [--no-wait] [--timeout-ms <n>]
//        [--surface auto|herdr|inline]
//
// Placement inside herdr:
//   --worktree <path>  the herdr workspace for that git worktree (opened if needed)
//   --group <label>    a tab with that label in the caller's workspace, split per run
//   neither            a new tab labelled --label in the caller's workspace

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const POLL_INTERVAL_MS = 1000;
const PANE_CHECK_EVERY = 10;

function shellQuote(value) {
	return `'${String(value).replace(/'/gu, `'\\''`)}'`;
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
	if (options.command !== "run") throw new Error("usage: agent-surface.js run --script <file> --label <slug> [options]");
	if (!options.script) throw new Error("--script is required");
	if (!options.label) throw new Error("--label is required");
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

// The pane command is written here and run as `bash <runner>`: typed into a shell in
// canonical mode, a line over 1024 bytes is rejected by `herdr pane run`.
function runnerFileFor(script) {
	return `${script}.pane.sh`;
}

// Herdr lifecycle reporting for the pane (see .agents/docs/herdr.md). The pane is
// not a recognised agent, so without these reports it shows as "unknown".
const REPORT_SOURCE = "vpk-agent-surface";
const REPORT_AGENT = "vpk-worker";
// After the script ends the pane stays busy this long so the settled state is
// visible and Herdr's own "finished" notification fires (it needs ~1s of a held
// pane; once the shell prompt returns Herdr auto-clears the agent). Ctrl-C skips.
const LINGER_SECONDS = 15;

// `herdr agent wait <name>` needs [a-z][a-z0-9_-]{0,31}; null when the label has nothing usable.
function agentNameFor(label) {
	const slug = String(label).toLowerCase().replace(/[^a-z0-9_-]+/gu, "-").replace(/^[-_]+|[-_]+$/gu, "");
	if (!slug) return null;
	return (/^[a-z]/u.test(slug) ? slug : `w-${slug}`).slice(0, 32).replace(/[-_]+$/u, "");
}

function buildPaneCommand({ script, exitFile, label, seq = Date.now(), lingerSeconds = LINGER_SECONDS }) {
	// Seqs must increase per pane across runs and fit in a u64: ms * 1000 leaves room for steps.
	const base = seq * 1000;
	const name = agentNameFor(label);
	// Reports run detached with output discarded, so a slow or failing herdr never blocks or fails the run.
	const bg = (command) => `( { ${command}; } >/dev/null 2>&1 & )`;
	const herdr = (args) => `"$h" ${args} "$HERDR_PANE_ID" --source ${REPORT_SOURCE} --agent ${REPORT_AGENT}`;
	const start = [
		herdr("pane report-agent") + ` --state working --seq ${base}`,
		herdr("pane report-metadata") + ` --title ${shellQuote(label)}`,
		...(name ? [`"$h" agent rename "$HERDR_PANE_ID" ${name}`] : []),
	].join("; ");
	const failed = `"exit $s"`;
	const end = [
		`if [ "$s" = 0 ]; then ${herdr("pane report-agent")} --state idle --seq ${base + 1}`,
		`else ${herdr("pane report-agent")} --state idle --message ${failed} --seq ${base + 1}; ${herdr("pane report-metadata")} --state-label done=${failed} --state-label idle=${failed}; fi`,
	].join("; ");
	return [
		`h="${"$"}{HERDR_BIN_PATH:-herdr}"`,
		bg(start),
		`bash ${shellQuote(script)}; s=$?; printf '%s\\n' "$s" > ${shellQuote(exitFile)}`,
		bg(end),
		`printf '\\n[agent-surface] exit %s; clearing herdr status in ${lingerSeconds}s (Ctrl-C skips)\\n' "$s"`,
		`sleep ${lingerSeconds}`,
		bg(herdr("pane release-agent") + ` --seq ${base + 2}`),
	].join("; ");
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

function placePane(herdr, options, env = process.env) {
	if (options.worktree) {
		const opened = herdr([
			"worktree", "open",
			"--cwd", options.cwd,
			"--path", options.worktree,
			"--label", options.label,
			"--no-focus",
		]);
		if (!opened.already_open) return opened.root_pane;
		const tabLabel = options.group ?? options.label;
		const existing = findTab(herdr, opened.workspace.workspace_id, tabLabel);
		return existing
			? splitIntoTab(herdr, existing, options.worktree)
			: createTab(herdr, opened.workspace.workspace_id, tabLabel, options.worktree);
	}

	const workspaceId = env.HERDR_WORKSPACE_ID;
	if (!workspaceId) throw new Error("HERDR_WORKSPACE_ID is not set; run inside a herdr pane or pass --surface inline");
	if (options.group) {
		const existing = findTab(herdr, workspaceId, options.group);
		if (existing) return splitIntoTab(herdr, existing, options.cwd);
		return createTab(herdr, workspaceId, options.group, options.cwd);
	}
	return createTab(herdr, workspaceId, options.label, options.cwd);
}

function paneAlive(herdr, paneId) {
	try {
		herdr(["pane", "get", paneId]);
		return true;
	} catch {
		return false;
	}
}

async function waitForExitFile(exitFile, { timeoutMs, isAlive }) {
	const startedAt = Date.now();
	for (let poll = 1; ; poll += 1) {
		if (fs.existsSync(exitFile)) {
			const status = Number.parseInt(fs.readFileSync(exitFile, "utf8").trim(), 10);
			return Number.isNaN(status) ? 1 : status;
		}
		if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
			throw new Error(`timed out after ${timeoutMs}ms waiting for ${exitFile}`);
		}
		if (poll % PANE_CHECK_EVERY === 0 && !isAlive()) {
			throw new Error(`surface closed before ${exitFile} was written`);
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}
}

async function run(options, { env = process.env, herdr = createHerdr(env), log = console.log } = {}) {
	if (!fs.existsSync(options.script)) throw new Error(`script not found: ${options.script}`);
	const exitFile = exitFileFor(options.script);
	fs.rmSync(exitFile, { force: true });
	const surface = resolveSurface(options.surface, env);

	if (surface === "inline") {
		log(JSON.stringify({ surface, script: options.script, exit_file: exitFile }));
		const result = spawnSync("bash", [options.script], { cwd: options.cwd, stdio: "inherit", env });
		const status = result.status ?? 1;
		fs.writeFileSync(exitFile, `${status}\n`);
		log(JSON.stringify({ exit: status }));
		return status;
	}

	const pane = placePane(herdr, options, env);
	herdr(["pane", "rename", pane.pane_id, options.label]);
	const runner = runnerFileFor(options.script);
	fs.writeFileSync(runner, `${buildPaneCommand({ script: options.script, exitFile, label: options.label })}\n`);
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
	agentNameFor,
	buildPaneCommand,
	parseArgs,
	resolveSurface,
	run,
	shellQuote,
	splitDirection,
};
