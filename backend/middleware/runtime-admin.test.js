"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	RUNTIME_SOCKET_TOKEN_TTL_MS,
	assertRuntimeAdminConfig,
	createRuntimeAdminControls,
	decideRuntimeSocketTokenRequest,
	getRuntimeAdminTokenFromRequest,
	isRuntimeAdminTokenValid,
	resolveRuntimeAdminConfig,
} = require("./runtime-admin");

function createRequest({ headers = {}, query = {}, remoteAddress = "203.0.113.7" } = {}) {
	return {
		get: (name) => headers[name.toLowerCase()],
		headers,
		query,
		socket: { remoteAddress },
	};
}

function createResponse() {
	const payloads = [];
	return {
		payloads,
		status: (statusCode) => ({
			json: (body) => {
				payloads.push({ body, statusCode });
			},
		}),
	};
}

test("runtime admin config preserves default dev-open and production-required behavior", () => {
	assert.deepEqual(resolveRuntimeAdminConfig({}), {
		runtimeAdminRequired: false,
		runtimeAdminToken: null,
		runtimeSocketTokenTtlMs: 60_000,
	});
	assert.deepEqual(resolveRuntimeAdminConfig({
		NODE_ENV: "production",
		VPK_RUNTIME_ADMIN_TOKEN: "secret",
	}), {
		runtimeAdminRequired: true,
		runtimeAdminToken: "secret",
		runtimeSocketTokenTtlMs: 60_000,
	});
	assert.deepEqual(resolveRuntimeAdminConfig({
		VPK_REQUIRE_RUNTIME_ADMIN: "true",
		VPK_RUNTIME_ADMIN_TOKEN: "secret",
	}), {
		runtimeAdminRequired: true,
		runtimeAdminToken: "secret",
		runtimeSocketTokenTtlMs: 60_000,
	});
	assert.equal(RUNTIME_SOCKET_TOKEN_TTL_MS, 60_000);
});

test("runtime admin fails closed when required without token", () => {
	const errors = [];
	const exits = [];
	const result = assertRuntimeAdminConfig({
		runtimeAdminRequired: true,
		runtimeAdminToken: null,
	}, {
		consoleImpl: {
			error: (message) => errors.push(message),
		},
		exit: (code) => exits.push(code),
	});

	assert.equal(result, false);
	assert.deepEqual(exits, [1]);
	assert.deepEqual(errors, [
		"[STARTUP] VPK_RUNTIME_ADMIN_TOKEN is required when runtime admin protection is enabled.",
	]);
});

test("runtime admin token is parsed from header, bearer auth, or query", () => {
	assert.equal(
		getRuntimeAdminTokenFromRequest(createRequest({
			headers: { "x-vpk-runtime-admin-token": "header-secret" },
		})),
		"header-secret",
	);
	assert.equal(
		getRuntimeAdminTokenFromRequest(createRequest({
			headers: { authorization: "Bearer bearer-secret" },
		})),
		"bearer-secret",
	);
	assert.equal(
		getRuntimeAdminTokenFromRequest(createRequest({
			query: { runtimeToken: "query-secret" },
		})),
		"query-secret",
	);
	assert.equal(
		getRuntimeAdminTokenFromRequest(createRequest({
			query: { token: "fallback-query-secret" },
		})),
		"fallback-query-secret",
	);
});

test("runtime admin middleware preserves dev-open, forbidden, and unavailable responses", () => {
	const openControls = createRuntimeAdminControls({ env: {} });
	let openNextCalls = 0;
	openControls.requireRuntimeAdmin(createRequest(), createResponse(), () => {
		openNextCalls += 1;
	});
	assert.equal(openNextCalls, 1);

	const tokenControls = createRuntimeAdminControls({
		env: { VPK_RUNTIME_ADMIN_TOKEN: "secret" },
	});
	let tokenNextCalls = 0;
	tokenControls.requireRuntimeAdmin(
		createRequest({ headers: { "x-vpk-runtime-admin-token": "secret" } }),
		createResponse(),
		() => {
			tokenNextCalls += 1;
		},
	);
	assert.equal(tokenNextCalls, 1);

	const forbiddenResponse = createResponse();
	tokenControls.requireRuntimeAdmin(createRequest(), forbiddenResponse, () => {});
	assert.deepEqual(forbiddenResponse.payloads, [{
		statusCode: 403,
		body: { error: "Runtime admin authorization required" },
	}]);

	const requiredControls = createRuntimeAdminControls({
		env: { VPK_REQUIRE_RUNTIME_ADMIN: "true" },
		exit: () => {},
		consoleImpl: { error: () => {} },
	});
	const unavailableResponse = createResponse();
	requiredControls.requireRuntimeAdmin(createRequest(), unavailableResponse, () => {});
	assert.deepEqual(unavailableResponse.payloads, [{
		statusCode: 503,
		body: { error: "Runtime admin authorization required" },
	}]);
});

test("runtime admin token validation uses exact timing-safe match", () => {
	assert.equal(isRuntimeAdminTokenValid("secret", "secret"), true);
	assert.equal(isRuntimeAdminTokenValid("secret", "different"), false);
	assert.equal(isRuntimeAdminTokenValid("secret", null), false);
	assert.equal(isRuntimeAdminTokenValid(null, "secret"), false);
});

