"use strict";

// BE-F10: a throw inside the agent-browser native stream's frame callback, or inside the
// upstream realtime message handler, is dropped and logged; neither reaches
// uncaughtException, which exits the backend. Local loopback servers only.

const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const WebSocket = require("ws");

async function startLocalServer(t) {
	const server = new WebSocket.Server({ host: "127.0.0.1", port: 0 });
	await once(server, "listening");
	t.after(() => new Promise((resolve) => {
		for (const client of server.clients) client.terminate();
		server.close(() => resolve());
	}));
	return server;
}

test("a throwing native stream frame callback drops the frame instead of exiting", async (t) => {
	const { AgentBrowserRuntime } = require("../lib/browser-workspace-runtime");
	const server = await startLocalServer(t);
	const warn = t.mock.method(console, "warn", () => {});
	const runtime = new AgentBrowserRuntime({ sessionId: "guard-test" });
	let calls = 0;
	const connected = once(server, "connection");
	const socket = await runtime._connectNativeStream(server.address().port, () => {
		calls += 1;
		throw new Error("preview client closed");
	});
	t.after(() => socket.terminate());
	const [peer] = await connected;
	const frame = JSON.stringify({ type: "frame", data: Buffer.from("jpeg").toString("base64"), metadata: {} });
	peer.send(frame);
	peer.send(frame);
	// A ping round trip after both frames: both were handled before the pong.
	socket.ping();
	await once(socket, "pong");
	assert.equal(calls, 2);
	assert.equal(warn.mock.calls.filter((call) => String(call.arguments[0]).includes("Native stream frame dropped")).length, 2);
});

test("a throwing upstream realtime message handler drops the message instead of exiting", async (t) => {
	const server = await startLocalServer(t);
	const helpers = require("../lib/ai-gateway-helpers");
	const original = { getRealtimeConfig: helpers.getRealtimeConfig, getEnvVars: helpers.getEnvVars };
	helpers.getRealtimeConfig = () => ({ apiKey: "test-only-placeholder", model: "m", wsUrl: `ws://127.0.0.1:${server.address().port}` });
	helpers.getEnvVars = () => ({});
	const modulePath = require.resolve("../lib/openai-realtime");
	delete require.cache[modulePath];
	t.after(() => {
		Object.assign(helpers, original);
		delete require.cache[modulePath];
	});
	const { RealtimeSession } = require("../lib/openai-realtime");

	const logs = [];
	const session = new RealtimeSession({ readyState: 1, send() {}, close() {} }, { onLog: (_section, message) => logs.push(message) });
	session._handleOpenAIMessage = () => {
		throw new Error("unexpected upstream event");
	};
	const connected = once(server, "connection");
	await session.connect();
	t.after(() => session.close());
	const [peer] = await connected;
	peer.send(JSON.stringify({ type: "session.created" }));
	await once(session._openaiWs, "message");
	// The listener that throws ran before this one; one more round trip settles it.
	session._openaiWs.ping();
	await once(session._openaiWs, "pong");
	assert.equal(logs.some((message) => message.includes("Dropped an upstream message that failed")), true);
});
