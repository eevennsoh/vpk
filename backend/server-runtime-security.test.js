const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverPath = path.join(process.cwd(), "backend/server.js");
const serverSource = fs.readFileSync(serverPath, "utf8");
const appPath = path.join(process.cwd(), "backend/app.js");
const appSource = fs.readFileSync(appPath, "utf8");
const bodyLimitsPath = path.join(process.cwd(), "backend/middleware/body-limits.js");
const bodyLimitsSource = fs.readFileSync(bodyLimitsPath, "utf8");
const rateLimitsPath = path.join(process.cwd(), "backend/middleware/rate-limit.js");
const rateLimitsSource = fs.readFileSync(rateLimitsPath, "utf8");
const runtimeAdminPath = path.join(process.cwd(), "backend/middleware/runtime-admin.js");
const runtimeAdminSource = fs.readFileSync(runtimeAdminPath, "utf8");
const securityPath = path.join(process.cwd(), "backend/middleware/security.js");
const securitySource = fs.readFileSync(securityPath, "utf8");
const wsRelayPath = path.join(process.cwd(), "backend/realtime/ws-relay.js");
const wsRelaySource = fs.readFileSync(wsRelayPath, "utf8");
const realtimeRoutePath = path.join(process.cwd(), "backend/routes/realtime.js");
const realtimeRouteSource = fs.readFileSync(realtimeRoutePath, "utf8");
const {
	collectRouteManifest,
} = require("./routes/route-manifest");
const routeManifest = collectRouteManifest();

function assertRouteUsesRuntimeAdmin(method, routePath) {
	const route = routeManifest.backendRoutes.find((entry) => {
		return entry.method === method.toUpperCase() && entry.path === routePath;
	});
	assert.ok(route, `${method.toUpperCase()} ${routePath} should be registered`);
	assert.equal(route.runtimeAdmin, true, `${method.toUpperCase()} ${routePath} should require runtime admin`);
}

test("runtime-control mutations require runtime admin authorization", () => {
	for (const [method, routePath] of [
		["post", "/api/checkpoints"],
		["post", "/api/checkpoints/:id/rollback"],
		["delete", "/api/checkpoints/:id"],
		["post", "/api/rovo/threads/:threadId/browser-workspace"],
		["delete", "/api/rovo/threads/:threadId/browser-workspace"],
		["delete", "/api/orchestrator/log"],
	]) {
		assertRouteUsesRuntimeAdmin(method, routePath);
	}

	const browserWorkspaceRoutes = routeManifest.backendRoutes.filter((entry) => {
		return entry.path.startsWith("/api/browser-workspaces");
	});
	assert.equal(browserWorkspaceRoutes.length, 12, "browser workspace routes should remain registered");
	for (const route of browserWorkspaceRoutes) {
		assert.equal(route.runtimeAdmin, true, `${route.method} ${route.path} should require runtime admin`);
	}

});

