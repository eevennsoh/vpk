"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const net = require("node:net");
const test = require("node:test");

const { startBackend } = require("../__fixtures__/start-backend");
const { parseUpgradeTarget } = require("./ws-relay");

const UPGRADE_HEADERS = "Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n";

test("parseUpgradeTarget never throws on a hostile path, query or workspace id", () => {
	const cases = [
		["/api/realtime/audio-conversation?realtimeToken=x", { ok: true, workspaceId: null }],
		["/api/browser-workspaces/059d607c-a1aa-48f5-880b-5d824fc5b99f/live", { ok: true, workspaceId: "059d607c-a1aa-48f5-880b-5d824fc5b99f" }],
		["/api/browser-workspaces/%E0%A4%A/live", { ok: false }],
		["/api/browser-workspaces/..%2F..%2Fx/live", { ok: false }],
		["/api/browser-workspaces/a%2Fb/live", { ok: false }],
		[`/api/browser-workspaces/${"x".repeat(200)}/live`, { ok: false }],
		["http://[/x", { ok: false }],
		[undefined, { ok: true, workspaceId: null }],
	];
	for (const [rawUrl, expected] of cases) {
		const result = parseUpgradeTarget(rawUrl);
		assert.deepEqual({ ok: result.ok, ...(result.ok ? { workspaceId: result.workspaceId } : {}) }, expected, String(rawUrl));
	}
});

// Sends one raw upgrade request and resolves with the status line the backend answers.
async function sendRawUpgrade(host, port, requestLines) {
	const socket = net.connect(port, host);
	await once(socket, "connect");
	let received = "";
	socket.setEncoding("utf8");
	socket.on("data", (chunk) => {
		received += chunk;
	});
	socket.write(requestLines);
	await once(socket, "close");
	return received.split("\r\n")[0];
}

test("a malformed upgrade gets 400 and the real backend keeps running", { timeout: 60_000 }, async (t) => {
	const backend = startBackend(t);
	const { host, port } = await backend.listening;

	// Each of these exited the backend with code 1 before the origin or token check.
	assert.equal(
		await sendRawUpgrade(host, port, `GET /api/browser-workspaces/%E0%A4%A/live HTTP/1.1\r\nHost: localhost\r\n${UPGRADE_HEADERS}\r\n`),
		"HTTP/1.1 400 Bad Request",
	);
	assert.equal(
		await sendRawUpgrade(host, port, `GET /api/realtime/audio-conversation HTTP/1.1\r\nHost: a b\r\nOrigin: http://evil.example\r\n${UPGRADE_HEADERS}\r\n`),
		"HTTP/1.1 403 Forbidden",
	);

	const health = await fetch(`http://${host}:${port}/healthcheck`);
	assert.deepEqual(await health.json(), { status: "ok" });
	assert.equal(backend.lines.some((line) => line.startsWith("Uncaught exception")), false, backend.lines.join("\n"));
});
