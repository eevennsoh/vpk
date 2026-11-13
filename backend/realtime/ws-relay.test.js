"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	WS_MAX_PAYLOAD_BYTES,
	getRuntimeSocketTokenFromUpgrade,
	guardListener,
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

test("while the backend drains, every upgrade gets 503 before any check or handshake", () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	let draining = false;
	const tokenChecks = [];
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			isRuntimeSocketTokenValid: (token, scope) => {
				tokenChecks.push(scope);
				return token === scope;
			},
			runtimeAdminToken: "secret",
		}),
		isDraining: () => draining,
		webSocketImpl,
	});
	const [realtimeWss, browserPreviewWss] = instances;
	const upgradeHandler = server.handlers.get("upgrade");

	draining = true;
	const sockets = [];
	for (const url of [
		"/api/browser-workspaces/workspace-1/live?previewToken=browser-preview%3Aworkspace-1",
		"/api/realtime/audio-conversation?realtimeToken=realtime%3Aaudio-conversation",
		"/api/browser-workspaces/%E0%A4%A/live",
	]) {
		const socket = createSocket();
		upgradeHandler(createRequest(url), socket, Buffer.from("head"));
		sockets.push(socket);
	}
	for (const socket of sockets) {
		assert.equal(socket.destroyed, true);
		assert.match(socket.writes.join(""), /^HTTP\/1\.1 503 Service Unavailable\r\nConnection: close\r\n/u);
	}
	assert.equal(browserPreviewWss.handledUpgrades.length, 0);
	assert.equal(realtimeWss.handledUpgrades.length, 0);
	assert.deepEqual(tokenChecks, []);

	// Before the drain the same upgrade is handled.
	draining = false;
	upgradeHandler(
		createRequest("/api/browser-workspaces/workspace-1/live?previewToken=browser-preview%3Aworkspace-1"),
		createSocket(),
		Buffer.from("head"),
	);
	assert.equal(browserPreviewWss.handledUpgrades.length, 1);
});

test("registerBackendWebSocketRelays requires isDraining to be a function", () => {
	assert.throws(
		() => registerBackendWebSocketRelays(createFakeServer(), {
			...createRegistrationDependencies(),
			isDraining: true,
			webSocketImpl: createFakeWebSocketImpl().webSocketImpl,
		}),
		/isDraining/u,
	);
});

test("guardListener turns a throw or a rejection into a log line and onError, never an escape", async () => {
	const errors = [];
	const handled = [];
	const consoleImpl = { error: (...args) => errors.push(args.join(" ")) };
	const throwing = guardListener("sync", () => {
		throw new Error("boom");
	}, { consoleImpl, onError: (...args) => handled.push(["sync", ...args]) });
	const rejecting = guardListener("async", async () => {
		throw new Error("later");
	}, { consoleImpl, onError: (...args) => handled.push(["async", ...args]) });
	const failingOnError = guardListener("onError throws", () => {
		throw new Error("first");
	}, { consoleImpl, onError: () => {
		throw new Error("second");
	} });

	assert.doesNotThrow(() => throwing("a"));
	assert.doesNotThrow(() => rejecting("b"));
	assert.doesNotThrow(() => failingOnError());
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(handled, [["sync", "a"], ["async", "b"]]);
	assert.equal(errors.length, 3);
});

test("an exception nobody anticipated in the upgrade path rejects that socket and leaves the listener intact", () => {
	const server = createFakeServer();
	const { webSocketImpl } = createFakeWebSocketImpl();
	let calls = 0;
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			isAllowedRuntimeSocketOrigin: () => {
				calls += 1;
				throw new Error("unexpected");
			},
		}),
		webSocketImpl,
	});
	const upgradeHandler = server.handlers.get("upgrade");
	for (let index = 0; index < 2; index += 1) {
		const socket = { ...createSocket(), writable: true };
		assert.doesNotThrow(() => upgradeHandler(createRequest("/api/realtime/audio-conversation"), socket, Buffer.from("")));
		assert.equal(socket.destroyed, true);
		assert.match(socket.writes.join(""), /^HTTP\/1\.1 500 Internal Server Error\r\n/u);
	}
	assert.equal(calls, 2);
});

