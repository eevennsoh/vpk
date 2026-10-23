#!/usr/bin/env node

// vpk.worktree herdr plugin entrypoint. Runs as the worktree.created event hook
// and as the "warmup" workspace action. For checkouts of the VPK repo only, it
// copies missing ignored .env* files from the source checkout and runs
// `CI=true pnpm install --prefer-offline` in a labelled tab of the checkout's
// herdr workspace (falling back to a detached install logged to the plugin
// state dir). Anything else exits 0 quietly so herdr is never blocked.

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const {
	parseWorktreeCreatedEvent,
	parseActionContext,
	isSameRepo,
	selectEnvFiles,
	parseWorktreeList,
	pickSourceCheckout,
	buildInstallCommand,
} = require("./lib.js");

const HERDR = process.env.HERDR_BIN_PATH || "herdr";
const STATE_DIR = process.env.HERDR_PLUGIN_STATE_DIR || path.join(require("node:os").tmpdir(), "vpk-worktree-plugin");
const LOG_FILE = path.join(STATE_DIR, "warmup.log");
const TAB_LABEL = "vpk warmup";

function log(message) {
	const line = `[${new Date().toISOString()}] ${message}`;
	process.stdout.write(`${line}\n`);
	try {
		fs.mkdirSync(STATE_DIR, { recursive: true });
		fs.appendFileSync(LOG_FILE, `${line}\n`);
	} catch {
		// Logging is best-effort.
	}
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, ...options });
	return { ok: result.status === 0, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() };
}

function gitCommonDir(dir) {
	if (!dir || !fs.existsSync(dir)) return null;
	const result = run("git", ["-C", dir, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
	if (!result.ok || !result.stdout) return null;
	try {
		return fs.realpathSync(result.stdout);
	} catch {
		return null;
	}
}

function resolveTarget() {
	if (process.env.HERDR_PLUGIN_EVENT === "worktree.created") {
		return { source: "event", ...(parseWorktreeCreatedEvent(process.env.HERDR_PLUGIN_EVENT_JSON) || {}) };
	}
	return { source: "action", ...(parseActionContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || {}) };
}

function copyEnvFiles(sourceDir, targetDir) {
	const listed = run("git", ["-C", sourceDir, "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"]);
	if (!listed.ok) return [];
	const candidates = selectEnvFiles(listed.stdout.split("\0"), (rel) => fs.existsSync(path.join(targetDir, rel)));
	const copied = [];
	for (const rel of candidates) {
		const from = path.join(sourceDir, rel);
		if (!fs.statSync(from, { throwIfNoEntry: false })?.isFile()) continue;
		const to = path.join(targetDir, rel);
		fs.mkdirSync(path.dirname(to), { recursive: true });
		fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
		copied.push(rel);
	}
	return copied;
}

function herdrJson(args) {
	const result = run(HERDR, args);
	if (!result.ok) return null;
	try {
		return JSON.parse(result.stdout);
	} catch {
		return null;
	}
}

function startVisibleInstall(workspaceId, checkoutPath) {
	if (!workspaceId) return null;
	const created = herdrJson(["tab", "create", "--workspace", workspaceId, "--cwd", checkoutPath, "--label", TAB_LABEL, "--no-focus"]);
	const paneId = created?.result?.root_pane?.pane_id;
	if (!paneId) return null;
	const ran = run(HERDR, ["pane", "run", paneId, buildInstallCommand()]);
	return ran.ok ? paneId : null;
}

function startBackgroundInstall(checkoutPath) {
	fs.mkdirSync(STATE_DIR, { recursive: true });
	const out = fs.openSync(LOG_FILE, "a");
	const child = spawn("sh", ["-c", buildInstallCommand()], {
		cwd: checkoutPath,
		detached: true,
		stdio: ["ignore", out, out],
	});
	child.unref();
	return child.pid;
}

function main() {
	const target = resolveTarget();
	if (!target.checkoutPath) {
		log(`${target.source}: no checkout path in payload; skipping`);
		return;
	}

	const pluginRoot = process.env.HERDR_PLUGIN_ROOT || __dirname;
	const pluginRepo = gitCommonDir(pluginRoot);
	const targetRepo = gitCommonDir(target.checkoutPath);
	if (!isSameRepo(pluginRepo, targetRepo)) {
		log(`${target.source}: ${target.checkoutPath} is not a VPK checkout; skipping`);
		return;
	}

	const checkoutPath = fs.realpathSync(target.checkoutPath);
	const worktreePaths = parseWorktreeList(run("git", ["-C", checkoutPath, "worktree", "list", "--porcelain"]).stdout);
	const isMainCheckout = worktreePaths[0] && path.resolve(worktreePaths[0]) === checkoutPath;
	log(`${target.source}: warming ${checkoutPath} (workspace ${target.workspaceId || "?"})`);

	if (!isMainCheckout) {
		const sourceDir = pickSourceCheckout({ targetPath: checkoutPath, repoRoot: target.repoRoot, worktreePaths });
		if (sourceDir) {
			try {
				const copied = copyEnvFiles(sourceDir, checkoutPath);
				log(copied.length ? `copied env files from ${sourceDir}: ${copied.join(", ")}` : "env files already present");
			} catch (error) {
				log(`env copy failed: ${error.message}`);
			}
		}
	}

	if (!fs.existsSync(path.join(checkoutPath, "package.json"))) {
		log("no package.json; skipping install");
		return;
	}

	const paneId = startVisibleInstall(target.workspaceId, checkoutPath);
	if (paneId) {
		log(`install running in herdr pane ${paneId} (tab "${TAB_LABEL}")`);
		return;
	}
	const pid = startBackgroundInstall(checkoutPath);
	log(`no herdr pane available; install running in background (pid ${pid}), output in ${LOG_FILE}`);
}

try {
	main();
} catch (error) {
	log(`warmup error: ${error && error.stack ? error.stack : error}`);
}
process.exitCode = 0;
