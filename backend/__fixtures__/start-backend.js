// @ts-check
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { spawnInGroup } = require("../../scripts/lib/test-process");

const SERVER_PATH = path.join(__dirname, "..", "server.js");

// A temporary data directory, so a test backend never writes (or contends for the lock on)
// the checkout's backend/data while a dev stack is using it. Register the returned cleanup
// after the backend's own (t.after hooks run in order), so the directory goes once it exits.
function makeTempDataDir() {
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-backend-data-"));
	return { dataDir, remove: () => fs.rmSync(dataDir, { recursive: true, force: true }) };
}

// Starts the real backend on an ephemeral loopback port and resolves once it logs the
// port it bound. `env` adds or overrides variables (an empty string keeps .env.local's
// value out, since dotenv never overrides a variable that is set). Each call gets its own
// temporary data directory unless `env` names one in VPK_BACKEND_DATA_DIR.
/**
 * @param {import("node:test").TestContext} t
 * @param {{ serverPath?: string, env?: NodeJS.ProcessEnv }} [options]
 */
function startBackend(t, { serverPath = SERVER_PATH, env: extraEnv = {} } = {}) {
	/** @type {NodeJS.ProcessEnv} */
	const env = { ...process.env, NODE_ENV: "development", PORT: "0", DEBUG: "false", ...extraEnv };
	const tempDataDir = extraEnv.VPK_BACKEND_DATA_DIR ? null : makeTempDataDir();
	if (tempDataDir) env.VPK_BACKEND_DATA_DIR = tempDataDir.dataDir;
	delete env.ROVO_PORT;
	delete env.NODE_TEST_CONTEXT;
	const child = spawnInGroup(process.execPath, [serverPath], {
		cwd: path.join(__dirname, "..", ".."),
		env,
		stdio: ["pipe", "pipe", "pipe"],
	}, { t });
	if (tempDataDir) t.after(tempDataDir.remove);

	const lines = [];
	const waiters = [];
	const exited = new Promise((resolve) => {
		child.once("exit", (code, signal) => resolve({ code, signal }));
	});
	const onData = (chunk) => {
		for (const line of String(chunk).split("\n")) {
			lines.push(line);
			for (const waiter of waiters.filter(({ match }) => match(line))) {
				waiters.splice(waiters.indexOf(waiter), 1);
				waiter.resolve(line);
			}
		}
	};
	child.stdout.on("data", onData);
	child.stderr.on("data", onData);
	// Resolves with the first line (from now on) that matches.
	const waitForLine = (pattern) =>
		new Promise((resolve, reject) => {
			waiters.push({ match: (line) => pattern.test(line), resolve });
			exited.then(({ code, signal }) => reject(new Error(`backend exited (${code ?? signal}) before ${pattern}:\n${lines.join("\n")}`)));
		});
	const listening = waitForLine(/^\[PROCESS\] listening on \S+:\d+$/u).then((line) => {
		const [, host, port] = /** @type {RegExpExecArray} */ (/^\[PROCESS\] listening on (\S+):(\d+)$/u.exec(line));
		return { host, port: Number(port) };
	});
	return { child, exited, lines, listening, waitForLine };
}

module.exports = { SERVER_PATH, makeTempDataDir, startBackend };
