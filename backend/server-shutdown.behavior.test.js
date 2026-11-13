"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { spawnInGroup } = require("../scripts/lib/test-process");

const SERVER_PATH = path.join(__dirname, "server.js");
const SHUTDOWN_STEPS = [
	"stop-accepting",
	"abort-runs",
	"close-browser-workspaces",
	"shutdown-rovo-pool",
	"close-connections",
];

// Starts the real backend on an ephemeral loopback port and resolves once it logs the
// port it bound.
function startBackend(t) {
	const env = { ...process.env, NODE_ENV: "development", PORT: "0", DEBUG: "false" };
	delete env.ROVO_PORT;
	delete env.NODE_TEST_CONTEXT;
	const child = spawnInGroup(process.execPath, [SERVER_PATH], {
		cwd: path.join(__dirname, ".."),
		env,
		stdio: ["ignore", "pipe", "pipe"],
	}, { t });

	const lines = [];
	const exited = new Promise((resolve) => {
		child.once("exit", (code, signal) => resolve({ code, signal }));
	});
	const listening = new Promise((resolve, reject) => {
		const onData = (chunk) => {
			for (const line of String(chunk).split("\n")) {
				lines.push(line);
				const match = /^\[PROCESS\] listening on (\S+):(\d+)$/u.exec(line);
				if (match) resolve({ host: match[1], port: Number(match[2]) });
			}
		};
		child.stdout.on("data", onData);
		child.stderr.on("data", onData);
		exited.then(({ code, signal }) => reject(new Error(`backend exited before listening (${code ?? signal}):\n${lines.join("\n")}`)));
	});
	return { child, exited, lines, listening };
}

test("SIGTERM drains the real backend in order and exits 0", { timeout: 60_000 }, async (t) => {
	const backend = startBackend(t);
	const { host, port } = await backend.listening;
	assert.equal(host, "127.0.0.1");
	assert.ok(port > 0);

	// Leave an idle keep-alive connection open: draining must close it, not wait on it.
	const response = await fetch(`http://${host}:${port}/healthcheck`);
	assert.deepEqual(await response.json(), { status: "ok" });

	backend.child.kill("SIGTERM");
	const { code, signal } = await backend.exited;
	assert.equal(signal, null);
	assert.equal(code, 0, backend.lines.join("\n"));

	const shutdownLines = backend.lines.filter((line) => line.startsWith("[SHUTDOWN]"));
	assert.match(shutdownLines[0], /^\[SHUTDOWN\] SIGTERM: draining \(stop-accepting -> abort-runs -> close-browser-workspaces -> shutdown-rovo-pool -> close-connections\), timeout 10000ms$/u);
	assert.deepEqual(
		shutdownLines.slice(1, -1).map((line) => /^\[SHUTDOWN\] ([a-z-]+): done/u.exec(line)?.[1]),
		SHUTDOWN_STEPS,
	);
	assert.equal(shutdownLines.at(-1), "[SHUTDOWN] complete; exiting 0");
});