test("runtime socket helpers mint scoped tokens and gate token requester origins", () => {
	const controls = createRuntimeAdminControls({
		allowedOrigins: ["https://allowed.test"],
		env: { VPK_RUNTIME_ADMIN_TOKEN: "secret" },
	});
	const token = controls.createRuntimeSocketToken("realtime:audio-conversation");

	assert.equal(typeof token, "string");
	assert.equal(controls.isRuntimeSocketTokenValid(token, "realtime:audio-conversation"), true);
	assert.equal(controls.isRuntimeSocketTokenValid(token, "browser-preview:other"), false);
	assert.match(
		controls.appendRuntimeSocketToken(
			"/api/realtime/audio-conversation",
			"realtime:audio-conversation",
			"realtimeToken",
		),
		/^\/api\/realtime\/audio-conversation\?realtimeToken=/u,
	);

	let nextCalls = 0;
	controls.requireRuntimeSocketTokenRequester(
		createRequest({
			headers: {
				host: "127.0.0.1:8080",
				origin: "https://allowed.test",
			},
		}),
		createResponse(),
		() => {
			nextCalls += 1;
		},
	);
	assert.equal(nextCalls, 1);

	const blockedResponse = createResponse();
	controls.requireRuntimeSocketTokenRequester(
		createRequest({
			headers: {
				host: "127.0.0.1:8080",
				origin: "https://blocked.test",
			},
		}),
		blockedResponse,
		() => {},
	);
	assert.deepEqual(blockedResponse.payloads, [{
		statusCode: 403,
		body: { error: "Runtime socket token origin is not allowed" },
	}]);
});

test("decideRuntimeSocketTokenRequest issues socket tokens only to an allowed Origin, a same-origin browser or the runtime admin", () => {
	const base = {
		adminTokenValid: false,
		origin: null,
		originAllowed: false,
		production: true,
		remoteAddress: "203.0.113.7",
		runtimeAdminRequired: true,
		runtimeAdminToken: "secret",
		secFetchSite: null,
	};
	const cases = [
		["production, no Origin, no browser header (a script)", {}, "reject", "no-origin"],
		["production, no Origin, cross-site fetch metadata", { secFetchSite: "cross-site" }, "reject", "no-origin"],
		["production, no Origin, same-origin browser fetch (the app)", { secFetchSite: "same-origin" }, "issue", "same-origin-browser"],
		["production, allowed Origin", { origin: "https://app.test", originAllowed: true }, "issue", "allowed-origin"],
		["production, disallowed Origin even with same-origin metadata", { origin: "https://evil.test", secFetchSite: "same-origin" }, "reject", "origin-not-allowed"],
		["production, runtime admin token", { adminTokenValid: true }, "issue", "runtime-admin"],
		["production, loopback caller is not trusted", { remoteAddress: "127.0.0.1" }, "reject", "no-origin"],
		["development with a token, the Next proxy on loopback", { production: false, runtimeAdminRequired: false, remoteAddress: "::ffff:127.0.0.1" }, "issue", "local-proxy"],
		["development with VPK_REQUIRE_RUNTIME_ADMIN, the Next proxy on loopback", { production: false, remoteAddress: "127.0.0.1" }, "issue", "local-proxy"],
		["development with a token, a LAN caller", { production: false, runtimeAdminRequired: false }, "reject", "no-origin"],
		["development without a token (tokens are empty)", { production: false, runtimeAdminRequired: false, runtimeAdminToken: null }, "issue", "tokens-disabled"],
	];
	for (const [name, overrides, action, reason] of cases) {
		assert.deepEqual(decideRuntimeSocketTokenRequest({ ...base, ...overrides }), { action, reason }, name);
	}
});

test("the token route refuses a production request with no Origin and accepts the app's same-origin fetch", () => {
	const controls = createRuntimeAdminControls({
		allowedOrigins: ["https://allowed.test"],
		env: { NODE_ENV: "production", VPK_RUNTIME_ADMIN_TOKEN: "secret" },
	});
	const run = (headers) => {
		const response = createResponse();
		let nextCalls = 0;
		controls.requireRuntimeSocketTokenRequester(createRequest({ headers: { host: "app.test", ...headers } }), response, () => {
			nextCalls += 1;
		});
		return { nextCalls, payloads: response.payloads };
	};
	assert.deepEqual(run({}), { nextCalls: 0, payloads: [{ statusCode: 403, body: { error: "Runtime socket token origin is not allowed" } }] });
	assert.deepEqual(run({ "sec-fetch-site": "same-origin" }), { nextCalls: 1, payloads: [] });
	assert.deepEqual(run({ "x-vpk-runtime-admin-token": "secret" }), { nextCalls: 1, payloads: [] });
});

test("the token route keeps working through the Next dev proxy when development requires runtime admin", () => {
	const controls = createRuntimeAdminControls({
		allowedOrigins: ["http://localhost:3000"],
		env: { NODE_ENV: "development", VPK_REQUIRE_RUNTIME_ADMIN: "true", VPK_RUNTIME_ADMIN_TOKEN: "secret" },
	});
	let nextCalls = 0;
	const response = createResponse();
	controls.requireRuntimeSocketTokenRequester(createRequest({ headers: { host: "127.0.0.1:8080" }, remoteAddress: "127.0.0.1" }), response, () => {
		nextCalls += 1;
	});
	assert.equal(nextCalls, 1);
	assert.deepEqual(response.payloads, []);
});
