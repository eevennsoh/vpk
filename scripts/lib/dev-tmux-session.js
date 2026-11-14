"use strict";

// The one place a dev stack's tmux session name is derived: `vpk-dev-<worktree>`, where
// <worktree> is the sanitized worktree display name ("main" in the main checkout). Both
// launchers (`dev:tmux:*` in scripts/dev-tmux-plain.sh and `rovo:tmux:*` in scripts/dev-tmux.sh),
// `pnpm ports` and the html-selector route read it from here.
//
//   node scripts/lib/dev-tmux-session.js [plain|rovo]   prints the name for the cwd's worktree

const { getWorktreeName } = require("./worktree-ports");

const DEFAULT_SESSION_PREFIX = "vpk-dev";

// Each launcher keeps its own override variables.
const SESSION_ENV = {
	plain: { name: "VPK_DEV_TMUX_SESSION", prefix: "VPK_DEV_TMUX_SESSION_PREFIX" },
	rovo: { name: "ROVO_TMUX_SESSION", prefix: "ROVO_TMUX_SESSION_PREFIX" },
};

function sanitizeToken(value, fallback) {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");

	return normalized.length > 0 ? normalized : fallback;
}

// The name for a worktree known by its display name (null or empty for the main checkout).
function sessionNameForWorktreeName(worktreeName, { prefix = DEFAULT_SESSION_PREFIX } = {}) {
	return `${sanitizeToken(prefix, DEFAULT_SESSION_PREFIX)}-${sanitizeToken(worktreeName || "main", "main")}`;
}

function resolveDevTmuxSessionName({
	env = process.env,
	getWorktreeNameImpl = getWorktreeName,
	stack = "rovo",
} = {}) {
	const variables = SESSION_ENV[stack];
	if (!variables) {
		throw new Error(`Unknown dev stack: ${stack}. Expected one of ${Object.keys(SESSION_ENV).join(", ")}.`);
	}
	const explicitName = env[variables.name];
	if (typeof explicitName === "string" && explicitName.trim().length > 0) {
		return explicitName.trim();
	}

	return sessionNameForWorktreeName(getWorktreeNameImpl(), {
		prefix: env[variables.prefix] || DEFAULT_SESSION_PREFIX,
	});
}

module.exports = {
	DEFAULT_SESSION_PREFIX,
	SESSION_ENV,
	resolveDevTmuxSessionName,
	sanitizeToken,
	sessionNameForWorktreeName,
};

if (require.main === module) {
	try {
		process.stdout.write(resolveDevTmuxSessionName({ stack: process.argv[2] || "rovo" }));
	} catch (error) {
		console.error(error.message);
		process.exit(2);
	}
}
