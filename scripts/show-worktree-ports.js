#!/usr/bin/env node
/**
 * Show active port assignments + Portless URLs for git worktrees.
 *
 * Usage:
 *   node scripts/show-worktree-ports.js              one-shot snapshot
 *   node scripts/show-worktree-ports.js once         explicit one-shot snapshot alias
 *   node scripts/show-worktree-ports.js watch        interactive/live dashboard (1s refresh)
 *   node scripts/show-worktree-ports.js kill [id]    stop a worktree's dev session
 *                                                    (no id -> the worktree you're currently in; id -> that specific worktree)
 *
 * Main is always shown. Linked worktrees appear once they have dev-port state;
 * the live dashboard discovers them automatically on its next refresh.
 */

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { spawnSync } = require("node:child_process");
const { Worker } = require("node:worker_threads");
const { getAllWorktreePortInfo } = require("./lib/worktree-ports");
const { probePortAlive } = require("./lib/port-liveness");
const { loadPortlessRoutes, findPortlessUrl } = require("./lib/portless-routes");
const { matchWorktree, sessionNameForWorktree, findCurrentWorktree } = require("./lib/worktree-kill");

const SEPARATOR = "━".repeat(70);
const WATCH_INTERVAL_MS = 1000;

// Per-worktree "stop this session" affordance for the listing: the plain,
// copy-paste-ready command that stops this worktree's dev session. We key it on
// the tmux session name because that is guaranteed unambiguous (never collides
// across worktrees) and is a handle `pnpm ports kill` matches exactly.
function killCommand(worktree) {
	return `pnpm ports kill ${sessionNameForWorktree(worktree)}`;
}

const SNAPSHOT_WORKER_SCRIPT = `
const { parentPort } = require("node:worker_threads");
const { getAllWorktreePortInfo } = require(${JSON.stringify(path.join(__dirname, "lib", "worktree-ports.js"))});
parentPort.on("message", () => {
	try {
		parentPort.postMessage({ ok: true, data: getAllWorktreePortInfo() });
	} catch (error) {
		parentPort.postMessage({ ok: false, message: error.message });
	}
});
`;

function readPortFile(worktreePath, filename) {
	try {
		const portFile = path.join(worktreePath, filename);
		if (fs.existsSync(portFile)) {
			return fs.readFileSync(portFile, "utf8").trim();
		}
	} catch {
		// Ignore read errors
	}
	return null;
}

function readRovoPorts(worktreePath) {
	const poolText = readPortFile(worktreePath, ".dev-rovo-ports");
	if (poolText) {
		try {
			const parsed = JSON.parse(poolText);
			if (
				Array.isArray(parsed) &&
				parsed.length > 0 &&
				parsed.every((port) => Number.isInteger(port) && port > 0)
			) {
				return parsed.map(String);
			}
		} catch {
			// Fall back to the legacy single-port file.
		}
	}

	const single = readPortFile(worktreePath, ".dev-rovo-port");
	return single ? [single] : [];
}

async function probeOrNull(port) {
	if (!port) return null;
	const alive = await probePortAlive(port);
	return alive ? port : null;
}

async function collectWorktreeRows(worktrees, routes) {
	return Promise.all(
		worktrees.map(async (wt) => {
			const recordedFrontend = readPortFile(wt.path, ".dev-frontend-port");
			const recordedBackend = readPortFile(wt.path, ".dev-backend-port");
			const recordedRovo = readRovoPorts(wt.path);

			const [runningFrontend, runningBackend, runningRovoPorts] = await Promise.all([
				probeOrNull(recordedFrontend),
				probeOrNull(recordedBackend),
				Promise.all(recordedRovo.map(probeOrNull)).then((results) =>
					results.filter((value) => value !== null),
				),
			]);

			const runningRovo = runningRovoPorts.length > 0 ? runningRovoPorts.join(", ") : null;
			const hasRecordedPorts = Boolean(
				recordedFrontend || recordedBackend || recordedRovo.length > 0,
			);
			const isRunning = Boolean(runningFrontend || runningBackend || runningRovo);
			return {
				wt,
				name: path.basename(wt.path),
				isMain: Boolean(wt.isMain),
				hasRecordedPorts,
				isRunning,
				runningFrontend,
				runningBackend,
				runningRovo,
				portlessUrl: findPortlessUrl(routes, runningFrontend),
			};
		}),
	);
}

function filterRowsForDisplay(rows) {
	return rows.filter((row) => row.isMain || row.hasRecordedPorts);
}

