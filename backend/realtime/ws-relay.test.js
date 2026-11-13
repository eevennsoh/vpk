"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	getRuntimeSocketTokenFromUpgrade,
	registerBackendWebSocketRelays,
	rejectUpgrade,
	verifyRuntimeSocketUpgrade,
} = require("./ws-relay");

function createRequest(url, headers = {}) {
	return {
		headers: {
			host: "127.0.0.1:8080",
			origin: "http://127.0.0.1:3000",
			...headers,
		},
		url,
	};
}

function createSocket() {
	const socket = {
		destroyed: false,
		writes: [],
		destroy() {
			this.destroyed = true;
		},
		write(value) {
			this.writes.push(value);
		},
	};
	return socket;
}

function createFakeServer() {
	const handlers = new Map();
	return {
		handlers,
		on(eventName, handler) {
			handlers.set(eventName, handler);
		},
	};
}

function createFakeWebSocketImpl() {
	const instances = [];
	class FakeWebSocketServer {
		constructor(options) {
			this.emitted = [];
			this.handledUpgrades = [];
			this.listeners = new Map();
			this.options = options;
			instances.push(this);
		}

		emit(eventName, ...args) {
			this.emitted.push({ args, eventName });
			this.listeners.get(eventName)?.(...args);
		}

		handleUpgrade(request, socket, head, callback) {
			const ws = createFakeWs();
			this.handledUpgrades.push({ head, request, socket, ws });
			callback(ws);
		}

		on(eventName, handler) {
			this.listeners.set(eventName, handler);
		}
	}

	return {
		instances,
		webSocketImpl: {
			Server: FakeWebSocketServer,
		},
	};
}

function createFakeWs() {
	const listeners = new Map();
	return {
		closed: false,
		listeners,
		sent: [],
		close() {
			this.closed = true;
		},
		on(eventName, handler) {
			listeners.set(eventName, handler);
		},
		send(payload) {
			this.sent.push(payload);
		},
	};
}

function createBrowserWorkspaceManager(overrides = {}) {
	const calls = [];
	return {
		calls,
		attachWorkspacePreviewClient: async (workspaceId, ws) => {
			calls.push({ method: "attachWorkspacePreviewClient", workspaceId, ws });
		},
		detachWorkspacePreviewClient: async (workspaceId, ws) => {
			calls.push({ method: "detachWorkspacePreviewClient", workspaceId, ws });
		},
		handleWorkspacePreviewControlMessage: async (workspaceId, payload) => {
			calls.push({ method: "handleWorkspacePreviewControlMessage", payload, workspaceId });
		},
		...overrides,
	};
}

function createRegistrationDependencies(overrides = {}) {
	return {
		browserWorkspaceManager: createBrowserWorkspaceManager(),
		consoleImpl: {
			error: () => {},
			log: () => {},
		},
		getMirrorBrowser: () => null,
		isAllowedRuntimeSocketOrigin: () => true,
		isRuntimeSocketTokenValid: (_token, scope) => scope === "realtime:audio-conversation",
		realtimeSessionImpl: class RealtimeSession {
			connect() {}
			close() {}
			handleClientMessage() {}
		},
		runtimeAdminRequired: false,
		runtimeAdminToken: null,
		...overrides,
	};
}

test("getRuntimeSocketTokenFromUpgrade prefers the scoped param and falls back to socketToken", () => {
	const scopedUrl = new URL("http://localhost/live?previewToken=scoped&socketToken=fallback");
	assert.equal(getRuntimeSocketTokenFromUpgrade(scopedUrl, "previewToken"), "scoped");

	const fallbackUrl = new URL("http://localhost/live?socketToken=fallback");
	assert.equal(getRuntimeSocketTokenFromUpgrade(fallbackUrl, "previewToken"), "fallback");

	const emptyScopedUrl = new URL("http://localhost/live?previewToken=&socketToken=fallback");
	assert.equal(getRuntimeSocketTokenFromUpgrade(emptyScopedUrl, "previewToken"), "fallback");
});

test("rejectUpgrade writes a close response and destroys the socket", () => {
	const socket = createSocket();
	rejectUpgrade(socket, 403, "Forbidden");

	assert.deepEqual(socket.writes, [
		"HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
	]);
	assert.equal(socket.destroyed, true);
});

