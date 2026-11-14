"use strict";

// BE-F4: no WebSocket frame or socket event can take the real backend down.

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const WebSocket = require("ws");

const { startBackend } = require("../__fixtures__/start-backend");

// No upstream realtime session can open: no API key and no gateway credentials, so the
// session answers `config_missing` without any network request.
const OFFLINE_REALTIME_ENV = { OPENAI_REALTIME_API_KEY: "", ASAP_PRIVATE_KEY: "" };

async function openSocket(url) {
	const socket = new WebSocket(url);
	const messages = [];
	socket.on("message", (data) => messages.push(String(data)));
	await once(socket, "open");
	return { socket, messages };
}

test("hostile realtime frames and preview frames leave the real backend running", { timeout: 60_000 }, async (t) => {
	const backend = startBackend(t, { env: OFFLINE_REALTIME_ENV });
	const { host, port } = await backend.listening;
	const base = `ws://${host}:${port}`;

	const realtime = await openSocket(`${base}/api/realtime/audio-conversation`);
	t.after(() => realtime.socket.terminate());
	// Valid JSON that is not an object, then shapes a handler would read fields from.
	for (const frame of ["1", "null", "[]", "\"text\"", "true", "{\"type\":null}", "{\"type\":\"audio_buffer_append\"}", "{\"type\":\"session_update\",\"session\":7}", "{\"type\":\"context_inject\",\"text\":{}}", "{\"type\":\"text_message_from_user\",\"text\":[]}", "not json"]) {
		realtime.socket.send(frame);
	}

	const preview = await openSocket(`${base}/api/browser-workspaces/059d607c-a1aa-48f5-880b-5d824fc5b99f/live`);
	t.after(() => preview.socket.terminate());
	for (const frame of ["{\"type\":\"preview-pointer\"}", "[]", "null", "not json"]) {
		if (preview.socket.readyState === WebSocket.OPEN) preview.socket.send(frame);
	}

	// Each socket answers a ping only after every frame sent before it was handled.
	for (const { socket } of [realtime, preview]) {
		if (socket.readyState !== WebSocket.OPEN) continue;
		socket.ping();
		await Promise.race([once(socket, "pong"), once(socket, "close")]);
	}

	const health = await fetch(`http://${host}:${port}/healthcheck`);
	assert.deepEqual(await health.json(), { status: "ok" });
	assert.equal(backend.lines.some((line) => /Uncaught exception|Unhandled rejection/u.test(line)), false, backend.lines.join("\n"));
});

test("a frame over the size cap closes that socket with 1009 and leaves the backend running", { timeout: 60_000 }, async (t) => {
	const backend = startBackend(t, { env: OFFLINE_REALTIME_ENV });
	const { host, port } = await backend.listening;
	const base = `ws://${host}:${port}`;
	// The realtime socket stays open without credentials; a preview socket for a missing
	// workspace closes on its own, so its cap is covered by the server options test.
	const { socket } = await openSocket(`${base}/api/realtime/audio-conversation`);
	t.after(() => socket.terminate());
	const closed = once(socket, "close");
	socket.on("error", () => {});
	socket.send("x".repeat(2 * 1024 * 1024));
	const [code] = await closed;
	assert.equal(code, 1009);
	const health = await fetch(`http://${host}:${port}/healthcheck`);
	assert.deepEqual(await health.json(), { status: "ok" });
});
