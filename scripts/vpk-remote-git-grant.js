#!/usr/bin/env node

// Builds the git write grant for a GPT-lane worker: the value of
// `permissions.vpk-worker.filesystem` that lets `git add` and `git commit` move the task
// branch in a linked worktree, and nothing else.
//
//   node scripts/vpk-remote-git-grant.js --worktree <dir> --branch <name>
//   node scripts/vpk-remote-git-grant.js --no-worktree
//
// --branch is the expected branch from the task record (task.json), never read from the
// worktree, so a worker cannot choose which branch a later run may move.
//
// Stdout is the grant and nothing else: an inline TOML table, or `{}` (no git writes). It
// fails closed: `{}` with the reason on stderr, exit 0, whenever anything is off (not a
// linked worktree, HEAD detached or on another branch, a branch name outside BRANCH_PATTERN,
// a failed git query, a missing ref directory, or a path that cannot be serialised safely).
// --no-worktree always yields `{}`. A usage error prints `{}` too, and exits 2.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const NO_GRANT = "{}";
const GIT_TIMEOUT_MS = 10_000;
// Slash-separated components of letters, digits, `.`, `_` and `-`, each starting with a
// letter or digit; `vpk/<type>-<slug>` passes. Further limits are in isSafeBranch.
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u;
const MAX_BRANCH_LENGTH = 200;
// Characters codex may read as glob syntax in a filesystem entry, and the backslash.
const UNSAFE_PATH_CHARS = /[*?[\]{}\\]/u;
const USAGE = "usage: vpk-remote-git-grant.js --worktree <dir> --branch <name>\n       vpk-remote-git-grant.js --no-worktree";

function parseArgs(argv) {
	if (argv.length === 1 && argv[0] === "--no-worktree") return { noWorktree: true };
	const options = {};
	for (let index = 0; index < argv.length; index += 2) {
		const [flag, value] = [argv[index], argv[index + 1]];
		const key = { "--worktree": "worktree", "--branch": "branch" }[flag];
		if (!key) throw new Error(`unknown option ${flag}`);
		if (value === undefined || value === "" || value.startsWith("--")) throw new Error(`${flag} needs a value`);
		if (key in options) throw new Error(`${flag} given twice`);
		options[key] = value;
	}
	if (!options.worktree || !options.branch) throw new Error("--worktree and --branch are both required, or --no-worktree alone");
	return { worktree: path.resolve(options.worktree), branch: options.branch };
}

function isSafeBranch(branch) {
	if (typeof branch !== "string" || branch.length > MAX_BRANCH_LENGTH || !BRANCH_PATTERN.test(branch)) return false;
	if (branch === "HEAD" || branch.startsWith("refs/") || branch.includes("..")) return false;
	return branch.split("/").every((part) => !part.endsWith(".") && !part.endsWith(".lock"));
}

// An absolute, normalised path with no control characters, lone surrogates, or characters
// codex could read as a pattern.
function isSerialisablePath(value) {
	if (typeof value !== "string" || !path.isAbsolute(value) || path.normalize(value) !== value || value.length > 1 && value.endsWith("/")) return false;
	if (!value.isWellFormed() || /[\u0000-\u001f\u007f]/u.test(value) || UNSAFE_PATH_CHARS.test(value)) return false;
	return true;
}

// A TOML basic string: every `"`, `\` and control character escaped.
function tomlString(value) {
	if (!value.isWellFormed()) throw new Error("not well-formed UTF-16");
	return `"${value.replace(/[\\"\u0000-\u001f\u007f]/gu, (char) => {
		if (char === "\\") return "\\\\";
		if (char === "\"") return "\\\"";
		return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
	})}"`;
}

function serialiseGrant(paths) {
	if (paths.length === 0) return NO_GRANT;
	return `{${paths.map((entry) => `${tomlString(entry)} = "write"`).join(", ")}}`;
}

// What `git add` and `git commit` on the task branch write, found by running them under the
// profile with codex-cli 0.166.0 and git 2.53. HEAD itself stays read-only: a commit takes
// HEAD.lock to log the update but never renames it over HEAD.
function grantPaths({ gitDir, commonDir, branch }) {
	const ref = path.join(commonDir, "refs", "heads", ...branch.split("/"));
	return [
		path.join(gitDir, "index"),
		path.join(gitDir, "index.lock"),
		path.join(gitDir, "HEAD.lock"),
		path.join(gitDir, "AUTO_MERGE.lock"),
		path.join(gitDir, "COMMIT_EDITMSG"),
		path.join(gitDir, "logs", "HEAD"),
		path.join(commonDir, "objects"),
		ref,
		`${ref}.lock`,
		path.join(commonDir, "logs", "refs", "heads", ...branch.split("/")),
		path.join(commonDir, "packed-refs.lock"),
	];
}

