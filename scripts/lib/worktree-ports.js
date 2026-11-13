/**
 * Worktree-aware port reservation system
 *
 * Each git worktree gets a deterministic, non-overlapping port range.
 * This prevents port conflicts when running multiple worktrees simultaneously.
 *
 * Port allocation strategy:
 * - Main worktree: slot 0
 * - Other active worktrees: unique slots 1..99 (sorted by identifier)
 * - Offset = slot * SLOT_STRIDE
 * - Frontend: 3000 + offset
 * - Backend:  8080 + offset
 * - Rovo:     8000 + offset
 *
 * Each worktree reserves a full 20-port window so port auto-increment
 * and multi-port Rovo pools do not overlap across worktrees.
 */

const { execSync } = require("node:child_process");
const path = require("node:path");

const FRONTEND_DEFAULT_BASE = 3000;
const BACKEND_DEFAULT_BASE = 8080;
const ROVO_DEFAULT_BASE = 8000;
const SLOT_STRIDE = 20;
const WORKTREE_SLOT_CAPACITY = 100;
const PORT_TARGETS = {
	frontend: {
		defaultBase: FRONTEND_DEFAULT_BASE,
		envVar: "PORT",
		label: "Frontend",
	},
	backend: {
		defaultBase: BACKEND_DEFAULT_BASE,
		envVar: "BACKEND_PORT",
		label: "Backend",
	},
	rovo: {
		defaultBase: ROVO_DEFAULT_BASE,
		envVar: "ROVO_PORT",
		label: "Rovo",
	},
};

/**
 * Simple string hash function (djb2)
 * Returns a positive integer
 */
function hashString(str) {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return Math.abs(hash);
}

function execGit(command, { cwd = process.cwd() } = {}) {
	return execSync(command, {
		cwd,
		encoding: "utf8",
		stdio: ["pipe", "pipe", "pipe"],
	}).trim();
}

function resolveWorktreeIdentifier(worktree) {
	if (typeof worktree.branch === "string" && worktree.branch.length > 0) {
		return worktree.branch;
	}
	return path.basename(worktree.path);
}

function getGitWorktrees({ cwd = process.cwd() } = {}) {
	try {
		const output = execGit("git worktree list --porcelain", { cwd });
		const worktrees = [];
		let current = null;
		let entryCount = 0;

		for (const rawLine of output.split("\n")) {
			const line = rawLine.trimEnd();
			if (line.startsWith("worktree ")) {
				if (current && current.path && !current.bare) {
					worktrees.push(current);
				}
				// git lists the main worktree first, so its position identifies it
				// without one `git rev-parse` per worktree (76 of them took ~3 s).
				current = {
					path: path.resolve(line.slice(9)),
					branch: null,
					bare: false,
					isMain: entryCount === 0,
				};
				entryCount += 1;
				continue;
			}

			if (!current) {
				continue;
			}

			if (line.startsWith("branch ")) {
				current.branch = line.slice(7).replace("refs/heads/", "");
				continue;
			}

			if (line === "bare") {
				current.bare = true;
			}
		}

		if (current && current.path && !current.bare) {
			worktrees.push(current);
		}

		return worktrees.map((worktree) => ({
			...worktree,
			identifier: resolveWorktreeIdentifier(worktree),
		}));
	} catch {
		return [];
	}
}

function getCurrentWorktreePath({ cwd = process.cwd() } = {}) {
	try {
		return path.resolve(execGit("git rev-parse --show-toplevel", { cwd }));
	} catch {
		return null;
	}
}

function buildWorktreeSlotTable(worktrees) {
	const mainWorktree = worktrees.find((worktree) => worktree.isMain) ?? null;
	const nonMainWorktrees = worktrees
		.filter((worktree) => !worktree.isMain)
		.sort((a, b) => {
			const identifierCompare = a.identifier.localeCompare(b.identifier);
			if (identifierCompare !== 0) {
				return identifierCompare;
			}
			return a.path.localeCompare(b.path);
		});

	const ordered = mainWorktree
		? [mainWorktree, ...nonMainWorktrees]
		: [...nonMainWorktrees];

	if (ordered.length > WORKTREE_SLOT_CAPACITY) {
		throw new Error(
			`Active git worktrees (${ordered.length}) exceed slot capacity (${WORKTREE_SLOT_CAPACITY}).`
		);
	}

	const slots = new Map();
	for (let index = 0; index < ordered.length; index += 1) {
		slots.set(ordered[index].path, index);
	}

	return { ordered, slots };
}

