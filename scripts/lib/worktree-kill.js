"use strict";

/**
 * Resolve a free-form identifier (worktree name, branch, identifier, path, or
 * tmux session name) to a single worktree so `pnpm ports kill <identifier>` can
 * stop that worktree's dev session from anywhere — no `cd` into the worktree.
 *
 * Pure logic only: no git, no tmux, no spawning. The caller (show-worktree-ports)
 * feeds in the worktree list from getAllWorktreePortInfo() and delegates the
 * actual stop to that worktree's own scripts/dev-tmux-plain.sh (which owns the
 * careful SIGINT -> kill-session -> route/listener/port-file cleanup sequence).
 */

const path = require("node:path");
const { DEFAULT_SESSION_PREFIX, sanitizeToken, sessionNameForWorktreeName } = require("./dev-tmux-session");

// The worktree part of the session name: "main" for the main checkout, otherwise the sanitized
// worktree *display name* (getWorktreeDisplayName), the same name the launchers derive in-cwd
// through scripts/lib/dev-tmux-session.js. Not the raw `identifier`: for a detached worktree
// whose dir basename collides with the repo name, the display name walks up to the parent hash
// dir (e.g. `0ebd`), while `identifier` stays the repository-directory basename.
function worktreeDisplayName(worktree) {
	return worktree && typeof worktree.worktreeName === "string" && worktree.worktreeName.length > 0
		? worktree.worktreeName
		: "main";
}

function sessionTokenForWorktree(worktree) {
	return sanitizeToken(worktreeDisplayName(worktree), "main");
}

function sessionNameForWorktree(worktree, { prefix = DEFAULT_SESSION_PREFIX } = {}) {
	return sessionNameForWorktreeName(worktreeDisplayName(worktree), { prefix });
}

// Every string a user might reasonably type to name this worktree, lowercased.
function handlesForWorktree(worktree) {
	const handles = new Set();
	const add = (value) => {
		if (typeof value === "string" && value.trim().length > 0) {
			handles.add(value.trim().toLowerCase());
		}
	};

	add(path.basename(worktree.path));
	add(worktree.branch);
	add(worktree.identifier);
	add(worktree.worktreeName);
	add(worktree.isMain ? "main" : null);
	add(sessionTokenForWorktree(worktree));
	add(sessionNameForWorktree(worktree));
	add(worktree.path);

	return handles;
}

/**
 * Match `query` against `worktrees`. Exact (case-insensitive) matches win over
 * substring matches; a query that resolves to more than one worktree is
 * reported as ambiguous rather than guessed.
 *
 * @returns {{ok: true, worktree: object}
 *   | {ok: false, reason: "empty" | "not-found"}
 *   | {ok: false, reason: "ambiguous", candidates: object[]}}
 */
function matchWorktree(query, worktrees) {
	const normalized = String(query ?? "").trim().toLowerCase();
	if (normalized.length === 0) {
		return { ok: false, reason: "empty" };
	}

	const entries = worktrees.map((worktree) => ({
		worktree,
		handles: handlesForWorktree(worktree),
	}));

	const exact = entries.filter((entry) => entry.handles.has(normalized));
	if (exact.length === 1) {
		return { ok: true, worktree: exact[0].worktree };
	}
	if (exact.length > 1) {
		return { ok: false, reason: "ambiguous", candidates: exact.map((entry) => entry.worktree) };
	}

	const partial = entries.filter((entry) =>
		[...entry.handles].some((handle) => handle.includes(normalized)),
	);
	if (partial.length === 1) {
		return { ok: true, worktree: partial[0].worktree };
	}
	if (partial.length > 1) {
		return { ok: false, reason: "ambiguous", candidates: partial.map((entry) => entry.worktree) };
	}

	return { ok: false, reason: "not-found" };
}

/**
 * Identify which worktree the given directory sits inside, so
 * `pnpm ports kill` with no argument can default to "the one you're in".
 *
 * A worktree matches when `dir` equals its path or is nested under it. When
 * several match (nested worktree layouts — e.g. a `.claude/worktrees/...` dir
 * living under the main checkout), the deepest (longest) path wins, since that
 * is the most specific enclosing worktree.
 *
 * Pure: no fs, no git. `dir` is normalized by the caller (typically
 * process.cwd()).
 *
 * @returns {object | null} the enclosing worktree, or null when `dir` is not
 *   inside any known worktree.
 */
function findCurrentWorktree(dir, worktrees) {
	const normalizedDir = String(dir ?? "").trim();
	if (normalizedDir.length === 0 || !Array.isArray(worktrees)) {
		return null;
	}

	let best = null;
	let bestLength = -1;
	for (const worktree of worktrees) {
		const wtPath = typeof worktree.path === "string" ? worktree.path : "";
		if (wtPath.length === 0) {
			continue;
		}
		const isInside =
			normalizedDir === wtPath ||
			normalizedDir.startsWith(wtPath.endsWith(path.sep) ? wtPath : `${wtPath}${path.sep}`);
		if (isInside && wtPath.length > bestLength) {
			best = worktree;
			bestLength = wtPath.length;
		}
	}
	return best;
}

module.exports = {
	DEFAULT_SESSION_PREFIX,
	sessionTokenForWorktree,
	sessionNameForWorktree,
	handlesForWorktree,
	matchWorktree,
	findCurrentWorktree,
};