function renderRows(rows, { headerSuffix, footer, selectedIndex = null } = {}) {
	const header = headerSuffix
		? `📍 VPK Worktree Port Assignments  ${headerSuffix}`
		: "📍 VPK Worktree Port Assignments";
	console.log(`\n${header}\n`);
	console.log(SEPARATOR);

	if (rows.length === 0) {
		console.log("\nNo git worktrees found.");
	}

	for (const [index, row] of rows.entries()) {
		const {
			wt,
			name,
			isMain,
			isRunning,
			runningFrontend,
			runningBackend,
			runningRovo,
			portlessUrl,
		} = row;
		const branchLabel = isMain ? "(main)" : `(${wt.branch || wt.identifier})`;
		const emoji = isMain ? "🌳" : "🪾";

		const selection = selectedIndex === index ? "❯" : " ";
		console.log(`\n${selection} ${emoji} ${name} ${branchLabel}`);
		console.log(`   📂 ${wt.path}`);
		if (isRunning) {
			console.log(
				`   🔌 frontend=${runningFrontend || "—"}  backend=${runningBackend || "—"}  rovo=${runningRovo || "—"}`
			);
		} else {
			console.log("   🔌 (no active ports)");
		}
		if (portlessUrl) {
			console.log(`   🌐 ${portlessUrl}`);
		}
		console.log(`   🔪 ${killCommand(wt)}`);
	}

	if (footer) {
		console.log(`\n${SEPARATOR}`);
		console.log(footer);
	} else {
		console.log(`\n${SEPARATOR}\n`);
	}
}

async function snapshot() {
	const worktrees = getAllWorktreePortInfo();
	const routes = loadPortlessRoutes();
	const rows = await collectWorktreeRows(worktrees, routes);
	return filterRowsForDisplay(rows);
}

async function main() {
	let rows;
	try {
		rows = await snapshot();
	} catch (error) {
		console.error(`Failed to enumerate worktrees: ${error.message}`);
		process.exit(1);
	}
	renderRows(rows);
}

function reconcileSelectionIndex(rows, selectedPath, previousIndex = 0) {
	if (rows.length === 0) return -1;
	const matchingIndex = rows.findIndex((row) => row.wt.path === selectedPath);
	if (matchingIndex >= 0) return matchingIndex;
	return Math.min(Math.max(previousIndex, 0), rows.length - 1);
}

function moveSelectionIndex(currentIndex, direction, rowCount) {
	if (rowCount <= 0) return -1;
	const normalizedIndex = currentIndex < 0 ? 0 : currentIndex;
	return (normalizedIndex + direction + rowCount) % rowCount;
}

function dashboardRowsSignature(rows) {
	return JSON.stringify(
		rows.map((row) => ({
			path: row.wt.path,
			branch: row.wt.branch,
			identifier: row.wt.identifier,
			name: row.name,
			isMain: row.isMain,
			hasRecordedPorts: row.hasRecordedPorts,
			isRunning: row.isRunning,
			runningFrontend: row.runningFrontend,
			runningBackend: row.runningBackend,
			runningRovo: row.runningRovo,
			portlessUrl: row.portlessUrl,
		})),
	);
}

function browserUrlForRow(row) {
	if (row?.portlessUrl) return row.portlessUrl;
	if (row?.runningFrontend) return `http://localhost:${row.runningFrontend}`;
	return null;
}

function defaultBrowserCommand(url, platform = process.platform) {
	if (platform === "darwin") return { command: "open", args: [url] };
	if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", url] };
	return { command: "xdg-open", args: [url] };
}

function openInDefaultBrowser(url) {
	const { command, args } = defaultBrowserCommand(url);
	const { status, error } = spawnSync(command, args, { stdio: "ignore" });
	if (error) return { ok: false, message: error.message };
	if (status !== 0) return { ok: false, message: `${command} exited with status ${status}` };
	return { ok: true };
}

