"use strict";

// Stop one worktree's dev session: shared by `pnpm ports kill` (scripts/show-worktree-ports.js)
// and the dev-stack budget's auto-stop (scripts/lib/dev-stack-auto-stop.js), so both stop a
// stack the same way and every stop goes through the target's own guard and stop log.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { sessionNameForWorktree } = require("./worktree-kill");
const { EXIT_STOP_REFUSED, decideStop, recordStop, refusalMessage } = require("./dev-stack-activity");

function standaloneTmuxBinary() {
	for (const candidate of [
		process.env.VPK_TMUX_BIN,
		"/opt/homebrew/bin/tmux",
		"/usr/local/bin/tmux",
		"/usr/bin/tmux",
	]) {
		if (!candidate) continue;
		try {
			fs.accessSync(candidate, fs.constants.X_OK);
			return candidate;
		} catch {
			// Try the next standalone binary.
		}
	}
	return "tmux";
}

function sameWorktreePath(left, right) {
	try {
		return fs.realpathSync(left) === fs.realpathSync(right);
	} catch {
		return path.resolve(left) === path.resolve(right);
	}
}

// Dev sessions with their start directories: every session on the private vpk-dev socket
// (only the launchers use it, and VPK_DEV_TMUX_SESSION / _PREFIX can rename a session), and the
// vpk-dev-* sessions on the default socket (the Rovo stack's; other tmux use lives there too).
function listDevSessions() {
	const sessions = [];
	const tmuxBinary = standaloneTmuxBinary();
	for (const socket of ["vpk-dev", "default"]) {
		const args = socket === "default" ? [] : ["-L", socket];
		const result = spawnSync(tmuxBinary, [...args, "list-sessions", "-F", "#{session_name}|#{session_path}"], {
			encoding: "utf8",
		});
		if (result.error) {
			throw new Error(`Could not inspect tmux's ${socket} socket: ${result.error.message}`);
		}
		if (result.status !== 0) {
			const message = String(result.stderr ?? "");
			if (/operation not permitted|permission denied|broken pipe/i.test(message)) {
				throw new Error(`Could not inspect tmux's ${socket} socket: ${message.trim()}`);
			}
			continue;
		}
		for (const line of result.stdout.split("\n")) {
			const separator = line.indexOf("|");
			if (separator < 0) continue;
			const name = line.slice(0, separator);
			const sessionPath = line.slice(separator + 1);
			if (sessionPath && (socket === "vpk-dev" || name.startsWith("vpk-dev-"))) {
				sessions.push({ name, socket, path: sessionPath });
			}
		}
	}
	return sessions;
}

// Older launchers can name a session from a Cursor worktree hash rather than
// today's branch/display name. Match the live session by its exact worktree
// path so the target stop script sends SIGINT to the right Portless owner.
function runningSessionForWorktree(worktree, sessions = listDevSessions()) {
	const matches = sessions
		.filter((session) => sameWorktreePath(session.path, worktree.path))
		.map(({ name, socket }) => ({ name, socket }));

	if (matches.length === 1) return matches[0];
	if (matches.length > 1) {
		throw new Error(
			`Multiple dev sessions belong to ${worktree.path}: ${matches.map((session) => session.name).join(", ")}. Inspect them before stopping this worktree.`,
		);
	}
	return null;
}

function describeWorktree(worktree) {
	const name = path.basename(worktree.path);
	const branch = worktree.isMain ? "main" : worktree.branch || worktree.identifier;
	return `${name} (${branch})  →  ${sessionNameForWorktree(worktree)}`;
}

// Stop one worktree's dev session. Delegate to the target worktree's OWN
// launcher so its cwd-scoped cleanup (SIGINT so portless removes its route,
// kill-session, listener backstop, port-file removal) runs against the right
// worktree. Never a raw kill-session here — that would leave a stale portless
// route behind.
//
// The stop names its requester (VPK_DEV_STOP_BY / VPK_DEV_STOP_FROM), so the target's launcher
// refuses it while that stack is in use when it comes from another worktree, and logs who
// stopped it (scripts/lib/dev-stack-activity.js). This caller's own copy of that check runs
// first too: a target branched before the guard existed ignores the requester and would stop at
// once. `force` passes `stop --force`: the explicit `pnpm ports kill <id> --force`, or a second
// confirmed kill in the interactive dashboard after the first was refused.
function canonicalWorktreePath(value) {
	try {
		return fs.realpathSync(value);
	} catch {
		return path.resolve(value);
	}
}

// `requester` names who asks (default: `pnpm ports kill`). `quiet` drops the announcement and
// captures the target launcher's output, replaying it only when the stop fails (the dev-stack
// budget's auto-stop prints one line per stopped stack instead).
function stopWorktree(worktree, { force = false, requester = defaultRequester(), quiet = false, sessions } = {}) {
	const scriptPath = path.join(worktree.path, "scripts", "dev-tmux-plain.sh");
	if (!quiet) console.log(`🔪 Stopping ${describeWorktree(worktree)}\n`);
	let runningSession;
	try {
		runningSession = runningSessionForWorktree(worktree, sessions ?? listDevSessions());
	} catch (error) {
		console.error(error.message);
		return 2;
	}
	if (runningSession?.socket === "default") {
		console.error(`The live session is on tmux's default socket. Use the vpk-system-clean sweep for this legacy stack.`);
		return 2;
	}
	if (!force) {
		const decision = decideStop({ worktreePath: worktree.path, env: { ...process.env, ...requester } });
		if (!decision.allowed) {
			const target = canonicalWorktreePath(worktree.path);
			recordStop({ decision, worktreePath: target, session: runningSession?.name ?? null });
			process.stderr.write(refusalMessage(target, decision));
			return EXIT_STOP_REFUSED;
		}
	}
	const { status, error, stdout, stderr } = spawnSync("bash", [scriptPath, "stop", ...(force ? ["--force"] : [])], {
		cwd: worktree.path,
		env: runningSession
			? {
					...process.env,
					...requester,
					VPK_DEV_TMUX_SESSION: runningSession.name,
					VPK_TMUX_SOCKET: runningSession.socket,
				}
			: { ...process.env, ...requester },
		stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
		encoding: "utf8",
	});
	if (error) {
		console.error(`Failed to run ${scriptPath}: ${error.message}`);
		return 1;
	}
	if (quiet && status !== 0) process.stderr.write(`${stdout ?? ""}${stderr ?? ""}`);
	return status ?? 0;
}

function defaultRequester() {
	return { VPK_DEV_STOP_BY: `pnpm ports kill (pid ${process.pid})`, VPK_DEV_STOP_FROM: process.cwd() };
}

module.exports = {
	canonicalWorktreePath,
	describeWorktree,
	listDevSessions,
	runningSessionForWorktree,
	sameWorktreePath,
	stopWorktree,
};