test("verifyRuntimeSocketUpgrade rejects blocked origins before token checks", () => {
	let tokenChecks = 0;
	const result = verifyRuntimeSocketUpgrade(
		new URL("http://localhost/live?previewToken=valid"),
		createRequest("/live"),
		{
			isAllowedRuntimeSocketOrigin: () => false,
			isRuntimeSocketTokenValid: () => {
				tokenChecks += 1;
				return true;
			},
			paramName: "previewToken",
			runtimeAdminRequired: true,
			runtimeAdminToken: "secret",
			scope: "browser-preview:workspace-1",
		},
	);

	assert.deepEqual(result, { ok: false, statusCode: 403, message: "Forbidden" });
	assert.equal(tokenChecks, 0);
});

test("verifyRuntimeSocketUpgrade allows open dev mode without a token", () => {
	const result = verifyRuntimeSocketUpgrade(
		new URL("http://localhost/live"),
		createRequest("/live"),
		{
			isAllowedRuntimeSocketOrigin: () => true,
			isRuntimeSocketTokenValid: () => false,
			paramName: "previewToken",
			runtimeAdminRequired: false,
			runtimeAdminToken: null,
			scope: "browser-preview:workspace-1",
		},
	);

	assert.deepEqual(result, { ok: true });
});

test("verifyRuntimeSocketUpgrade accepts a valid scoped runtime token", () => {
	const result = verifyRuntimeSocketUpgrade(
		new URL("http://localhost/live?previewToken=token"),
		createRequest("/live"),
		{
			isAllowedRuntimeSocketOrigin: () => true,
			isRuntimeSocketTokenValid: (token, scope) => {
				assert.equal(token, "token");
				assert.equal(scope, "browser-preview:workspace-1");
				return true;
			},
			paramName: "previewToken",
			runtimeAdminRequired: true,
			runtimeAdminToken: "secret",
			scope: "browser-preview:workspace-1",
		},
	);

	assert.deepEqual(result, { ok: true });
});

test("verifyRuntimeSocketUpgrade rejects invalid tokens with token-dependent status", () => {
	const withAdminToken = verifyRuntimeSocketUpgrade(
		new URL("http://localhost/live"),
		createRequest("/live"),
		{
			isAllowedRuntimeSocketOrigin: () => true,
			isRuntimeSocketTokenValid: () => false,
			paramName: "previewToken",
			runtimeAdminRequired: true,
			runtimeAdminToken: "secret",
			scope: "browser-preview:workspace-1",
		},
	);
	assert.deepEqual(withAdminToken, { ok: false, statusCode: 403, message: "Forbidden" });

	const requiredWithoutAdminToken = verifyRuntimeSocketUpgrade(
		new URL("http://localhost/live"),
		createRequest("/live"),
		{
			isAllowedRuntimeSocketOrigin: () => true,
			isRuntimeSocketTokenValid: () => false,
			paramName: "previewToken",
			runtimeAdminRequired: true,
			runtimeAdminToken: null,
			scope: "browser-preview:workspace-1",
		},
	);
	assert.deepEqual(requiredWithoutAdminToken, {
		ok: false,
		statusCode: 503,
		message: "Service Unavailable",
	});
});

test("registerBackendWebSocketRelays dispatches browser preview and realtime upgrades", () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			isRuntimeSocketTokenValid: (token, scope) => {
				return token === scope;
			},
			runtimeAdminToken: "secret",
		}),
		webSocketImpl,
	});

	const realtimeWss = instances[0];
	const browserPreviewWss = instances[1];
	const upgradeHandler = server.handlers.get("upgrade");
	assert.equal(typeof upgradeHandler, "function");

	const browserSocket = createSocket();
	upgradeHandler(
		// The id is decoded once (`%2D` is "-"); ids are UUIDs, never spaces or slashes.
		createRequest("/api/browser-workspaces/workspace%2D1/live?previewToken=browser-preview%3Aworkspace-1"),
		browserSocket,
		Buffer.from("browser-head"),
	);
	assert.equal(browserSocket.destroyed, false);
	assert.equal(browserPreviewWss.handledUpgrades.length, 1);
	assert.equal(browserPreviewWss.emitted[0].eventName, "connection");
	assert.equal(browserPreviewWss.emitted[0].args[2], "workspace-1");

	const realtimeSocket = createSocket();
	upgradeHandler(
		createRequest("/api/realtime/audio-conversation?realtimeToken=realtime%3Aaudio-conversation"),
		realtimeSocket,
		Buffer.from("realtime-head"),
	);
	assert.equal(realtimeSocket.destroyed, false);
	assert.equal(realtimeWss.handledUpgrades.length, 1);
	assert.equal(realtimeWss.emitted[0].eventName, "connection");
});