// Paths a grant must never name, whatever the inputs.
function forbiddenPaths(commonDir) {
	return new Set([
		commonDir,
		path.join(commonDir, "config"),
		path.join(commonDir, "hooks"),
		path.join(commonDir, "logs"),
		path.join(commonDir, "logs", "refs"),
		path.join(commonDir, "logs", "refs", "heads"),
		path.join(commonDir, "refs"),
		path.join(commonDir, "refs", "heads"),
		path.join(commonDir, "worktrees"),
	]);
}

function runGit(cwd, args) {
	// GIT_DIR, GIT_WORK_TREE and friends would point the queries elsewhere.
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env, timeout: GIT_TIMEOUT_MS });
	return { status: result.error ? null : result.status, stdout: result.stdout ?? "", stderr: (result.stderr ?? "").trim() || result.error?.message || "" };
}

const realpath = (value) => fs.realpathSync.native(value);
const none = (reason) => ({ grant: NO_GRANT, reason });

// Returns { grant, reason } where reason is null only for a real grant.
function buildGrant({ worktree, branch, noWorktree }, { git = runGit } = {}) {
	if (noWorktree) return none("--no-worktree: the checkout's own .git stays protected");
	if (!isSafeBranch(branch)) return none(`branch ${JSON.stringify(branch)} is outside the allowed character set`);
	let top;
	try {
		top = realpath(worktree);
	} catch {
		return none(`${worktree} does not exist`);
	}
	const revParse = git(top, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"]);
	if (revParse.status !== 0) return none(`git rev-parse failed in ${top}: ${revParse.stderr}`);
	const lines = revParse.stdout.split("\n").filter(Boolean);
	if (lines.length !== 3) return none(`git rev-parse printed ${lines.length} lines, expected 3`);
	let toplevel;
	let gitDir;
	let commonDir;
	try {
		[toplevel, gitDir, commonDir] = lines.map(realpath);
	} catch (error) {
		return none(`cannot resolve git paths: ${error.message}`);
	}
	if (toplevel !== top) return none(`${top} is not the top of its worktree (${toplevel})`);
	if (gitDir === commonDir) return none(`${top} is not a linked worktree`);
	if (path.dirname(gitDir) !== path.join(commonDir, "worktrees")) return none(`${gitDir} is not under ${path.join(commonDir, "worktrees")}`);
	const head = git(top, ["symbolic-ref", "-q", "HEAD"]);
	if (head.status === 1) return none("HEAD is detached");
	if (head.status !== 0) return none(`git symbolic-ref failed: ${head.stderr}`);
	const ref = head.stdout.trim();
	if (ref !== `refs/heads/${branch}`) return none(`HEAD is on ${ref}, expected refs/heads/${branch}`);
	const paths = grantPaths({ gitDir, commonDir, branch });
	// The grant opens files, not directories: git cannot create a missing ref or log
	// directory under it, so a commit would fail halfway.
	const branchParts = branch.split("/").slice(0, -1);
	for (const directory of [path.join(gitDir, "logs"), path.join(commonDir, "refs", "heads", ...branchParts), path.join(commonDir, "logs", "refs", "heads", ...branchParts)]) {
		if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return none(`${directory} does not exist`);
	}
	const unsafe = paths.find((entry) => !isSerialisablePath(entry));
	if (unsafe !== undefined) return none(`cannot serialise ${JSON.stringify(unsafe)} safely`);
	const forbidden = forbiddenPaths(commonDir);
	const clash = paths.find((entry) => forbidden.has(entry) || entry === gitDir);
	if (clash !== undefined) return none(`refusing to grant ${clash}`);
	return { grant: serialiseGrant(paths), reason: null, paths };
}

if (require.main === module) {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
	} catch (error) {
		process.stdout.write(`${NO_GRANT}\n`);
		console.error(`vpk-remote-git-grant: no git writes: ${error.message}\n${USAGE}`);
		process.exit(2);
	}
	let result;
	try {
		result = buildGrant(options);
	} catch (error) {
		result = none(`unexpected error: ${error.message}`);
	}
	process.stdout.write(`${result.grant}\n`);
	console.error(result.reason === null ? `vpk-remote-git-grant: commits to refs/heads/${options.branch} in ${options.worktree}` : `vpk-remote-git-grant: no git writes: ${result.reason}`);
}

module.exports = { NO_GRANT, buildGrant, forbiddenPaths, isSafeBranch, isSerialisablePath, parseArgs, serialiseGrant, tomlString };
