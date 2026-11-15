const assert = require("node:assert/strict");
const test = require("node:test");

const {
	appendRuntimeSocketToken,
	createRuntimeSocketToken,
	isAllowedRuntimeSocketOrigin,
	isRuntimeSocketTokenValid,
} = require("./runtime-socket-security");

const runtimeAdminToken = "test-runtime-admin-token";
const tokenOptions = {
	runtimeAdminToken,
	subject: "alice",
	ttlMs: 60_000,
};

test("runtime socket origin policy allows same-host production origins", () => {
	assert.equal(
		isAllowedRuntimeSocketOrigin(
			"https://vpk.example.com",
			"vpk.example.com",
			[],
		),
		true,
	);
});

test("runtime socket origin policy allows local worktree and loopback origins", () => {
	for (const origin of [
		"http://localhost:3060",
		"http://127.0.0.1:3060",
		"http://main.localhost:3060",
	]) {
		assert.equal(isAllowedRuntimeSocketOrigin(origin, "localhost:8140", []), true);
	}
});

test("runtime socket origin policy still rejects unrelated cross-origin upgrades", () => {
	assert.equal(
		isAllowedRuntimeSocketOrigin(
			"https://attacker.example",
			"vpk.example.com",
			["https://allowed.example"],
		),
		false,
	);
});

test("runtime socket tokens are scoped and signed", () => {
	const token = createRuntimeSocketToken("realtime:audio-conversation", tokenOptions);

	assert.equal(
		isRuntimeSocketTokenValid(
			token,
			"realtime:audio-conversation",
			{ runtimeAdminToken, subject: "alice" },
		),
		true,
	);
	assert.equal(
		isRuntimeSocketTokenValid(
			token,
			"browser-preview:workspace-1",
			{ runtimeAdminToken, subject: "alice" },
		),
		false,
	);
	assert.equal(
		isRuntimeSocketTokenValid(
			`${token}.extra`,
			"realtime:audio-conversation",
			{ runtimeAdminToken, subject: "alice" },
		),
		false,
	);
});

test("appendRuntimeSocketToken preserves absolute and relative websocket URLs", () => {
	const absoluteUrl = appendRuntimeSocketToken(
		"ws://127.0.0.1:8080/api/realtime/audio-conversation",
		"realtime:audio-conversation",
		"realtimeToken",
		tokenOptions,
	);
	assert.match(absoluteUrl, /^ws:\/\/127\.0\.0\.1:8080\/api\/realtime\/audio-conversation\?realtimeToken=/u);

	const relativeUrl = appendRuntimeSocketToken(
		"/api/browser-workspaces/workspace-1/live",
		"browser-preview:workspace-1",
		"previewToken",
		tokenOptions,
	);
	assert.match(relativeUrl, /^\/api\/browser-workspaces\/workspace-1\/live\?previewToken=/u);
});

test("a runtime socket token opens a socket only for the caller it was issued to", () => {
	const token = createRuntimeSocketToken("realtime:audio-conversation", tokenOptions);
	assert.equal(isRuntimeSocketTokenValid(token, "realtime:audio-conversation", { runtimeAdminToken, subject: "alice" }), true);
	// Another SLAuth subject presenting alice's token, or no subject at all, is refused.
	assert.equal(isRuntimeSocketTokenValid(token, "realtime:audio-conversation", { runtimeAdminToken, subject: "bob" }), false);
	assert.equal(isRuntimeSocketTokenValid(token, "realtime:audio-conversation", { runtimeAdminToken, subject: "" }), false);
	assert.equal(isRuntimeSocketTokenValid(token, "realtime:audio-conversation", { runtimeAdminToken }), false);
	// No caller, no token.
	assert.equal(createRuntimeSocketToken("realtime:audio-conversation", { runtimeAdminToken, ttlMs: 60_000 }), "");
});
