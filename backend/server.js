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

console.log("[STARTUP] Dependencies loaded");

let shutdownRuntime = () => {};

async function startServer() {
	await loadAiSdk();

	const runtime = createBackendRuntimeComposition();
	shutdownRuntime = runtime.shutdownRuntime;

	const publicPath = path.join(__dirname, "public");
	registerStaticExportServing(runtime.app, {
		expressImpl: express,
		publicPath,
	});

	console.log("[STARTUP] All routes registered, starting HTTP server...");

	const server = runtime.app.listen(runtime.port, resolveBackendListenHost(), async () => {
		await logBackendServerReady(runtime.serverReadyDependencies);
	});

	server.on("error", (err) => {
		console.error("Server error:", err);
		process.exit(1);
	});

	registerBackendWebSocketRelays(server, runtime.webSocketRelayDependencies);
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

// Graceful shutdown — clean up Rovo pool
process.on("SIGINT", () => {
	shutdownRuntime();
	process.exit(0);
});
process.on("SIGTERM", () => {
	shutdownRuntime();
	process.exit(0);
});
