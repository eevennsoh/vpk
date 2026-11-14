// Renders a real Rovo app route page (Rovo or Studio) inside the providers its layout and the
// root layout supply, against an in-memory stand-in for the /api/rovo backend. Used by the
// shell characterization suites, which pin what a user sees and can do before C-5 moves code.
// render-component registers happy-dom, so it loads before anything that touches the DOM.
const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const React = require("react");

const CSS_MODULE = "export default new Proxy({}, { get: (_, key) => String(key) });";
// esbuild cannot load CSS modules without an output path; the classes don't matter here.
const CSS_MODULE_MOCKS = {
	"@/components/blocks/prompt-gallery/components/discover-more-examples.module.css": CSS_MODULE,
	"@/components/projects/shared/components/chat-messages.module.css": CSS_MODULE,
	"@/components/projects/sidebar-chat/chat.module.css": CSS_MODULE,
};

// happy-dom does no layout, so every element measures 0×0 and the shells never leave their
// pre-measurement state. Give elements a desktop-sized box.
const SHELL_BOX = { clientHeight: 800, clientWidth: 1280 };
for (const [key, value] of Object.entries(SHELL_BOX)) {
	Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value });
}

// happy-dom installs its own TransformStream, which Node's ReadableStream (the one fetch bodies
// use) cannot pipe through, so the AI SDK's SSE parser fails. Restore Node's.
globalThis.TransformStream = require("node:stream/web").TransformStream;

const json = (body, status = 200) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status });

// A UI message stream (AI SDK SSE framing) that answers with one text part.
function uiMessageStream(text) {
	const chunks = [
		{ messageId: "assistant-1", type: "start" },
		{ id: "text-1", type: "text-start" },
		{ delta: text, id: "text-1", type: "text-delta" },
		{ id: "text-1", type: "text-end" },
		{ type: "finish" },
	];
	const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
	return new Response(body, { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, status: 200 });
}

/** In-memory /api/rovo backend: threads, documents and a chat endpoint that replies with `reply`. */
function createFakeRovoAppBackend({ documents = [], reply = "Here is the answer.", threads = [] } = {}) {
	const state = { chatRequests: [], documents: [...documents], requests: [], threads: new Map(threads.map((thread) => [thread.id, thread])) };
	const now = new Date(0).toISOString();
	async function fetch(input, init = {}) {
		const url = new URL(String(input), "http://localhost");
		const method = (init.method ?? "GET").toUpperCase();
		const body = typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : null;
		state.requests.push(`${method} ${url.pathname}`);
		const threadMatch = url.pathname.match(/^\/api\/rovo\/threads\/([^/]+)$/u);
		if (url.pathname === "/api/rovo/threads" && method === "GET") {
			return json({ threads: [...state.threads.values()] });
		}
		if (url.pathname === "/api/rovo/threads" && method === "POST") {
			const thread = { createdAt: now, messages: [], realtimeMessages: [], updatedAt: now, ...body };
			state.threads.set(thread.id, thread);
			return json({ thread });
		}
		if (threadMatch) {
			const id = decodeURIComponent(threadMatch[1]);
			if (method === "GET") {
				return state.threads.has(id) ? json({ thread: state.threads.get(id) }) : json({ error: "not found" }, 404);
			}
			const thread = { ...(state.threads.get(id) ?? { createdAt: now, id }), ...body, updatedAt: now };
			state.threads.set(id, thread);
			return json({ thread });
		}
		if (url.pathname === "/api/rovo/documents" && method === "GET") {
			const threadId = url.searchParams.get("threadId");
			const documentId = url.searchParams.get("documentId");
			return documentId
				? json({ document: state.documents.find((document) => document.id === documentId) ?? null })
				: json({ documents: state.documents.filter((document) => document.threadId === threadId) });
		}
		if (url.pathname === "/api/rovo/chat" || url.pathname === "/api/chat-sdk") {
			state.chatRequests.push(body);
			return uiMessageStream(reply);
		}
		if (url.pathname === "/api/rovo/background-streams") {
			return json({ streams: [] });
		}
		if (url.pathname === "/api/rovo/votes") {
			return json({ votes: [] });
		}
		return json({});
	}
	return { fetch, state };
}

// A saved thread whose assistant turn created a text artifact, and that artifact's document.
const FIXTURE_TIME = "2026-01-01T00:00:00.000Z";
const ARTIFACT_THREAD = {
	activeDocumentId: null,
	createdAt: FIXTURE_TIME,
	id: "thread-artifact",
	messages: [
		{ id: "user-1", parts: [{ text: "Draft release notes", type: "text" }], role: "user" },
		{
			id: "assistant-1",
			parts: [
				{ text: "I drafted the notes.", type: "text" },
				{ data: { action: "create", documentId: "doc-release-notes", kind: "text", threadId: "thread-artifact", title: "Release notes draft" }, type: "data-artifact-result" },
			],
			role: "assistant",
		},
	],
	modelId: null,
	provider: null,
	realtimeMessages: [],
	sessionId: null,
	sessionMode: null,
	title: "Release notes",
	updatedAt: FIXTURE_TIME,
	visibility: "private",
};
const ARTIFACT_DOCUMENT = {
	createdAt: FIXTURE_TIME,
	id: "doc-release-notes",
	kind: "text",
	sourceMessageId: "assistant-1",
	threadId: "thread-artifact",
	title: "Release notes draft",
	updatedAt: FIXTURE_TIME,
	versions: [{ changeLabel: "Created", content: "# Release notes\n\nShipped the thing.", createdAt: FIXTURE_TIME, id: "version-1", title: "Release notes draft" }],
};

/** Lets timers, rAF callbacks and fetches settle inside act(). */
const settle = (ms = 50) => React.act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/** Settles until `predicate()` is true (an interaction's result has rendered), or fails after `timeoutMs`. */
async function waitFor(predicate, description, timeoutMs = 5000) {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error(`Timed out waiting for ${description}`);
		}
		await settle(25);
	}
}

/**
 * Renders `pageSpecifier` (an `@/…/page` module) inside `Providers`, `RovoChatProvider` and the
 * route's queue provider, as `app/<route>/layout.tsx` does.
 */
async function renderRovoAppPage({ backend = createFakeRovoAppBackend(), mocks = {}, pageSpecifier, props = {}, queueProviderSpecifier }) {
	// Persisted session agents, sidebar state and drafts would otherwise leak between tests.
	localStorage.clear();
	sessionStorage.clear();
	globalThis.fetch = backend.fetch;
	const source = `import { Providers } from "@/app/providers";
		import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
		import { RovoAppQueueProvider } from ${JSON.stringify(queueProviderSpecifier)};
		import Page from ${JSON.stringify(pageSpecifier)};
		export default function RovoAppRoute(props) {
			return <Providers><RovoChatProvider><RovoAppQueueProvider><Page {...props} /></RovoAppQueueProvider></RovoChatProvider></Providers>;
		}`;
	const view = await renderComponent({ mocks: { ...CSS_MODULE_MOCKS, ...mocks }, props, source });
	await settle();
	return { backend, view };
}

/** The sidebar's open state as the sidebar primitive reports it ("expanded" or "collapsed"). */
const sidebarState = () => document.querySelector("[data-collapsible]")?.getAttribute("data-state") ?? null;

module.exports = { ARTIFACT_DOCUMENT, ARTIFACT_THREAD, createFakeRovoAppBackend, renderRovoAppPage, settle, sidebarState, waitFor };
