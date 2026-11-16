// Shared harness for the RovoChatProvider turn-lifecycle behaviour suites (SM-FE-15).
// It renders the real provider with the real AI SDK `useChat` and
// `DefaultChatTransport`; only the network is fake. `fetch` answers
// `/api/rovo/chat` from a scripted in-memory SSE server, and the thread API
// module is an in-memory store, so no paid model call can happen.
// Paths resolve from process.cwd(), like scripts/lib/render-component.js, so the
// runner must start at the repo root (the unit gate and `node --test` from the
// root both do). Require this module before anything that loads happy-dom.
const path = require("node:path");

// happy-dom replaces some web-stream globals when it registers; the AI SDK
// transport pipes the SSE body through TransformStreams, which only works with
// Node's own stream classes, so the suite captures them and swaps them back in
// while a chat is mounted.
const NODE_STREAM_GLOBALS = {
	Response: globalThis.Response,
	TransformStream: globalThis.TransformStream,
	WritableStream: globalThis.WritableStream,
};
const NodeResponse = NODE_STREAM_GLOBALS.Response;
const NodeReadableStream = globalThis.ReadableStream;

const assert = require("node:assert/strict");
const esbuild = require("esbuild");
require("../../scripts/lib/render-component.js");
// Fails loudly if the capture above is ever moved below the happy-dom import.
assert.notEqual(globalThis.Response, NodeResponse, "capture Node's stream globals before render-component loads");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { loadCjsModuleFromText } = require("../../scripts/lib/esbuild-cjs-loader.js");

const RETRY_DELAY_MS = 150;
const CHAT_ERROR_UTILS_PATH = path.join(process.cwd(), "lib/chat-error-utils.ts");
const CANCEL_STRATEGY_PATH = path.join(process.cwd(), "lib/rovo-cancel-strategy.ts");
const TURN_ERRORS_PATH = path.join(process.cwd(), "app/contexts/rovo-chat-turn-errors.ts");
const CANCEL_REQUEST_TIMEOUT_MS = 150;

const mocks = {
	"@/components/projects/rovo-core/lib/api": `
		// Late refreshes can land after a test tears down; they read an empty store.
		const api = () => window.testApi ?? { threads: new Map(), calls: [] };
		export async function cancelRovoAppRun(threadId, { signal } = {}) {
			api().calls.push("cancelRun:" + threadId);
			// \`hangCancel\` models a backend whose cancel never answers; only the signal ends it.
			if (api().hangCancel) {
				await new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason), { once: true }));
			}
			return true;
		}
		export async function createRovoAppThread({ signal, ...thread }) {
			api().calls.push("createThread:" + thread.title);
			// \`createThreadGate\` holds a first prompt's send until the test opens it; a
			// function gate gets the thread's title, so each send can be held separately.
			const gate = api().createThreadGate;
			await (typeof gate === "function" ? gate(thread.title) : gate);
			const created = { ...thread, createdAt: 1, updatedAt: 1 };
			api().threads.set(created.id, created);
			return created;
		}
		export async function deleteAllRovoAppThreads() { api().threads.clear(); }
		export async function deleteRovoAppThread(id) { api().threads.delete(id); }
		// \`detachGate\` holds a thread change's stop phase at the detach until the test opens it.
		export async function detachRovoAppRun(threadId) { api().calls.push("detachRun:" + threadId); await api().detachGate; return true; }
		export async function fetchRovoAppAITitle() { return null; }
		export async function fetchRovoAppSuggestedQuestions() { return []; }
		export async function getRovoAppThread(id) {
			// \`threadFetchGate\` holds every thread fetch until the test opens it.
			await api().threadFetchGate;
			// \`failingThreadIds\` models a thread whose fetch rejects.
			if (api().failingThreadIds?.has(id)) throw new Error("Thread fetch failed: " + id);
			return api().threads.get(id) ?? null;
		}
		export async function listRovoAppThreads() { return Array.from(api().threads.values()); }
		export async function updateRovoAppThread(id, patch) {
			const updated = { ...(api().threads.get(id) ?? { id }), ...patch };
			api().threads.set(id, updated);
			return updated;
		}
	`,
	// Real cancel strategy; only the backend-cancel wait is shortened.
	"@/lib/rovo-cancel-strategy": `
		export * from ${JSON.stringify(CANCEL_STRATEGY_PATH)};
		export const EXPLICIT_CANCEL_REQUEST_TIMEOUT_MS = ${CANCEL_REQUEST_TIMEOUT_MS};
	`,
	// Real error classification and copy; only the retry delays are shortened.
	"@/lib/chat-error-utils": `
		export * from ${JSON.stringify(CHAT_ERROR_UTILS_PATH)};
		export const RATE_LIMIT_RETRY_DELAY_MS = ${RETRY_DELAY_MS};
		export const CHAT_IN_PROGRESS_RETRY_DELAY_MS = ${RETRY_DELAY_MS};
	`,
	// Real turn errors; the provider's onFinish reads every clean or aborted
	// finish through readCutShortFinish, so \`onRequestFinish\` runs inside it.
	"@/app/contexts/rovo-chat-turn-errors": `
		import { readCutShortFinish as readFinish } from ${JSON.stringify(TURN_ERRORS_PATH)};
		export * from ${JSON.stringify(TURN_ERRORS_PATH)};
		export function readCutShortFinish(input) {
			window.testApi?.onRequestFinish?.();
			return readFinish(input);
		}
	`,
};