test("realtime socket listeners never let a session error escape, including a rejected connect", async () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	const errors = [];
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			consoleImpl: { error: (...args) => errors.push(args.join(" ")), log: () => {} },
			realtimeSessionImpl: class RealtimeSession {
				async connect() {
					throw new Error("upstream refused");
				}
				close() {
					throw new Error("close failed");
				}
				handleClientMessage() {
					throw new Error("bad frame");
				}
			},
		}),
		webSocketImpl,
	});
	const [realtimeWss] = instances;
	server.handlers.get("upgrade")(
		createRequest("/api/realtime/audio-conversation?realtimeToken=realtime%3Aaudio-conversation"),
		createSocket(),
		Buffer.from(""),
	);
	const { ws } = realtimeWss.handledUpgrades[0];
	assert.doesNotThrow(() => ws.listeners.get("message")(Buffer.from("1")));
	assert.doesNotThrow(() => ws.listeners.get("close")());
	assert.doesNotThrow(() => ws.listeners.get("error")(new Error("socket")));
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(ws.closed, true, "a socket whose session failed is closed");
	assert.ok(errors.some((line) => line.includes("upstream refused")));
	assert.ok(errors.some((line) => line.includes("bad frame")));
});

test("preview control messages that are not objects, or whose action rejects, are answered on the socket", async () => {
	const server = createFakeServer();
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	registerBackendWebSocketRelays(server, {
		...createRegistrationDependencies({
			browserWorkspaceManager: createBrowserWorkspaceManager({
				handleWorkspacePreviewControlMessage: () => {
					throw new Error("Browser workspace not found: workspace-1");
				},
				detachWorkspacePreviewClient: () => Promise.reject(new Error("gone")),
			}),
		}),
		webSocketImpl,
	});
	const browserPreviewWss = instances[1];
	const ws = createFakeWs();
	browserPreviewWss.listeners.get("connection")(ws, {}, "workspace-1");
	for (const frame of ["[]", "null", "7", "not json", "{\"type\":\"preview-pointer\"}"]) {
		assert.doesNotThrow(() => ws.listeners.get("message")(Buffer.from(frame)));
	}
	assert.doesNotThrow(() => ws.listeners.get("close")());
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(ws.sent.length, 5);
	for (const payload of ws.sent) {
		assert.equal(JSON.parse(payload).type, "preview-error");
	}
});

test("both WebSocket servers cap a frame at WS_MAX_PAYLOAD_BYTES", () => {
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	registerBackendWebSocketRelays(createFakeServer(), { ...createRegistrationDependencies(), webSocketImpl });
	assert.equal(instances.length, 2);
	for (const instance of instances) {
		assert.deepEqual(instance.options, { noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });
	}
	assert.equal(WS_MAX_PAYLOAD_BYTES, 2 * 1024 * 1024);
});

test("a failed preview attach on a socket whose send and close throw never becomes an unhandled rejection", async (t) => {
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);
	t.after(() => process.off("unhandledRejection", onUnhandled));
	const { instances, webSocketImpl } = createFakeWebSocketImpl();
	registerBackendWebSocketRelays(createFakeServer(), {
		...createRegistrationDependencies({
			browserWorkspaceManager: createBrowserWorkspaceManager({
				attachWorkspacePreviewClient: async () => {
					throw new Error("attach failed");
				},
			}),
		}),
		webSocketImpl,
	});
	const ws = createFakeWs();
	let terminated = false;
	ws.send = () => {
		throw new Error("WebSocket is not open");
	};
	ws.close = () => {
		throw new Error("WebSocket is not open");
	};
	ws.terminate = () => {
		terminated = true;
	};
	instances[1].listeners.get("connection")(ws, {}, "workspace-1");
	await new Promise(setImmediate);
	await new Promise(setImmediate);
	assert.deepEqual(unhandled, []);
	assert.equal(terminated, true);
});
