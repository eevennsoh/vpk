"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");

const { spawnInGroup } = require("../scripts/lib/test-process");

const SERVER_PATH = path.join(__dirname, "server.js");
// The real server with a drain that holds after stop-accepting until stdin gets a line.
const HELD_SERVER_PATH = path.join(__dirname, "__fixtures__", "held-shutdown-server.js");
const SHUTDOWN_STEPS = [
	"stop-accepting",
	"abort-runs",
	"close-browser-workspaces",
	"close-mirror-browsers",
	"close-chromium-preview",
	"shutdown-rovo-pool",
	"close-connections",
];

// Starts the real backend on an ephemeral loopback port and resolves once it logs the
// port it bound.
function startBackend(t, { serverPath = SERVER_PATH } = {}) {
	const env = { ...process.env, NODE_ENV: "development", PORT: "0", DEBUG: "false" };
	delete env.ROVO_PORT;
	delete env.NODE_TEST_CONTEXT;
	const child = spawnInGroup(process.execPath, [serverPath], {
		cwd: path.join(__dirname, ".."),
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
	assert.match(shutdownLines[0], /^\[SHUTDOWN\] SIGTERM: draining \(stop-accepting -> abort-runs -> close-browser-workspaces -> close-mirror-browsers -> close-chromium-preview -> shutdown-rovo-pool -> close-connections\), timeout 10000ms$/u);
	assert.deepEqual(
		shutdownLines.slice(1, -1).map((line) => /^\[SHUTDOWN\] ([a-z-]+): done/u.exec(line)?.[1]),
		SHUTDOWN_STEPS,
	);
	assert.equal(shutdownLines.at(-1), "[SHUTDOWN] complete; exiting 0");
});

test("a request on a keep-alive connection that arrives while draining gets 503 and Connection: close", { timeout: 60_000 }, async (t) => {
	const backend = startBackend(t, { serverPath: HELD_SERVER_PATH });
	const { host, port } = await backend.listening;

	const socket = net.connect(port, host);
	t.after(() => socket.destroy());
	await once(socket, "connect");
	let received = "";
	socket.setEncoding("utf8");
	socket.on("data", (chunk) => {
		received += chunk;
	});
	const closed = once(socket, "close");

	const receivedResponses = (count) =>
		new Promise((resolve) => {
			const check = () => {
				const heads = received.split(/(?=HTTP\/1\.1 \d{3} )/u).filter(Boolean);
				if (heads.length >= count && heads.at(-1).includes("\r\n\r\n")) resolve(heads);
				else socket.once("data", check);
			};
			check();
		});

	// A request whose body has not arrived keeps the connection active, so stop-accepting
	// leaves it open. "100 Continue" proves the server has parsed its headers.
	socket.write("POST /healthcheck HTTP/1.1\r\nHost: localhost\r\nContent-Type: text/plain\r\nContent-Length: 5\r\nExpect: 100-continue\r\n\r\n");
	await receivedResponses(1);
	assert.match(received, /^HTTP\/1\.1 100 Continue\r\n\r\n/u);
	backend.child.kill("SIGTERM");
	await backend.waitForLine(/^\[TEST\] drain held$/u);

	// Finish the first request and pipeline a second one behind it, both after the drain began.
	socket.write("hello");
	socket.write("GET /healthcheck HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n");
	await closed;
	const responses = received.split(/(?=HTTP\/1\.1 \d{3} )/u).filter(Boolean);
	const last = responses.at(-1);
	assert.match(last, /^HTTP\/1\.1 503 /u, received);
	assert.match(last, /\r\nconnection: close\r\n/iu, received);
	assert.deepEqual(JSON.parse(last.split("\r\n\r\n")[1]), { error: "The backend is shutting down." });
	assert.equal(responses.some((response) => /^HTTP\/1\.1 200 /u.test(response)), false, received);

	backend.child.stdin.write("release\n");
	const { code } = await backend.exited;
	assert.equal(code, 0, backend.lines.join("\n"));
	assert.ok(backend.lines.includes("[SHUTDOWN] test-hold: done (released)"), backend.lines.join("\n"));
});