// Bundled stream classes (for example the SSE parser) extend TransformStream when
// the module evaluates, so the harness loads with Node's classes in place too.
function withNodeStreamGlobals(callback) {
	const previous = Object.fromEntries(Object.keys(NODE_STREAM_GLOBALS).map((name) => [name, globalThis[name]]));
	Object.assign(globalThis, NODE_STREAM_GLOBALS);
	try {
		return callback();
	} finally {
		Object.assign(globalThis, previous);
	}
}

let harnessPromise = null;
function loadHarness() {
	harnessPromise ??= esbuild.build({
		stdin: {
			contents: `
				import { Activity, StrictMode } from "react";
				import { RovoChatProvider, useRovoChat } from "@/app/contexts/context-rovo-chat";
				export { getPayloadTooLargeUserMessage, toUserFacingChatErrorMessage } from "@/app/contexts/rovo-chat-helpers";
				export { CUT_SHORT_MEDIA_WAIT_MS, MEDIA_GENERATION_TIMEOUT_MS } from "@/app/contexts/use-rovo-chat-media-generation";
				export {
					getChatInProgressRetryCountdownLabel,
					getChatInProgressUserMessage,
					getIncompleteTurnUserMessage,
					getRateLimitRetryCountdownMessage,
					getRateLimitUserMessage,
					RATE_LIMIT_MAX_RETRIES,
					CHAT_IN_PROGRESS_MAX_RETRIES,
				} from "@/lib/chat-error-utils";
				function Probe() {
					window.testChat = useRovoChat();
					window.onTestChatRender?.();
					return null;
				}
				// \`hidden\` hides the provider through <Activity>, which cleans up its
				// effects and sets them up again when shown, as retained views do.
				export function Harness({ hidden = false, strict = false }) {
					const chat = <Activity mode={hidden ? "hidden" : "visible"}><RovoChatProvider><Probe /></RovoChatProvider></Activity>;
					return strict ? <StrictMode>{chat}</StrictMode> : chat;
				}
			`,
			loader: "tsx", resolveDir: process.cwd(), sourcefile: "rovo-chat-turn-lifecycle-harness.tsx",
		},
		bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false,
		external: ["react", "react-dom"], loader: { ".css": "empty" },
		plugins: [{ name: "chat-turn-adapters", setup(build) {
			build.onResolve({ filter: /.*/ }, ({ path: request }) => Object.hasOwn(mocks, request) ? { path: request, namespace: "test-adapter" } : undefined);
			build.onLoad({ filter: /.*/, namespace: "test-adapter" }, ({ path: request }) => ({ contents: mocks[request], loader: "tsx", resolveDir: process.cwd() }));
		} }],
	}).then((result) => withNodeStreamGlobals(() => loadCjsModuleFromText(result.outputFiles[0].text)));
	return harnessPromise;
}

