#!/usr/bin/env node

"use strict";

// Writes .claude/launch.json with this checkout's deterministic ports. A tracked file
// could only hold one port, so in a worktree the preview waited on 3000 and could open
// the main checkout's server instead of this one. Run by the SessionStart hook.

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const LAUNCH_PATH = path.join(__dirname, "..", ".claude", "launch.json");

function buildClaudeLaunchConfig({ backendBase, frontendBase, rovoBase }) {
	const pnpmRun = (name, script, port) => ({ name, runtimeExecutable: "pnpm", runtimeArgs: ["run", script], port });
	return {
		version: "0.0.1",
		configurations: [
			pnpmRun("frontend", "dev:frontend", frontendBase),
			pnpmRun("backend", "dev:backend", backendBase),
			pnpmRun("rovo", "dev:rovo", rovoBase),
			pnpmRun("dev (frontend + backend)", "dev", frontendBase),
			pnpmRun("rovo-stack (all three)", "rovo", frontendBase),
		],
	};
}

function writeClaudeLaunchConfig({ launchPath = LAUNCH_PATH, portInfo } = {}) {
	const ports = portInfo ?? require("./lib/worktree-ports").getPortInfo();
	const content = `${JSON.stringify(buildClaudeLaunchConfig(ports), null, "\t")}\n`;
	if (existsSync(launchPath) && readFileSync(launchPath, "utf8") === content) return false;
	mkdirSync(path.dirname(launchPath), { recursive: true });
	writeFileSync(launchPath, content);
	return true;
}

if (require.main === module) {
	const changed = writeClaudeLaunchConfig();
	console.log(`${changed ? "Wrote" : "Kept"} ${path.relative(process.cwd(), LAUNCH_PATH)} for this checkout's ports.`);
}

module.exports = {
	buildClaudeLaunchConfig,
	writeClaudeLaunchConfig,
};
