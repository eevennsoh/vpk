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

	const realtimeWss = new webSocketImpl.Server({ noServer: true });
	const browserPreviewWss = new webSocketImpl.Server({ noServer: true });
	const verifyUpgrade = (requestUrl, request, options) => {
		return verifyRuntimeSocketUpgrade(requestUrl, request, {
			isAllowedRuntimeSocketOrigin,
			isRuntimeSocketTokenValid,
			runtimeAdminRequired,
			runtimeAdminToken,
			...options,
		});
	};

	server.on("upgrade", (request, socket, head) => {
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
	});

	realtimeWss.on("connection", (ws) => {
		consoleImpl.log("[REALTIME] Client connected to /api/realtime/audio-conversation");

		const session = new realtimeSessionImpl(ws, {
			onLog: (section, message) => {
				if (debugMode) {
					consoleImpl.log(`[DEBUG][${section}] ${message}`);
				} else {
					consoleImpl.log(`[${section}] ${message}`);
				}
			},
		});

		session.connect();

		ws.on("message", (data) => {
			session.handleClientMessage(data.toString());
		});

		ws.on("close", () => {
			consoleImpl.log("[REALTIME] Client disconnected");
			session.close();
		});

		ws.on("error", (err) => {
			consoleImpl.error("[REALTIME] Client WS error:", err.message);
			session.close();
		});
	});

	browserPreviewWss.on("connection", (ws, _request, workspaceId) => {
		const mirrorBrowser = getMirrorBrowser(workspaceId);
		if (mirrorBrowser) {
			mirrorBrowser.attachClient(ws);
			return;
		}

		void browserWorkspaceManager.attachWorkspacePreviewClient(workspaceId, ws).catch(
			(error) => {
				const message =
					error instanceof Error
						? error.message
						: "Failed to attach browser preview client.";
				ws.send(
					JSON.stringify({
						type: "preview-error",
						message,
					}),
				);
				ws.close();
			},
		);

		ws.on("message", (data) => {
			try {
				const payload = JSON.parse(String(data));
				void browserWorkspaceManager.handleWorkspacePreviewControlMessage(
					workspaceId,
					payload,
				);
			} catch (error) {
				ws.send(
					JSON.stringify({
						type: "preview-error",
						message:
							error instanceof Error
								? error.message
								: "Invalid browser preview message.",
					}),
				);
			}
		});

		ws.on("close", () => {
			void browserWorkspaceManager
				.detachWorkspacePreviewClient(workspaceId, ws)
				.catch(() => {});
		});

		ws.on("error", () => {
			void browserWorkspaceManager
				.detachWorkspacePreviewClient(workspaceId, ws)
				.catch(() => {});
		});
	});

	return {
		browserPreviewWss,
		realtimeWss,
	};
}

module.exports = {
	parseUpgradeTarget,
	getRuntimeSocketTokenFromUpgrade,
	registerBackendWebSocketRelays,
	rejectUpgrade,
	verifyRuntimeSocketUpgrade,
};
