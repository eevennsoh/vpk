"use strict";

// A realtime client that leaves while the gateway token is fetched must not get an
// upstream socket opened after its session closed, and a rejected upstream upgrade must
// end both sockets.

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

test("connect() opens no upstream socket when the session closed during the token fetch", async (t) => {
	const helpers = require("./ai-gateway-helpers");
	const original = {
		getAuthToken: helpers.getAuthToken,
		getEnvVars: helpers.getEnvVars,
		getRealtimeConfig: helpers.getRealtimeConfig,
	};
	const previousAsapKey = process.env.ASAP_PRIVATE_KEY;
	let releaseToken;
	const tokenFetched = new Promise((resolve) => {
		releaseToken = resolve;
	});
	helpers.getAuthToken = () => tokenFetched;
	helpers.getEnvVars = () => ({});
	// A closed local port: if a socket were opened anyway, it goes nowhere.
	helpers.getRealtimeConfig = () => ({ apiKey: "", model: "test-model", wsUrl: "ws://127.0.0.1:9" });
	process.env.ASAP_PRIVATE_KEY = "test-only-placeholder";
	const modulePath = require.resolve("./openai-realtime");
	delete require.cache[modulePath];
	t.after(() => {
		Object.assign(helpers, original);
		if (previousAsapKey === undefined) delete process.env.ASAP_PRIVATE_KEY;
		else process.env.ASAP_PRIVATE_KEY = previousAsapKey;
		delete require.cache[modulePath];
	});
	const { RealtimeSession, SESSION_STATE } = require("./openai-realtime");

	const session = new RealtimeSession({ readyState: 1, send() {} });
	const connecting = session.connect();
	session.close();
	releaseToken("token");
	await connecting;

	assert.equal(session._openaiWs, null);
	assert.equal(session.state, SESSION_STATE.CLOSED);
});

test("a rejected upstream upgrade ends the upstream socket and closes the client", async (t) => {
	const helpers = require("./ai-gateway-helpers");
	const original = { getRealtimeConfig: helpers.getRealtimeConfig };
	const previousAsapKey = process.env.ASAP_PRIVATE_KEY;
	delete process.env.ASAP_PRIVATE_KEY;
	// Answers every WebSocket upgrade with 401, as the gateway does for bad credentials.
	const server = http.createServer();
	server.on("upgrade", (_req, socket) => {
		socket.end("HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nContent-Length: 12\r\nConnection: close\r\n\r\nbad api key\n");
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());
	helpers.getRealtimeConfig = () => ({ apiKey: "test-only-key", model: "test-model", wsUrl: `ws://127.0.0.1:${port}` });
	const modulePath = require.resolve("./openai-realtime");
	delete require.cache[modulePath];
	t.after(async () => {
		Object.assign(helpers, original);
		if (previousAsapKey !== undefined) process.env.ASAP_PRIVATE_KEY = previousAsapKey;
		delete require.cache[modulePath];
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	});
	const { RealtimeSession, SESSION_STATE } = require("./openai-realtime");

	const clientMessages = [];
	let clientClosed;
	const clientClose = new Promise((resolve) => {
		clientClosed = resolve;
	});
	const client = {
		readyState: 1,
		send: (payload) => clientMessages.push(JSON.parse(payload)),
		close: (code, reason) => {
			client.readyState = 3;
			clientClosed({ code, reason });
		},
	};
	const session = new RealtimeSession(client);
	await session.connect();
	assert.equal(session.state, SESSION_STATE.CONNECTING);

	assert.deepEqual(await clientClose, { code: 1001, reason: "OpenAI upstream closed" });
	assert.equal(session.state, SESSION_STATE.CLOSED);
	assert.equal(session._openaiWs.readyState, 3);
	assert.deepEqual(clientMessages.map((message) => [message.type, message.error?.code, message.error?.statusCode]), [
		["error", "connection_error", 401],
	]);
});