async function runWatch({ interactive = false } = {}) {
	let lastRows = [];
	let lastError = null;
	let refreshInFlight = false;
	let selectedIndex = -1;
	let selectedPath = null;
	let confirmingKill = false;
	let statusMessage = null;
	let stopped = false;

	try {
		lastRows = await snapshot();
		selectedIndex = reconcileSelectionIndex(lastRows, selectedPath, selectedIndex);
		selectedPath = lastRows[selectedIndex]?.wt.path ?? null;
	} catch (error) {
		lastError = error;
	}

	const worker = new Worker(SNAPSHOT_WORKER_SCRIPT, { eval: true });
	worker.on("message", async (result) => {
		let shouldRender = false;
		if (result.ok) {
			try {
				const routes = loadPortlessRoutes();
				const rows = await collectWorktreeRows(result.data, routes);
				const nextRows = filterRowsForDisplay(rows);
				shouldRender = dashboardRowsSignature(nextRows) !== dashboardRowsSignature(lastRows);
				lastRows = nextRows;
				selectedIndex = reconcileSelectionIndex(lastRows, selectedPath, selectedIndex);
				selectedPath = lastRows[selectedIndex]?.wt.path ?? null;
				shouldRender ||= lastError !== null;
				lastError = null;
			} catch (error) {
				shouldRender = lastError?.message !== error.message;
				lastError = error;
			}
		} else {
			shouldRender = lastError?.message !== result.message;
			lastError = new Error(result.message);
		}
		refreshInFlight = false;
		if (shouldRender) render();
	});
	worker.on("error", (error) => {
		refreshInFlight = false;
		const shouldRender = lastError?.message !== error.message;
		lastError = error;
		if (shouldRender) render();
	});

	function requestRefresh() {
		if (refreshInFlight) return;
		refreshInFlight = true;
		worker.postMessage("refresh");
	}

	function render() {
		process.stdout.write("\x1b[2J\x1b[H");
		if (lastError) {
			console.error(`Failed to enumerate worktrees: ${lastError.message}`);
		} else {
			const visibleRowCount = interactive
				? Math.max(1, Math.floor(((process.stdout.rows || 30) - 8) / 5))
				: lastRows.length;
			const maxStartIndex = Math.max(0, lastRows.length - visibleRowCount);
			const startIndex = interactive
				? Math.min(
						Math.max(0, selectedIndex - Math.floor(visibleRowCount / 2)),
						maxStartIndex,
					)
				: 0;
			const visibleRows = lastRows.slice(startIndex, startIndex + visibleRowCount);
			renderRows(visibleRows, {
				headerSuffix: "· watching",
				selectedIndex: interactive ? selectedIndex - startIndex : null,
				footer: interactive
					? confirmingKill
						? `Kill ${describeWorktree(lastRows[selectedIndex].wt)}?  y/N`
						: `${statusMessage ? `${statusMessage}\n` : ""}↑/↓ select · Enter Open · k Kill · q Quit`
					: "Ctrl+C to exit",
			});
		}
	}

	function cleanup(exitCode = 0) {
		if (stopped) return;
		stopped = true;
		clearInterval(pollInterval);
		worker.terminate();
		if (interactive) {
			process.stdin.removeListener("keypress", handleKeypress);
			if (process.stdin.isTTY) process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdout.write("\x1b[?25h\n");
		}
		process.exit(exitCode);
	}

	function handleKeypress(_input, key = {}) {
		if (key.ctrl && key.name === "c") {
			cleanup();
			return;
		}

		if (confirmingKill) {
			if (key.name === "y") {
				const selected = lastRows[selectedIndex];
				confirmingKill = false;
				if (!selected) return;
				if (process.stdin.isTTY) process.stdin.setRawMode(false);
				process.stdout.write("\x1b[2J\x1b[H\x1b[?25h");
				const status = stopWorktree(selected.wt);
				if (process.stdin.isTTY) process.stdin.setRawMode(true);
				process.stdout.write("\x1b[?25l");
				statusMessage = status === 0 ? `✓ Killed ${selected.name}` : `Could not kill ${selected.name} (exit ${status})`;
				requestRefresh();
				render();
				return;
			}
			confirmingKill = false;
			render();
			return;
		}

		if (key.name === "q") {
			cleanup();
		} else if (key.name === "up") {
			selectedIndex = moveSelectionIndex(selectedIndex, -1, lastRows.length);
			selectedPath = lastRows[selectedIndex]?.wt.path ?? null;
			statusMessage = null;
			render();
		} else if (key.name === "down") {
			selectedIndex = moveSelectionIndex(selectedIndex, 1, lastRows.length);
			selectedPath = lastRows[selectedIndex]?.wt.path ?? null;
			statusMessage = null;
			render();
		} else if (key.name === "return" && selectedIndex >= 0) {
			const selected = lastRows[selectedIndex];
			const url = browserUrlForRow(selected);
			if (!url) {
				statusMessage = `No active browser URL for ${selected.name}`;
				render();
				return;
			}
			const result = openInDefaultBrowser(url);
			statusMessage = result.ok ? `✓ Opened ${url}` : `Could not open ${url}: ${result.message}`;
			render();
		} else if (key.name === "k" && selectedIndex >= 0) {
			confirmingKill = true;
			statusMessage = null;
			render();
		}
	}

	render();
	const pollInterval = setInterval(requestRefresh, WATCH_INTERVAL_MS);

	if (interactive) {
		readline.emitKeypressEvents(process.stdin);
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.on("keypress", handleKeypress);
		process.stdout.write("\x1b[?25l");
	}

	process.on("SIGINT", () => {
		cleanup();
	});
}

function describeWorktree(worktree) {
	const name = path.basename(worktree.path);
	const branch = worktree.isMain ? "main" : worktree.branch || worktree.identifier;
	return `${name} (${branch})  →  ${sessionNameForWorktree(worktree)}`;
}

