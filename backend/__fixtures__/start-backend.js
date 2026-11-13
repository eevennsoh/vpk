"use strict";

const path = require("node:path");

const { spawnInGroup } = require("../../scripts/lib/test-process");

const SERVER_PATH = path.join(__dirname, "..", "server.js");

// Starts the real backend on an ephemeral loopback port and resolves once it logs the
// port it bound. `env` adds or overrides variables (an empty string keeps .env.local's
// value out, since dotenv never overrides a variable that is set).
function startBackend(t, { serverPath = SERVER_PATH, env: extraEnv = {} } = {}) {
	const env = { ...process.env, NODE_ENV: "development", PORT: "0", DEBUG: "false", ...extraEnv };
	delete env.ROVO_PORT;
	delete env.NODE_TEST_CONTEXT;
	const child = spawnInGroup(process.execPath, [serverPath], {
		cwd: path.join(__dirname, "..", ".."),
		env,
		stdio: ["pipe", "pipe", "pipe"],
	}, { t });

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
		const [, host, port] = /^\[PROCESS\] listening on (\S+):(\d+)$/u.exec(line);
		return { host, port: Number(port) };
	});
	return { child, exited, lines, listening, waitForLine };
}

module.exports = { SERVER_PATH, startBackend };
