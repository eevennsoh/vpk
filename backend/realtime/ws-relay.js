"use strict";

const WebSocket = require("ws");

const { RealtimeSession } = require("../lib/openai-realtime");
const { isStorageId } = require("../lib/input-schemas");
const { getNonEmptyString } = require("../lib/shared-utils");

function getRuntimeSocketTokenFromUpgrade(requestUrl, paramName) {
	return (
		getNonEmptyString(requestUrl.searchParams.get(paramName)) ??
		getNonEmptyString(requestUrl.searchParams.get("socketToken"))
	);
}

function rejectUpgrade(socket, statusCode, message) {
	socket.write(
		`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
	);
	socket.destroy();
}

function verifyRuntimeSocketUpgrade(requestUrl, request, {
	isAllowedRuntimeSocketOrigin,
	isRuntimeSocketTokenValid,
	paramName,
	runtimeAdminRequired,
	runtimeAdminToken,
	scope,
}) {
	const origin = getNonEmptyString(request.headers.origin);
	if (!isAllowedRuntimeSocketOrigin(origin, request)) {
		return { ok: false, statusCode: 403, message: "Forbidden" };
	}

	if (!runtimeAdminToken && !runtimeAdminRequired) {
		return { ok: true };
	}

	const socketToken = getRuntimeSocketTokenFromUpgrade(requestUrl, paramName);
	if (isRuntimeSocketTokenValid(socketToken, scope)) {
		return { ok: true };
	}

	return {
		ok: false,
		statusCode: runtimeAdminToken ? 403 : 503,
		message: runtimeAdminToken ? "Forbidden" : "Service Unavailable",
	};
}

// Frame caps (provisional). ws buffers up to 100 MiB per frame by default and closes a
// socket that sends more than its cap with 1009.
// Realtime: an audio chunk is 4096 samples resampled to 24 kHz PCM16, about 6 KiB of
// base64; the largest client frame is a context_inject carrying thread context text.
const REALTIME_MAX_PAYLOAD_BYTES = 1024 * 1024;
// Preview: control messages only (pointer, wheel, key, sync, and paste text).
const PREVIEW_MAX_PAYLOAD_BYTES = 256 * 1024;

const BROWSER_PREVIEW_PATH = /^\/api\/browser-workspaces\/(?<workspaceId>[^/]+)\/live$/u;

/**
 * The upgrade's URL and, for a browser preview, its workspace id. Never throws.
 * @param {string | undefined} rawUrl
 * @returns {{ ok: true, requestUrl: URL, workspaceId: string | null } | { ok: false }}
 */
function parseUpgradeTarget(rawUrl) {
	let requestUrl;
	try {
		requestUrl = new URL(rawUrl || "/", "http://127.0.0.1");
	} catch {
		return { ok: false };
	}
	const encodedWorkspaceId = requestUrl.pathname.match(BROWSER_PREVIEW_PATH)?.groups?.workspaceId;
	if (!encodedWorkspaceId) {
		return { ok: true, requestUrl, workspaceId: null };
	}
	let workspaceId;
	try {
		workspaceId = decodeURIComponent(encodedWorkspaceId);
	} catch {
		return { ok: false };
	}
	return isStorageId(workspaceId) ? { ok: true, requestUrl, workspaceId } : { ok: false };
}

/**
 * Wraps a socket or server listener. Anything thrown in an event listener (and a rejected
 * promise it returns) would reach uncaughtException or unhandledRejection, which exit the
 * backend; here it is logged and `onError` ends that one socket instead.
 * @param {string} label
 * @param {(...args: unknown[]) => unknown} listener
 * @param {{ consoleImpl: Pick<Console, "error">, onError: (...args: unknown[]) => void }} options
 */
function guardListener(label, listener, { consoleImpl, onError }) {
	const fail = (args, error) => {
		consoleImpl.error(`[WS] ${label} failed:`, error instanceof Error ? error.message : String(error));
		try {
			onError(...args);
		} catch {}
	};
	return (...args) => {
		try {
			const result = listener(...args);
			if (result && typeof result.then === "function") {
				result.then(undefined, (error) => fail(args, error));
			}
		} catch (error) {
			fail(args, error);
		}
	};
}

function closeSocket(ws) {
	try {
		ws.close(1011, "Internal error");
	} catch {
		ws.terminate?.();
	}
}

function sendPreviewError(ws, error, fallback) {
	try {
		ws.send(JSON.stringify({ type: "preview-error", message: error instanceof Error ? error.message : fallback }));
	} catch {}
}

function registerBackendWebSocketRelays(server, {
	browserWorkspaceManager,
	consoleImpl = console,
	debugMode = false,
	getMirrorBrowser,
	isAllowedRuntimeSocketOrigin,
	isDraining = /** @returns {boolean} */ () => false,
	isRuntimeSocketTokenValid,
	realtimeSessionImpl = RealtimeSession,
	runtimeAdminRequired,
	runtimeAdminToken,
	webSocketImpl = WebSocket,
} = {}) {
	if (!server || typeof server.on !== "function") {
		throw new Error("registerBackendWebSocketRelays requires an HTTP server");
	}
	if (!browserWorkspaceManager) {
		throw new Error("registerBackendWebSocketRelays requires browserWorkspaceManager");
	}
	for (const method of [
		"attachWorkspacePreviewClient",
		"detachWorkspacePreviewClient",
		"handleWorkspacePreviewControlMessage",
	]) {
		if (typeof browserWorkspaceManager[method] !== "function") {
			throw new Error(`registerBackendWebSocketRelays requires browserWorkspaceManager.${method}`);
		}
	}
	if (typeof getMirrorBrowser !== "function") {
		throw new Error("registerBackendWebSocketRelays requires getMirrorBrowser");
	}
	if (typeof isAllowedRuntimeSocketOrigin !== "function") {
		throw new Error("registerBackendWebSocketRelays requires isAllowedRuntimeSocketOrigin");
	}
	if (typeof isRuntimeSocketTokenValid !== "function") {
		throw new Error("registerBackendWebSocketRelays requires isRuntimeSocketTokenValid");
	}
	if (typeof isDraining !== "function") {
		throw new Error("registerBackendWebSocketRelays requires isDraining to be a function");
	}
	if (typeof realtimeSessionImpl !== "function") {
		throw new Error("registerBackendWebSocketRelays requires realtimeSessionImpl");
	}
	if (!webSocketImpl?.Server) {
		throw new Error("registerBackendWebSocketRelays requires webSocketImpl.Server");
	}

	const realtimeWss = new webSocketImpl.Server({ noServer: true, maxPayload: REALTIME_MAX_PAYLOAD_BYTES });
	const browserPreviewWss = new webSocketImpl.Server({ noServer: true, maxPayload: PREVIEW_MAX_PAYLOAD_BYTES });
	const verifyUpgrade = (requestUrl, request, options) => {
		return verifyRuntimeSocketUpgrade(requestUrl, request, {
			isAllowedRuntimeSocketOrigin,
			isRuntimeSocketTokenValid,
			runtimeAdminRequired,
			runtimeAdminToken,
			...options,
		});
	};

	server.on("upgrade", guardListener("upgrade", (request, socket, head) => {
		// Once shutdown has begun, an upgrade can still arrive on a keep-alive connection
		// that stayed open; it would start a preview or realtime session after the runs
		// were aborted. Like refuseRequestsWhileDraining for HTTP, it gets 503.
		if (isDraining()) {
			rejectUpgrade(socket, 503, "Service Unavailable");
			return;
		}
		// Anything thrown in this listener exits the backend, so every input is parsed
		// without throwing: the path and query against a fixed base (the Host header is
		// not needed and may not be a valid host), and the workspace id as a storage id.
		const target = parseUpgradeTarget(request.url);
		if (!target.ok) {
			rejectUpgrade(socket, 400, "Bad Request");
			return;
		}
		const { requestUrl, workspaceId } = target;
		if (workspaceId !== null) {
			const verification = verifyUpgrade(requestUrl, request, {
				scope: `browser-preview:${workspaceId}`,
				paramName: "previewToken",
			});
			if (!verification.ok) {
				rejectUpgrade(socket, verification.statusCode, verification.message);
				return;
			}
			browserPreviewWss.handleUpgrade(request, socket, head, (ws) => {
				browserPreviewWss.emit("connection", ws, request, workspaceId);
			});
			return;
		}

		if (requestUrl.pathname === "/api/realtime/audio-conversation") {
			const verification = verifyUpgrade(requestUrl, request, {
				scope: "realtime:audio-conversation",
				paramName: "realtimeToken",
			});
			if (!verification.ok) {
				rejectUpgrade(socket, verification.statusCode, verification.message);
				return;
			}
			realtimeWss.handleUpgrade(request, socket, head, (ws) => {
				realtimeWss.emit("connection", ws, request);
			});
			return;
		}

		socket.destroy();
	}, {
		consoleImpl,
		onError: (_request, socket) => {
			if (socket.writable) {
				rejectUpgrade(socket, 500, "Internal Server Error");
			} else {
				socket.destroy();
			}
		},
	}));

	realtimeWss.on("connection", guardListener("realtime connection", (ws) => {
		consoleImpl.log("[REALTIME] Client connected to /api/realtime/audio-conversation");
		const onError = () => closeSocket(ws);

		const session = new realtimeSessionImpl(ws, {
			onLog: (section, message) => {
				if (debugMode) {
					consoleImpl.log(`[DEBUG][${section}] ${message}`);
				} else {
					consoleImpl.log(`[${section}] ${message}`);
				}
			},
		});

		ws.on("message", guardListener("realtime message", (data) => {
			session.handleClientMessage(data.toString());
		}, { consoleImpl, onError }));

		ws.on("close", guardListener("realtime close", () => {
			consoleImpl.log("[REALTIME] Client disconnected");
			session.close();
		}, { consoleImpl, onError: () => {} }));

		ws.on("error", guardListener("realtime socket error", (err) => {
			consoleImpl.error("[REALTIME] Client WS error:", err.message);
			session.close();
		}, { consoleImpl, onError: () => {} }));

		// connect() is async: a rejection would be unhandled, which exits the backend.
		return session.connect();
	}, { consoleImpl, onError: (ws) => closeSocket(ws) }));

	browserPreviewWss.on("connection", guardListener("preview connection", (ws, _request, workspaceId) => {
		const mirrorBrowser = getMirrorBrowser(workspaceId);
		if (mirrorBrowser) {
			mirrorBrowser.attachClient(ws);
			return;
		}

		// The error reply goes through the guarded send and close: a throw here (a socket
		// that already closed) would be an unhandled rejection, which exits the backend.
		void Promise.resolve()
			.then(() => browserWorkspaceManager.attachWorkspacePreviewClient(workspaceId, ws))
			.catch((error) => {
				sendPreviewError(ws, error, "Failed to attach browser preview client.");
				try {
					ws.close();
				} catch {
					ws.terminate?.();
				}
			});

		ws.on("message", guardListener("preview message", (data) => {
			let payload;
			try {
				payload = JSON.parse(String(data));
			} catch (error) {
				sendPreviewError(ws, error, "Invalid browser preview message.");
				return;
			}
			if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
				sendPreviewError(ws, null, "Invalid browser preview message.");
				return;
			}
			// A throw (missing workspace) or a rejected action is answered on the socket.
			return Promise.resolve()
				.then(() => browserWorkspaceManager.handleWorkspacePreviewControlMessage(workspaceId, payload))
				.catch((error) => sendPreviewError(ws, error, "Browser preview action failed."));
		}, { consoleImpl, onError: () => closeSocket(ws) }));

		const detach = guardListener("preview detach", () =>
			Promise.resolve()
				.then(() => browserWorkspaceManager.detachWorkspacePreviewClient(workspaceId, ws))
				.catch(() => {}), { consoleImpl, onError: () => {} });
		ws.on("close", detach);
		ws.on("error", detach);
	}, { consoleImpl, onError: (ws) => closeSocket(ws) }));

	return {
		browserPreviewWss,
		realtimeWss,
	};
}

module.exports = {
	PREVIEW_MAX_PAYLOAD_BYTES,
	REALTIME_MAX_PAYLOAD_BYTES,
	guardListener,
	parseUpgradeTarget,
	getRuntimeSocketTokenFromUpgrade,
	registerBackendWebSocketRelays,
	rejectUpgrade,
	verifyRuntimeSocketUpgrade,
};
