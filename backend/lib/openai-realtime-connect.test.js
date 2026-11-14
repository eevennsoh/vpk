"use strict";

// A realtime client that leaves while the gateway token is fetched must not get an
// upstream socket opened after its session closed.

const assert = require("node:assert/strict");
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