test("registerBackendWebSocketRelays rejects invalid upgrades and destroys unknown paths", () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			isRuntimeSocketTokenValid: () => false,
			runtimeAdminToken: "secret",
		}),
		webSocketImpl,
	});
	const upgradeHandler = server.handlers.get("upgrade");

	const invalidTokenSocket = createSocket();
	upgradeHandler(
		createRequest("/api/browser-workspaces/workspace-1/live?previewToken=wrong"),
		invalidTokenSocket,
		Buffer.from("head"),
	);
	assert.equal(invalidTokenSocket.destroyed, true);
	assert.equal(invalidTokenSocket.writes[0], "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
	assert.equal(instances[1].handledUpgrades.length, 0);

	const unknownSocket = createSocket();
	upgradeHandler(createRequest("/unknown"), unknownSocket, Buffer.from("head"));
	assert.equal(unknownSocket.destroyed, true);
	assert.deepEqual(unknownSocket.writes, []);
});

test("browser preview connection attaches, forwards controls, and detaches clients", async () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	const browserWorkspaceManager = createBrowserWorkspaceManager();
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({ browserWorkspaceManager }),
		webSocketImpl,
	});

	const browserPreviewWss = instances[1];
	const ws = createFakeWs();
	browserPreviewWss.listeners.get("connection")(ws, {}, "workspace-1");
	await Promise.resolve();

	ws.listeners.get("message")(JSON.stringify({ type: "click", x: 1 }));
	await Promise.resolve();
	ws.listeners.get("close")();
	await Promise.resolve();

	assert.deepEqual(browserWorkspaceManager.calls.map((call) => call.method), [
		"attachWorkspacePreviewClient",
		"handleWorkspacePreviewControlMessage",
		"detachWorkspacePreviewClient",
	]);
	assert.deepEqual(browserWorkspaceManager.calls[1].payload, { type: "click", x: 1 });
});

test("a preview socket for a deleted workspace gets a preview error instead of throwing out of the socket listeners", async (t) => {
	// The real manager, not the async fake: on main its lookups threw synchronously,
	// past the `.catch` in the listeners, and a throw from a socket listener exits
	// the backend (server.js uncaughtException handler).
	const { BrowserWorkspaceManager } = require("../lib/browser-workspace-manager");
	const browserWorkspaceManager = new BrowserWorkspaceManager({ cleanupIntervalMs: 1_000_000 });
	t.after(() => clearInterval(browserWorkspaceManager._cleanupTimer));
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({ browserWorkspaceManager }),
		webSocketImpl,
	});

	const ws = createFakeWs();
	assert.doesNotThrow(() => instances[1].listeners.get("connection")(ws, {}, "deleted-workspace"));
	await new Promise(setImmediate);
	assert.deepEqual(ws.sent.map((payload) => JSON.parse(payload)), [
		{ type: "preview-error", message: "Browser workspace not found: deleted-workspace" },
	]);
	assert.equal(ws.closed, true);
	assert.doesNotThrow(() => ws.listeners.get("close")());
	assert.doesNotThrow(() => ws.listeners.get("error")(new Error("reset")));
	await new Promise(setImmediate);
});

test("browser preview connection uses mirror browsers before workspace manager", () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	const browserWorkspaceManager = createBrowserWorkspaceManager();
	const mirrorCalls = [];
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			browserWorkspaceManager,
			getMirrorBrowser: (workspaceId) => ({
				attachClient: (ws) => mirrorCalls.push({ workspaceId, ws }),
			}),
		}),
		webSocketImpl,
	});

	const browserPreviewWss = instances[1];
	const ws = createFakeWs();
	browserPreviewWss.listeners.get("connection")(ws, {}, "workspace-1");

	assert.equal(mirrorCalls.length, 1);
	assert.deepEqual(browserWorkspaceManager.calls, []);
});