// A scripted SSE chat server. Each POST to the chat endpoint becomes a turn the
// test drives chunk by chunk; `failNext` answers the next POST with an HTTP error.
function createChatServer() {
	const encoder = new TextEncoder();
	const turns = [];
	const failures = [];
	const scripts = [];
	const otherRequests = [];
	const waiters = [];

	function createTurn(body, signal) {
		let controller;
		let closed = false;
		const stream = new NodeReadableStream({
			start(streamController) { controller = streamController; },
			// The client cancelled its reader (for example after an abort).
			cancel() { closed = true; },
		});
		const turn = {
			body,
			aborted: false,
			send(chunk) {
				if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
			},
			text(id, text) {
				turn.send({ type: "text-start", id });
				turn.send({ type: "text-delta", id, delta: text });
				turn.send({ type: "text-end", id });
			},
			turnComplete() {
				turn.send({ type: "data-turn-complete", data: { timestamp: new Date().toISOString() } });
			},
			end() {
				if (closed) return;
				turn.send({ type: "finish" });
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				closed = true;
				controller.close();
			},
		};
		signal?.addEventListener("abort", () => {
			turn.aborted = true;
			// A turn the test marks `ignoreAbort` models a backend that does not settle
			// the request when the client aborts it.
			if (closed || turn.ignoreAbort) return;
			closed = true;
			controller.error(new DOMException("The operation was aborted.", "AbortError"));
		}, { once: true });
		turn.response = new NodeResponse(stream, {
			status: 200,
			headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
		});
		return turn;
	}

	async function fetch(input, init = {}) {
		const url = String(typeof input === "string" ? input : input?.url ?? input);
		if (url.endsWith("/api/rovo/chat")) {
			const body = JSON.parse(init.body);
			const failure = failures.shift();
			if (failure) {
				turns.push({ body, failed: failure });
				resolveWaiters();
				if (failure.gate) await failure.gate;
				return new NodeResponse(failure.body, { status: failure.status });
			}
			const turn = createTurn(body, init.signal);
			turns.push(turn);
			scripts.shift()?.(turn);
			resolveWaiters();
			return turn.response;
		}
		otherRequests.push(url);
		return new NodeResponse("{}", { status: 200, headers: { "content-type": "application/json" } });
	}

	function resolveWaiters() {
		for (const waiter of waiters.splice(0)) waiter();
	}

	return {
		fetch,
		turns,
		otherRequests,
		// `gate`, when given, holds the error response until the promise resolves.
		failNext(status, body, gate) { failures.push({ status, body, gate }); },
		// Writes the next turn's chunks before its response is returned, so the
		// client can read the whole stream without waiting on the test.
		respondNext(script) { scripts.push(script); },
	};
}

function partLabel(part) {
	if (part.type === "text") return part.text;
	if (part.type.startsWith("tool-")) return `${part.type}(${part.state})`;
	return part.type;
}

function describeMessages(messages) {
	return messages.map((message) => `${message.role}:${message.parts
		.filter((part) => part.type !== "step-start")
		.map(partLabel)
		.join("+")}`);
}

function chatState() {
	const chat = window.testChat;
	return {
		streaming: chat.isStreaming,
		submitPending: chat.isSubmitPending,
		inFlight: chat.hasInFlightTurn,
		active: chat.activePrompt?.text ?? null,
		queued: chat.queuedPrompts.map((prompt) => prompt.text),
		thread: chat.activeThreadId,
		messages: describeMessages(chat.uiMessages),
	};
}

async function settle(ms = 5) {
	await React.act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
}

async function waitFor(description, predicate, timeoutMs = 3000) {
	const startedAt = Date.now();
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error(`Timed out waiting for ${description}; state: ${JSON.stringify(chatState())}`);
		}
		await settle();
	}
}

// \`strict\` renders under React StrictMode (double effects in development).
async function mountChat(t, { strict = false } = {}) {
	const harness = await loadHarness();
	const server = createChatServer();
	const originalFetch = globalThis.fetch;
	const originalWindowFetch = window.fetch;
	const originalStreamGlobals = Object.fromEntries(Object.keys(NODE_STREAM_GLOBALS).map((name) => [name, globalThis[name]]));
	Object.assign(globalThis, NODE_STREAM_GLOBALS);
	globalThis.fetch = server.fetch;
	window.fetch = server.fetch;
	window.testApi = { threads: new Map(), calls: [] };
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const render = (props) => React.act(async () => root.render(React.createElement(harness.Harness, { strict, ...props })));
	await render({});
	t.after(async () => {
		delete window.onTestChatRender;
		await React.act(async () => root.unmount());
		container.remove();
		globalThis.fetch = originalFetch;
		window.fetch = originalWindowFetch;
		Object.assign(globalThis, originalStreamGlobals);
		delete window.testChat;
		delete window.testApi;
	});
	return {
		harness,
		server,
		chat: () => window.testChat,
		// Hides or shows the provider through <Activity>.
		setHidden: (hidden) => render({ hidden }),
	};
}

// Starts a provider action without holding one React act() scope open for its
// whole lifetime. Actions such as stopStreaming poll a ref that only updates
// after a render commits, and act() defers commits until its callback returns.
async function startAction(action) {
	let settled = false;
	let failure = null;
	await React.act(async () => {
		Promise.resolve(action()).then(
			() => { settled = true; },
			(error) => { settled = true; failure = error; },
		);
	});
	return async function finished() {
		await waitFor("the action to settle", () => settled);
		if (failure) throw failure;
	};
}

// Runs `work` inside one act() scope, so React commits nothing it schedules until
// `work` returns: provider callbacks run against the last committed state, as
// they do when a whole response arrives before React gets to render. `work`
// waits with plain timers (`waitForUncommitted`); waitFor would nest act().
async function withCommitsHeld(work) {
	await React.act(async () => {
		await work();
	});
}

