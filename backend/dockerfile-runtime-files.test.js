"use strict";

// The runtime image copies only some of the repository (backend/Dockerfile). A backend
// module that requires a file the image does not copy starts fine in a checkout and
// crashes the container with MODULE_NOT_FOUND. This walks every relative require and
// import reachable from backend/ and checks the image ships each file at the same path.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..");
const DOCKERFILE = path.join(REPO_ROOT, "backend", "Dockerfile");
const SKIPPED_DIRS = new Set(["node_modules", "__fixtures__", "data", "public"]);
const MODULE_EXTENSIONS = [".js", ".cjs", ".mjs", ".json"];
const RELATIVE_SPECIFIER = /(?:require\s*\(\s*|import\s*\(\s*|from\s+)["'](\.{1,2}\/[^"']+)["']/gu;

const toPosix = (value) => value.split(path.sep).join("/");
const normalizeRepoPath = (value) => path.posix.normalize(value.replace(/^\.\//u, "")).replace(/\/$/u, "");

/**
 * The repository paths the image places at the same path under its WORKDIR, read from
 * the Dockerfile's COPY instructions (multi-stage `--from` copies are not the checkout).
 * @param {string} dockerfile
 * @returns {string[]}
 */
function parseMirroredCopies(dockerfile) {
	const mirrored = [];
	for (const line of dockerfile.split("\n")) {
		const match = /^COPY\s+(.+)$/u.exec(line.trim());
		if (!match || /--from=/u.test(match[1])) continue;
		const parts = match[1].split(/\s+/u).filter((part) => !part.startsWith("--"));
		const destination = normalizeRepoPath(parts.pop());
		for (const source of parts.map(normalizeRepoPath)) {
			// One source copied onto a path keeps that path; several land inside the destination.
			const landsAt = parts.length === 1 && destination !== "."
				? destination
				: path.posix.join(destination, path.posix.basename(source));
			if (landsAt === source) mirrored.push(source);
		}
	}
	return mirrored;
}

function isShipped(repoPath, mirrored) {
	return mirrored.some((copied) => repoPath === copied || repoPath.startsWith(`${copied}/`));
}

function listBackendModules(dir) {
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIPPED_DIRS.has(entry.name)) files.push(...listBackendModules(fullPath));
		} else if (/\.(?:c|m)?js$/u.test(entry.name) && !/\.test\.(?:c|m)?js$/u.test(entry.name)) {
			files.push(fullPath);
		}
	}
	return files;
}

function resolveRelative(fromFile, specifier) {
	const base = path.resolve(path.dirname(fromFile), specifier);
	const candidates = [base, ...MODULE_EXTENSIONS.map((ext) => `${base}${ext}`), ...MODULE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`))];
	return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

/**
 * Every relative module reachable from the backend's own files whose path the image
 * does not ship, as "<requiring file> -> <missing file>".
 * @param {string[]} mirrored
 */
function findUnshippedRequires(mirrored) {
	const missing = [];
	const seen = new Set();
	const queue = listBackendModules(path.join(REPO_ROOT, "backend"));
	while (queue.length > 0) {
		const file = queue.shift();
		if (seen.has(file)) continue;
		seen.add(file);
		if (file.endsWith(".json")) continue;
		const source = fs.readFileSync(file, "utf8");
		for (const [, specifier] of source.matchAll(RELATIVE_SPECIFIER)) {
			const resolved = resolveRelative(file, specifier);
			if (!resolved) continue;
			const repoPath = toPosix(path.relative(REPO_ROOT, resolved));
			if (repoPath.startsWith("..")) continue;
			if (!isShipped(repoPath, mirrored)) {
				missing.push(`${toPosix(path.relative(REPO_ROOT, file))} -> ${repoPath}`);
				continue;
			}
			queue.push(resolved);
		}
	}
	return [...new Set(missing)].sort();
}

test("parseMirroredCopies keeps only copies that land at their repository path", () => {
	assert.deepEqual(
		parseMirroredCopies([
			"COPY package.json pnpm-lock.yaml ./",
			"COPY backend/package.json ./backend/package.json",
			"COPY backend ./backend",
			"COPY scripts/lib/a.js ./scripts/lib/a.js",
			"COPY out ./backend/public",
			"COPY --from=build /app/x ./x",
		].join("\n")),
		["package.json", "pnpm-lock.yaml", "backend/package.json", "backend", "scripts/lib/a.js"],
	);
});

test("the runtime image ships every file the backend requires", () => {
	const mirrored = parseMirroredCopies(fs.readFileSync(DOCKERFILE, "utf8"));
	assert.ok(isShipped("backend/server.js", mirrored), "backend/Dockerfile must copy backend/");
	assert.deepEqual(
		findUnshippedRequires(mirrored),
		[],
		"backend/Dockerfile must COPY these files, or the container fails to start with MODULE_NOT_FOUND",
	);
});