function findWorktreeByPath(worktrees, worktreePath) {
	return worktrees.find((worktree) => worktree.path === worktreePath) ?? null;
}

function getRepoDirName(worktrees) {
	const mainWorktree = worktrees.find((candidate) => candidate.isMain) ?? null;
	return mainWorktree ? path.basename(mainWorktree.path) : null;
}

function resolveDetachedWorktreeName(worktree, repoDirName = null) {
	if (!worktree || typeof worktree.path !== "string" || worktree.path.length === 0) {
		return null;
	}

	let name = path.basename(worktree.path);
	if (repoDirName && name === repoDirName) {
		const parent = path.basename(path.dirname(worktree.path));
		if (parent && parent !== name) {
			name = parent;
		}
	}

	return name;
}

function getWorktreeDisplayName(worktree, repoDirName = null) {
	if (!worktree || worktree.isMain) {
		return "main";
	}

	if (typeof worktree.branch === "string" && worktree.branch.length > 0) {
		return worktree.identifier;
	}

	return resolveDetachedWorktreeName(worktree, repoDirName) ?? worktree.identifier;
}

function getWorktreeSlotDetails(worktreePath) {
	const normalizedPath = path.resolve(worktreePath);
	const worktrees = getGitWorktrees();
	const { slots } = buildWorktreeSlotTable(worktrees);
	const slot = slots.get(normalizedPath) ?? 0;

	return {
		worktree: findWorktreeByPath(worktrees, normalizedPath),
		repoDirName: getRepoDirName(worktrees),
		slot,
		offset: getOffsetFromSlot(slot),
	};
}

function getOffsetFromSlot(slot) {
	return slot * SLOT_STRIDE;
}

function getWorktreePortOffsetForPath(worktreePath) {
	return getWorktreeSlotDetails(worktreePath).offset;
}

function buildPortInfo(worktreeName, offset, slot) {
	return {
		worktreeName,
		offset,
		slot,
		frontendBase: FRONTEND_DEFAULT_BASE + offset,
		backendBase: BACKEND_DEFAULT_BASE + offset,
		rovoBase: ROVO_DEFAULT_BASE + offset,
	};
}

/**
 * Get the current worktree name
 * Returns null if not in a worktree or if it's the main worktree
 */
function getWorktreeName() {
	const currentWorktreePath = getCurrentWorktreePath();
	if (!currentWorktreePath) {
		return null;
	}

	const worktrees = getGitWorktrees();
	const worktree = findWorktreeByPath(worktrees, currentWorktreePath);

	if (!worktree || worktree.isMain) {
		return null;
	}

	return getWorktreeDisplayName(worktree, getRepoDirName(worktrees));
}

/**
 * Normalize a string into a DNS-label-safe portless name (lowercase, only
 * [a-z0-9-], no leading/trailing or doubled dashes).
 */
