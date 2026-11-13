// Initialize console early for startup debugging
console.log("[STARTUP] Server process starting...");
console.error("[STARTUP] Startup initiated");

// Try to load .env.local if it exists, but don't fail if it doesn't
try {
	require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
	console.log("[STARTUP] .env.local loaded");
} catch {
	console.log("[STARTUP] .env.local not found, using environment variables only");
}

const {
	ensureBrowserRuntimeEnvDefaults,
} = require("./lib/browser-runtime-config");

const browserRuntimeDefaults = ensureBrowserRuntimeEnvDefaults();
if (browserRuntimeDefaults.changed) {
	console.log(
		`[STARTUP] Defaulted ROVO_BROWSER_MODE=${browserRuntimeDefaults.browserMode} (${browserRuntimeDefaults.reason})`
	);
}

const express = require("express");
const http = require("http");
const path = require("path");
const {
	createBackendRuntimeComposition,
} = require("./server-runtime-composition");
const {
	logBackendServerReady,
} = require("./server-startup");
const {
	registerStaticExportServing,
} = require("./lib/static-export-serving");
const {
	registerBackendWebSocketRelays,
} = require("./realtime/ws-relay");
const { loadAiSdk } = require("./lib/ai-sdk-runtime");
const { resolveBackendListenHost } = require("./middleware/local-only");
const { registerFinalErrorHandlers } = require("./middleware/error-response");
const {
	createBackendProcess,
	createHttpServerShutdownSteps,
	refuseRequestsWhileDraining,
} = require("./lib/backend-shutdown");

console.log("[STARTUP] Dependencies loaded");

let runtime = null;
let server = null;
let webSocketServers = [];

const serverShutdownSteps = createHttpServerShutdownSteps({
	getServer: () => server,
	getWebSocketServers: () => webSocketServers,
});

// starting -> listening -> draining -> stopped. Shutdown order: stop accepting
// connections, abort in-flight runs, close browser workspaces, shut the Rovo pool,
// close the remaining connections, exit.
const backendProcess = createBackendProcess({
	getSteps: () => [
		serverShutdownSteps.stopAccepting,
		...(runtime?.shutdownSteps ?? []),
		serverShutdownSteps.closeConnections,
	],
});

async function startServer() {
	await loadAiSdk();
	if (!backendProcess.isStarting()) {
		return;
	}

	runtime = createBackendRuntimeComposition();

	const publicPath = path.join(__dirname, "public");
	registerStaticExportServing(runtime.app, {
		expressImpl: express,
		publicPath,
	});
	// Last on the stack: unanswered /api requests and every unhandled error get the shared JSON shape.
	registerFinalErrorHandlers(runtime.app);

	console.log("[STARTUP] All routes registered, starting HTTP server...");

	const requestHandler = refuseRequestsWhileDraining(runtime.app, {
		isDraining: () => backendProcess.getStatus() === "draining",
	});
	server = http.createServer(requestHandler).listen(runtime.port, resolveBackendListenHost(), async () => {
		if (!backendProcess.markListening()) {
			server.close();
			return;
		}
		const address = server.address();
		console.log(`[PROCESS] listening on ${address?.address}:${address?.port}`);
		await logBackendServerReady(runtime.serverReadyDependencies);
	});

	server.on("error", (err) => {
		console.error("Server error:", err);
		process.exit(1);
	});

	const { browserPreviewWss, realtimeWss } = registerBackendWebSocketRelays(server, runtime.webSocketRelayDependencies);
	webSocketServers = [browserPreviewWss, realtimeWss];
}

void startServer().catch((error) => {
	console.error("[STARTUP] Failed to initialize backend runtime:", error);
	process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
	console.error("Uncaught exception:", err);
	process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled rejection at:", promise, "reason:", reason);
	process.exit(1);
});

process.on("SIGINT", () => backendProcess.handleSignal("SIGINT"));
process.on("SIGTERM", () => backendProcess.handleSignal("SIGTERM"));
