/**
 * Shared helpers for reading the portless route table (~/.portless/routes.json)
 * and resolving a worktree's stable `.localhost` URL from a frontend port.
 *
 * Single source of truth so the `pnpm ports` CLI and the dev:tmux launcher don't
 * each hand-roll (and drift on) the same lookup.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/**
 * Load the portless route records. Returns [] on any error (file missing,
 * malformed JSON, portless not in use).
 */
function loadPortlessRoutes(home = os.homedir()) {
	try {
		const file = path.join(home, ".portless", "routes.json");
		if (!fs.existsSync(file)) return [];
		const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/**
 * Is the owning portless CLI process still alive? portless leaves dead-owner
 * and `pid: 0` (alias) routes in the table, so a port can be shared between a
 * live route and a stale one after the port is reused.
 */
function isOwnerAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM means the process exists but we can't signal it — still alive.
		return error && error.code === "EPERM";
	}
}

/**
 * Resolve the `https://<hostname>` URL for the route serving `frontendPort`.
 *
 * When more than one route record points at the same port (a reused port with a
 * lingering stale/dead route still in the table), prefer the one whose owning
 * CLI is alive so we never hand back a dead `.localhost` host. Returns null when
 * no route matches or the port is missing/invalid.
 *
 * @param {Array<{hostname?: string, port?: number, pid?: number}>} routes
 * @param {number|string|null|undefined} frontendPort
 * @returns {string|null}
 */
function findPortlessUrl(routes, frontendPort) {
	if (!frontendPort) return null;
	const port = Number(frontendPort);
	if (!Number.isFinite(port)) return null;
	if (!Array.isArray(routes)) return null;

	const matches = routes.filter((route) => route && route.port === port);
	if (matches.length === 0) return null;

	const chosen = matches.find((route) => isOwnerAlive(route.pid)) ?? matches[0];
	return chosen && chosen.hostname ? `https://${chosen.hostname}` : null;
}

module.exports = { loadPortlessRoutes, findPortlessUrl, isOwnerAlive };
