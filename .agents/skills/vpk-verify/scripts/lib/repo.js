"use strict";

// Worktree-relative paths and file readers shared by every control-vpk subcommand.

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../../../../");
const FRONTEND_PORT_FILE = path.join(REPO_ROOT, ".dev-frontend-port");
const BACKEND_PORT_FILE = path.join(REPO_ROOT, ".dev-backend-port");
const RUN_DIR = path.join(REPO_ROOT, "output/vpk-verify/.run");
const STATE_FILE = path.join(RUN_DIR, "state.json");
const EVIDENCE_DIR = path.join(REPO_ROOT, "output/agent-browser/vpk-verify");

function readText(file) {
	try {
		return fs.readFileSync(file, "utf8");
	} catch {
		return "";
	}
}

function readTrimmed(file) {
	return readText(file).trim();
}

function readRepoMap(repoRoot = REPO_ROOT) {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, ".agents/knowledge/repo-map.json"), "utf8"));
}

function toPosix(value) {
	return String(value).split(path.sep).join("/");
}

module.exports = {
	BACKEND_PORT_FILE,
	EVIDENCE_DIR,
	FRONTEND_PORT_FILE,
	REPO_ROOT,
	RUN_DIR,
	STATE_FILE,
	readRepoMap,
	readText,
	readTrimmed,
	toPosix,
};
