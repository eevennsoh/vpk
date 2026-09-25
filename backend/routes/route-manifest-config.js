const SERVER_ROUTE_FILES = [
	{ calleeName: "app", filePath: "backend/server.js", prefix: "" },
	{ calleeName: "router", filePath: "backend/routes/personal-graph.js", prefix: "/api/personal-graph" },
	{ calleeName: "router", filePath: "backend/routes/status.js", prefix: "/api/status" },
	{ calleeName: "app", filePath: "backend/routes/status.js", prefix: "" },
	{ calleeName: "router", filePath: "backend/routes/vpk-html.js", prefix: "/api/vpk-html" },
	{ calleeName: "router", filePath: "backend/routes/html-selector.js", prefix: "/api/html-selector" },
	{ calleeName: "router", filePath: "backend/routes/media.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/orchestrator.js", prefix: "/api/orchestrator" },
	{ calleeName: "router", filePath: "backend/routes/demos.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/browser-workspaces.js", prefix: "/api/browser-workspaces" },
	{ calleeName: "router", filePath: "backend/routes/chromium-preview.js", prefix: "/api/chromium-preview" },
	{ calleeName: "router", filePath: "backend/routes/rovo-app.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/rovo-chat-proxy.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/realtime.js", prefix: "/api/realtime" },
	{ calleeName: "router", filePath: "backend/routes/ai-utilities.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/chat-control.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/chat-sdk.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/agent-mode.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/genui.js", prefix: "/api" },
	{ calleeName: "router", filePath: "backend/routes/chat-skip-question.js", prefix: "/api" },
];

const LOCAL_NEXT_API_ROUTES = new Map([
	[
		"GET /api/realtime/ws-url",
		"Route-local dev helper: resolves the direct backend WebSocket URL because the Next proxy cannot proxy WebSocket upgrades.",
	],
	[
		"POST /api/sprint-board/tasks",
		"Route-local demo mutation handler; it does not proxy to the Express backend.",
	],
]);

const PROXY_TARGET_FANOUT_EXCEPTIONS = [
	{
		nextRoute: "POST /api/chromium-preview/:action",
		reason: "Route-local action validation fans one dynamic Next segment out to static backend Chromium preview action endpoints.",
		target: "POST /api/chromium-preview/:action",
		backedBy: [
			"POST /api/chromium-preview/back",
			"POST /api/chromium-preview/click",
			"POST /api/chromium-preview/click-ref",
			"POST /api/chromium-preview/fill-ref",
			"POST /api/chromium-preview/forward",
			"POST /api/chromium-preview/hover-ref",
			"POST /api/chromium-preview/press",
			"POST /api/chromium-preview/reload",
			"POST /api/chromium-preview/scroll",
			"POST /api/chromium-preview/select-ref",
			"POST /api/chromium-preview/type",
			"POST /api/chromium-preview/type-ref",
			"POST /api/chromium-preview/viewport",
			"POST /api/chromium-preview/wheel",
		],
	},
];

const PROXY_HELPER_BYPASS_ALLOWLIST = new Map();

module.exports = {
	LOCAL_NEXT_API_ROUTES,
	PROXY_HELPER_BYPASS_ALLOWLIST,
	PROXY_TARGET_FANOUT_EXCEPTIONS,
	SERVER_ROUTE_FILES,
};