function printKillCandidates(worktrees) {
	for (const worktree of worktrees) {
		console.error(`   • ${describeWorktree(worktree)}`);
		console.error(`     📂 ${worktree.path}`);
	}
}

function standaloneTmuxBinary() {
	for (const candidate of [
		process.env.VPK_TMUX_BIN,
		"/opt/homebrew/bin/tmux",
		"/usr/local/bin/tmux",
		"/usr/bin/tmux",
	]) {
		if (!candidate || candidate.includes(".cmuxterm")) continue;
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

// Older launchers can name a session from a Cursor worktree hash rather than
// today's branch/display name. Match the live session by its exact worktree
// path so the target stop script sends SIGINT to the right Portless owner.
function runningSessionForWorktree(worktree) {
	const matches = [];
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
			if (name.startsWith("vpk-dev-") && sessionPath && sameWorktreePath(sessionPath, worktree.path)) {
				matches.push({ name, socket });
			}
		}
	}

	if (matches.length === 1) return matches[0];
	if (matches.length > 1) {
		throw new Error(
			`Multiple dev sessions belong to ${worktree.path}: ${matches.map((session) => session.name).join(", ")}. Inspect them before stopping this worktree.`,
		);
	}
	return null;
}

// Stop one worktree's dev session. Delegate to the target worktree's OWN
// launcher so its cwd-scoped cleanup (SIGINT so portless removes its route,
// kill-session, listener backstop, port-file removal) runs against the right
// worktree. Never a raw kill-session here — that would leave a stale portless
// route behind.
function stopWorktree(worktree) {
	const scriptPath = path.join(worktree.path, "scripts", "dev-tmux-plain.sh");
	console.log(`🔪 Stopping ${describeWorktree(worktree)}\n`);
	let runningSession;
	try {
		runningSession = runningSessionForWorktree(worktree);
	} catch (error) {
		console.error(error.message);
		return 2;
	}
	if (runningSession?.socket === "default") {
		console.error(`The live session is on tmux's default socket. Use the vpk-system-clean sweep for this legacy stack.`);
		return 2;
	}
	const { status, error } = spawnSync("bash", [scriptPath, "stop"], {
		cwd: worktree.path,
		env: runningSession
			? {
					...process.env,
					VPK_DEV_TMUX_SESSION: runningSession.name,
					VPK_TMUX_SOCKET: runningSession.socket,
				}
			: process.env,
		stdio: "inherit",
	});
	if (error) {
		console.error(`Failed to run ${scriptPath}: ${error.message}`);
		return 1;
	}
	return status ?? 0;
}

function runKill(query) {
	let worktrees;
	try {
		worktrees = getAllWorktreePortInfo();
	} catch (error) {
		console.error(`Failed to enumerate worktrees: ${error.message}`);
		process.exit(1);
	}

	// No identifier: kill the worktree you're currently in.
	if (!query) {
		const current = findCurrentWorktree(process.cwd(), worktrees);
		if (!current) {
			console.error(
				`Not inside a known worktree (cwd: ${process.cwd()}).\n` +
					"Run this from within a worktree, or pass an identifier:\n",
			);
			printKillCandidates(worktrees);
			process.exit(1);
		}
		process.exit(stopWorktree(current));
		return;
	}

	const result = matchWorktree(query, worktrees);
	if (!result.ok) {
		if (result.reason === "ambiguous") {
			console.error(`"${query}" matches multiple worktrees — be more specific:\n`);
			printKillCandidates(result.candidates);
		} else {
			console.error(`No worktree matches "${query}". Available worktrees:\n`);
			printKillCandidates(worktrees);
		}
		process.exit(result.reason === "ambiguous" ? 2 : 1);
	}

	process.exit(stopWorktree(result.worktree));
}

if (require.main === module) {
	const subcommand = process.argv[2];
	if (subcommand === "watch") {
		runWatch({ interactive: process.stdin.isTTY && process.stdout.isTTY }).catch((error) => {
			console.error(error.message);
			process.exit(1);
		});
	} else if (subcommand === "kill") {
		runKill(process.argv[3]);
	} else if (subcommand && subcommand !== "once") {
		console.error(
			`Unknown subcommand: ${subcommand}. Use \`pnpm ports\`, \`pnpm ports once\`, \`pnpm ports watch\`, or \`pnpm ports kill [identifier]\`.`
		);
		process.exit(2);
	} else {
		main().catch((error) => {
			console.error(error.message);
			process.exit(1);
		});
	}
}

module.exports = {
	browserUrlForRow,
	dashboardRowsSignature,
	defaultBrowserCommand,
	reconcileSelectionIndex,
	moveSelectionIndex,
};