function sanitizePortlessName(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

/**
 * Build the extra args for `portless run` from a worktree record.
 *
 * Vanilla `portless run` already derives the right URL on its own for the main
 * checkout (default branch -> <package-name>.localhost) and for branched
 * worktrees (branch prepended as a subdomain). Only a
 * detached worktree has no branch for portless to key on, so we supply an
 * explicit --name (-> <name>.localhost).
 *
 * Naming the detached worktree is subtle: the directory basename is the unique
 * token for layouts like `.claude/worktrees/<feature>`, but managed providers
 * nest the checkout as `.../<hash>/<repo-dir>` (e.g. Codex
 * `.codex/worktrees/972c/<repo-dir>`), where the basename is just the repo dir
 * name and the unique token lives in the PARENT dir. Using the basename there
 * would emit `--name <repo-dir>` for every such worktree, colliding with each
 * other and with the main checkout. So when the basename equals the repo dir
 * name, fall back to the parent dir.
 *
 * @param {{ isMain?: boolean, branch?: string|null, path?: string }|null} worktree
 * @param {string|null} [repoDirName] basename of the main checkout's dir
 * @returns {string[]} [] for main/branch, or ["--name", <name>] when detached
 */
function buildPortlessRunArgs(worktree, repoDirName = null) {
	if (!worktree || worktree.isMain) {
		return [];
	}
	if (typeof worktree.branch === "string" && worktree.branch.length > 0) {
		return [];
	}
	if (typeof worktree.path !== "string" || worktree.path.length === 0) {
		return [];
	}

	const name = resolveDetachedWorktreeName(worktree, repoDirName);
	const sanitized = sanitizePortlessName(name);
	return sanitized ? ["--name", sanitized] : [];
}

/**
 * Resolve the args to pass after `portless run` for the current worktree.
 * Returns [] on main or a branched worktree (vanilla portless handles those);
 * ["--name", <unique-token>] when HEAD is detached.
 */
function getPortlessRunArgs() {
	const currentWorktreePath = getCurrentWorktreePath();
	if (!currentWorktreePath) {
		return [];
	}

	const worktrees = getGitWorktrees();
	const worktree = findWorktreeByPath(worktrees, currentWorktreePath);
	return buildPortlessRunArgs(worktree, getRepoDirName(worktrees));
}

/**
 * Calculate the base port offset for the current worktree
 * Returns 0 for main worktree.
 */
function getWorktreePortOffset() {
	const currentWorktreePath = getCurrentWorktreePath();
	if (!currentWorktreePath) {
		return 0;
	}

	return getWorktreeSlotDetails(currentWorktreePath).offset;
}

function getBasePort(target) {
	const { defaultBase, envVar, label } = PORT_TARGETS[target];
	const envPort = process.env[envVar];
	if (envPort) {
		return Number.parseInt(envPort, 10);
	}

	const currentWorktreePath = getCurrentWorktreePath();
	if (!currentWorktreePath) {
		return defaultBase;
	}

	const { offset, repoDirName, worktree } = getWorktreeSlotDetails(currentWorktreePath);
	const basePort = defaultBase + offset;

	if (worktree && !worktree.isMain && offset > 0) {
		console.log(`[worktree: ${getWorktreeDisplayName(worktree, repoDirName)}] ${label} base port: ${basePort}`);
	}

	return basePort;
}

/**
 * Get the base frontend port for the current worktree
 */
function getFrontendBasePort() {
	return getBasePort("frontend");
}

/**
 * Get the base backend port for the current worktree
 */
function getBackendBasePort() {
	return getBasePort("backend");
}

/**
 * Get the base rovo serve port for the current worktree
 */
function getRovoBasePort() {
	return getBasePort("rovo");
}

/**
 * Get port info for the current worktree (useful for diagnostics)
 */
function getPortInfo() {
	const currentPath = getCurrentWorktreePath();
	if (!currentPath) {
		return buildPortInfo("main", 0, 0);
	}

	return getPortInfoForPath(currentPath);
}

function getPortInfoForPath(worktreePath) {
	const { offset, repoDirName, slot, worktree } = getWorktreeSlotDetails(worktreePath);
	return buildPortInfo(getWorktreeDisplayName(worktree, repoDirName), offset, slot);
}

function getAllWorktreePortInfo() {
	const worktrees = getGitWorktrees();
	const { ordered, slots } = buildWorktreeSlotTable(worktrees);
	const repoDirName = getRepoDirName(worktrees);

	return ordered.map((worktree) => {
		const slot = slots.get(worktree.path) ?? 0;
		const offset = getOffsetFromSlot(slot);
		const info = buildPortInfo(getWorktreeDisplayName(worktree, repoDirName), offset, slot);

		return {
			...info,
			path: worktree.path,
			isMain: worktree.isMain,
			branch: worktree.branch,
			identifier: worktree.identifier,
		};
	});
}

module.exports = {
	hashString,
	getGitWorktrees,
	getWorktreeName,
	buildPortlessRunArgs,
	getPortlessRunArgs,
	getWorktreePortOffset,
	getWorktreePortOffsetForPath,
	getFrontendBasePort,
	getBackendBasePort,
	getRovoBasePort,
	getPortInfo,
	getPortInfoForPath,
	getAllWorktreePortInfo,
};
