/**
 * API Configuration for Frontend
 *
 * This file determines which backend the frontend should connect to:
 *
 * LOCAL DEVELOPMENT (npm run dev):
 * - Frontend runs on http://localhost:3000 (Next.js dev server)
 * - Backend runs on http://localhost:8080 (Express server)
 * - API calls go to /api/* which are Next.js API routes
 * - These routes proxy the request to http://localhost:8080
 * - This avoids CORS issues since browser only talks to localhost:3000
 *
 * PRODUCTION DEPLOYMENT:
 * - Both frontend and backend served from same Express server on port 8080
 * - Frontend is static HTML/CSS/JS files
 * - API calls go to /api/* which are handled directly by Express
 * - No Next.js API routes exist in production build
 * - No CORS issues since everything is same domain
 *
 * The key insight: In BOTH cases, the frontend uses relative paths (/api/*)
 * The difference is WHO handles those paths:
 * - Local dev: Next.js API routes proxy to Express backend
 * - Production: Express backend handles them directly
 */

// For the frontend, ALWAYS use relative paths
// This works in both local development and production
const API_BASE_URL = '';

export const API_ENDPOINTS = {
	CHAT_SDK: `${API_BASE_URL}/api/chat-sdk`,
	CHAT_TITLE: `${API_BASE_URL}/api/chat-title`,
	PLAN_TITLE: `${API_BASE_URL}/api/plan-title`,
	GENUI_DESCRIPTION_SUMMARY: `${API_BASE_URL}/api/genui-description-summary`,
	CHAT_CANCEL: `${API_BASE_URL}/api/chat-cancel`,
	HEALTH: `${API_BASE_URL}/api/health`,
	STATUS: `${API_BASE_URL}/api/status`,
	STATUS_ROVO: `${API_BASE_URL}/api/status/rovo`,
	ROVO_APP_CHAT: `${API_BASE_URL}/api/rovo/chat`,
	ROVO_APP_SUGGESTIONS: `${API_BASE_URL}/api/rovo/suggestions`,
	ROVO_APP_MESSAGES: `${API_BASE_URL}/api/rovo/messages`,
	ROVO_APP_THREADS: `${API_BASE_URL}/api/rovo/threads`,
	ROVO_APP_VOTES: `${API_BASE_URL}/api/rovo/votes`,
	ROVO_APP_DOCUMENTS: `${API_BASE_URL}/api/rovo/documents`,
	ROVO_APP_DETACH: `${API_BASE_URL}/api/rovo/detach`,
	ROVO_APP_BACKGROUND_STREAMS: `${API_BASE_URL}/api/rovo/background-streams`,
	ROVO_APP_RUNS: `${API_BASE_URL}/api/rovo/runs`,
	ROVO_APP_FILE_UPLOAD: `${API_BASE_URL}/api/rovo/files/upload`,
	AGENT_MODE: `${API_BASE_URL}/api/agent-mode`,
	SESSION_SEARCH: `${API_BASE_URL}/api/sessions/search`,
	CHECKPOINTS: `${API_BASE_URL}/api/checkpoints`,
	checkpoint: (id: string) =>
		`${API_BASE_URL}/api/checkpoints/${encodeURIComponent(id)}`,
	checkpointRollback: (id: string) =>
		`${API_BASE_URL}/api/checkpoints/${encodeURIComponent(id)}/rollback`,
	sessionSearch: (query: string, limit?: number) => {
		const params = new URLSearchParams({ q: query });
		if (typeof limit === "number") {
			params.set("limit", String(limit));
		}
		return `${API_BASE_URL}/api/sessions/search?${params.toString()}`;
	},
	rovoAppThreads: (limit?: number) =>
		`${API_BASE_URL}/api/rovo/threads${
			typeof limit === "number" ? `?limit=${encodeURIComponent(String(limit))}` : ""
		}`,
	rovoAppMessages: (threadId: string) =>
		`${API_BASE_URL}/api/rovo/messages?threadId=${encodeURIComponent(threadId)}`,
	rovoAppThread: (threadId: string) =>
		`${API_BASE_URL}/api/rovo/threads/${encodeURIComponent(threadId)}`,
	rovoAppRunStream: (threadId: string) =>
		`${API_BASE_URL}/api/rovo/runs/${encodeURIComponent(threadId)}/stream`,
	rovoAppRunDetach: (threadId: string) =>
		`${API_BASE_URL}/api/rovo/runs/${encodeURIComponent(threadId)}/detach`,
	rovoAppRunCancel: (threadId: string) =>
		`${API_BASE_URL}/api/rovo/runs/${encodeURIComponent(threadId)}/cancel`,
	rovoAppFile: (fileId: string) =>
		`${API_BASE_URL}/api/rovo/files/${encodeURIComponent(fileId)}`,
	statusRuntime: (runtime: "rovo") =>
		`${API_BASE_URL}/api/status/${encodeURIComponent(runtime)}`,
	SPEECH_TRANSCRIPTION: `${API_BASE_URL}/api/speech-transcription`,
	CHROMIUM_PREVIEW: `${API_BASE_URL}/api/chromium-preview`,
	CHROMIUM_PREVIEW_STREAM: `${API_BASE_URL}/api/chromium-preview/stream`,
	BROWSER_WORKSPACES: `${API_BASE_URL}/api/browser-workspaces`,
	browserWorkspace: (workspaceId: string) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}`,
	browserWorkspaceAction: (
		workspaceId: string,
		action:
			| "navigate"
			| "back"
			| "forward"
			| "reload"
			| "viewport"
			| "click"
			| "click-ref"
			| "hover-ref"
			| "fill-ref"
			| "type-ref"
			| "select-ref"
			| "scroll"
			| "wheel"
			| "press"
			| "type"
			| "snapshot"
			| "screenshot"
			| "stream"
	) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/${action}`,
	browserWorkspaceTabs: (workspaceId: string) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/tabs`,
	browserWorkspaceTab: (workspaceId: string, tabIndex: number) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/tabs/${encodeURIComponent(String(tabIndex))}`,
	browserWorkspaceActivateTab: (workspaceId: string, tabIndex: number) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/tabs/${encodeURIComponent(String(tabIndex))}/activate`,
	browserWorkspaceSnapshot: (workspaceId: string, interactive?: boolean) => {
		const params = interactive ? "?interactive=true" : "";
		return `${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/snapshot${params}`;
	},
	browserWorkspaceScreenshot: (
		workspaceId: string,
		width?: number,
		height?: number,
		cacheBuster?: number,
	) => {
		const params = new URLSearchParams();
		if (typeof width === "number" && width > 0) {
			params.set("width", String(width));
		}
		if (typeof height === "number" && height > 0) {
			params.set("height", String(height));
		}
		if (typeof cacheBuster === "number") {
			params.set("v", String(cacheBuster));
		}
		const query = params.toString();
		return `${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/screenshot${
			query ? `?${query}` : ""
		}`;
	},
	browserWorkspaceStream: (workspaceId: string) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/stream`,
	browserWorkspacePreviewSession: (workspaceId: string) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/preview-session`,
	browserWorkspacePreviewSessionById: (
		workspaceId: string,
		sessionId: string,
	) =>
		`${API_BASE_URL}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/preview-session/${encodeURIComponent(sessionId)}`,
	chromiumPreviewAction: (
		action:
			| "back"
			| "forward"
			| "reload"
			| "viewport"
			| "click"
			| "click-ref"
			| "hover-ref"
			| "fill-ref"
			| "type-ref"
			| "select-ref"
			| "scroll"
			| "wheel"
			| "press"
			| "type"
	) => `${API_BASE_URL}/api/chromium-preview/${action}`,
	chromiumPreviewSnapshot: (interactive?: boolean) => {
		const params = interactive ? "?interactive=true" : "";
		return `${API_BASE_URL}/api/chromium-preview/snapshot${params}`;
	},
	chromiumPreviewScreenshot: (
		width?: number,
		height?: number,
		cacheBuster?: number
	) => {
		const params = new URLSearchParams();
		if (typeof width === "number" && width > 0) {
			params.set("width", String(width));
		}
		if (typeof height === "number" && height > 0) {
			params.set("height", String(height));
		}
		if (typeof cacheBuster === "number") {
			params.set("v", String(cacheBuster));
		}
		const query = params.toString();
		return `${API_BASE_URL}/api/chromium-preview/screenshot${
			query ? `?${query}` : ""
		}`;
	},
};