test("realtime token minting is reachable through the runtime socket origin gate", () => {
	const route = routeManifest.backendRoutes.find((entry) => {
		return entry.method === "GET" && entry.path === "/api/realtime/audio-conversation-token";
	});
	assert.ok(route, "GET /api/realtime/audio-conversation-token should be registered");
	assert.equal(route.runtimeAdmin, false);
	assert.match(route.source, /^backend\/routes\/realtime\.js:/u);
	assert.match(
		realtimeRouteSource,
		/router\.get\("\/audio-conversation-token", requireRuntimeSocketTokenRequester/u,
	);
	assert.match(runtimeAdminSource, /function requireRuntimeSocketTokenRequester/u);
	assert.match(realtimeRouteSource, /REALTIME_AUDIO_CONVERSATION_SCOPE = "realtime:audio-conversation"/u);
	assert.match(realtimeRouteSource, /createRuntimeSocketToken\(REALTIME_AUDIO_CONVERSATION_SCOPE\)/u);
});

test("runtime admin fails closed in production when token is missing", () => {
	assert.match(runtimeAdminSource, /env\.NODE_ENV === "production"/u);
	assert.match(runtimeAdminSource, /VPK_RUNTIME_ADMIN_TOKEN is required/u);
	assert.match(runtimeAdminSource, /exit\(1\)/u);
	assert.match(appSource, /createRuntimeAdmin\(\{ allowedOrigins \}\)/u);
});

test("websocket upgrades validate origin and runtime token before upgrade", () => {
	assert.match(runtimeAdminSource, /function createRuntimeSocketToken/u);
	assert.match(serverSource, /registerBackendWebSocketRelays\(server/u);
	assert.match(wsRelaySource, /function verifyRuntimeSocketUpgrade/u);
	assert.match(runtimeAdminSource, /function isAllowedRuntimeSocketOrigin/u);
	assert.match(runtimeAdminSource, /isRuntimeSocketOriginAllowed\(\s*origin,\s*request\.headers\.host,\s*resolvedAllowedOrigins/u);
	assert.match(wsRelaySource, /!isAllowedRuntimeSocketOrigin\(origin, request\)/u);
	assert.match(wsRelaySource, /isRuntimeSocketTokenValid\(socketToken, scope\)/u);
	assert.match(wsRelaySource, /previewToken/u);
	assert.match(wsRelaySource, /realtimeToken/u);
	assert.match(wsRelaySource, /browserPreviewWss\.handleUpgrade/u);
	assert.match(wsRelaySource, /realtimeWss\.handleUpgrade/u);
});

test("costly or mutating body routes have route-scoped rate and size limits", () => {
	for (const routePath of [
		"/api/chat-sdk",
		"/api/rovo/suggestions",
		"/api/sound-generation",
		"/api/speech-transcription",
		"/api/rovo/files/upload",
	]) {
		assert.match(rateLimitsSource, new RegExp(routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
	}

	assert.match(appSource, /registerSecurity = registerSecurityMiddleware/u);
	assert.match(appSource, /const \{ allowedOrigins \} = registerSecurity\(app\);/u);
	assert.match(securitySource, /CONTENT_SECURITY_POLICY_DIRECTIVES/u);
	assert.match(securitySource, /DEFAULT_ALLOWED_ORIGINS/u);
	assert.match(appSource, /registerAiCostRateLimit = registerAiCostRateLimitMiddleware/u);
	assert.match(appSource, /registerAiCostRateLimit\(app\);/u);
	assert.match(rateLimitsSource, /AI_COST_RATE_LIMIT_MAX = 60/u);
	assert.match(rateLimitsSource, /AI_COST_RATE_LIMIT_WINDOW_MS = 60_000/u);
	assert.match(appSource, /registerBodyLimit = registerBodyLimitMiddleware/u);
	assert.match(appSource, /registerBodyLimit\(app, \{ expressImpl \}\);/u);
	assert.match(bodyLimitsSource, /paths: \["\/api\/chat-sdk", "\/api\/rovo\/suggestions"\][\s\S]*limit: "8mb"/u);
	assert.match(bodyLimitsSource, /paths: \["\/api\/sound-generation", "\/api\/speech-transcription"\][\s\S]*limit: "12mb"/u);
	assert.match(bodyLimitsSource, /paths: "\/api\/rovo\/files\/upload"[\s\S]*limit: "12mb"/u);
	assert.match(bodyLimitsSource, /FALLBACK_BODY_LIMIT = "50mb"/u);
});


test("removed control-plane API routes have no registered handlers", () => {
	for (const route of [...routeManifest.backendRoutes, ...routeManifest.nextApiRoutes]) {
		const routePath = route.path ?? route.nextPath;
		assert.equal(/^\/api\/(?:jobs|skills|wiki)(?:\/|$)/u.test(routePath), false, routePath);
		assert.notEqual(routePath, "/api/status/hermes");
	}
});