async function waitForUncommitted(description, predicate, timeoutMs = 3000) {
	const startedAt = Date.now();
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error(`Timed out waiting for ${description}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

async function send(chat, prompt) {
	await React.act(async () => {
		await chat().sendPrompt(prompt);
	});
}

async function streamPartial(server, chat, turnIndex, text) {
	const turn = server.turns[turnIndex];
	turn.send({ type: "start" });
	turn.send({ type: "text-start", id: `t${turnIndex}` });
	turn.send({ type: "text-delta", id: `t${turnIndex}`, delta: text });
	await waitFor(`partial text ${text}`, () => chatState().messages.at(-1) === `assistant:${text}`);
	return turn;
}

const cancelRunCalls = () => window.testApi.calls.filter((call) => call.startsWith("cancelRun:"));

// Holds every run detach until `open`, so a test can act while a thread change
// is in its stop phase, with the departing transcript still shown.
function holdDetach() {
	let openGate;
	window.testApi.detachGate = new Promise((resolve) => {
		openGate = resolve;
	});
	return {
		reached: (threadId) => window.testApi.calls.includes(`detachRun:${threadId}`),
		open: () => React.act(async () => {
			openGate();
		}),
	};
}

// Holds every thread fetch until the next chat request's onFinish runs, so a
// selection's fetch resolves after that request finished but before its send settles.
function holdThreadFetchUntilRequestFinishes() {
	const gate = { opened: false };
	window.testApi.threadFetchGate = new Promise((resolve) => {
		window.testApi.onRequestFinish = () => {
			gate.opened = true;
			resolve();
		};
	});
	return gate;
}

// Captures the provider's media timeouts (the full media timeout and the
// cut-short wait) instead of scheduling them, so a test can release them
// without real waits or mocking the harness's own timers. The cut-short wait
// runs to a deadline, so a wait armed again (after its effect was cleaned up)
// asks for the time remaining: a delay above a second, up to the wait, is it.
// A cleared timeout stays captured but is marked, like a real one that will
// never run: `fireLatest` and `fire` still run it (a stale callback must do
// nothing), while `fireLive` runs only the newest timeout still scheduled.
function captureMediaTimeouts(t, harness) {
	const captured = { full: [], cutShort: [] };
	const kindOf = (delay) => {
		if (delay === harness.MEDIA_GENERATION_TIMEOUT_MS) return "full";
		return delay > 1000 && delay <= harness.CUT_SHORT_MEDIA_WAIT_MS ? "cutShort" : null;
	};
	const entries = new Map();
	const originals = { set: globalThis.setTimeout, clear: globalThis.clearTimeout, windowSet: window.setTimeout, windowClear: window.clearTimeout };
	const capture = (schedule) => (callback, delay, ...args) => {
		const kind = kindOf(delay);
		if (kind) {
			const entry = { callback, delay, cleared: false };
			captured[kind].push(entry);
			const handle = schedule(() => {}, 0);
			entries.set(handle, entry);
			return handle;
		}
		return schedule(callback, delay, ...args);
	};
	const release = (clear) => (handle) => {
		const entry = entries.get(handle);
		if (entry) entry.cleared = true;
		return clear(handle);
	};
	globalThis.setTimeout = capture(originals.set);
	window.setTimeout = capture(originals.windowSet.bind(window));
	globalThis.clearTimeout = release(originals.clear);
	window.clearTimeout = release(originals.windowClear.bind(window));
	t.after(() => {
		globalThis.setTimeout = originals.set;
		globalThis.clearTimeout = originals.clear;
		window.setTimeout = originals.windowSet;
		window.clearTimeout = originals.windowClear;
	});
	const run = (entry) => React.act(async () => {
		entry.callback();
	});
	const handle = (kind) => ({
		count: () => captured[kind].length,
		live: () => captured[kind].filter((entry) => !entry.cleared).length,
		delays: () => captured[kind].map((entry) => entry.delay),
		fire: (index) => run(captured[kind].at(index)),
		fireLatest: () => run(captured[kind].at(-1)),
		fireLive: () => {
			const entry = captured[kind].findLast((candidate) => !candidate.cleared);
			assert.ok(entry, `a scheduled ${kind} media timeout`);
			entry.cleared = true;
			return run(entry);
		},
	});
	return { full: handle("full"), cutShort: handle("cutShort") };
}

module.exports = {
	CANCEL_REQUEST_TIMEOUT_MS,
	RETRY_DELAY_MS,
	React,
	cancelRunCalls,
	captureMediaTimeouts,
	chatState,
	describeMessages,
	holdDetach,
	holdThreadFetchUntilRequestFinishes,
	mountChat,
	send,
	settle,
	startAction,
	streamPartial,
	waitFor,
	waitForUncommitted,
	withCommitsHeld,
};
