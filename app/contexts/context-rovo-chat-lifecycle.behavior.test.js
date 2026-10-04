const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
require("../../scripts/lib/render-component.js");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { loadCjsModuleFromText } = require("../../scripts/lib/esbuild-cjs-loader.js");

const mocks = {
	"@ai-sdk/react": `
		import { useCallback, useState } from "react";
		export function useChat() {
			const [messages, setMessages] = useState([]);
			const sendMessage = useCallback(async (payload) => {
				window.dispatchEvent(new CustomEvent("test-rovo-dispatch", { detail: payload.text }));
			}, []);
			const stop = useCallback(async () => {}, []);
			return { messages, setMessages, sendMessage, stop, status: "ready" };
		}
	`,
	"@/components/projects/rovo-core/lib/api": `
		export async function cancelRovoAppRun() {}
		export async function createRovoAppThread(thread) { return window.testThreadCreation ? window.testThreadCreation(thread) : thread; }
		export async function deleteAllRovoAppThreads() {}
		export async function deleteRovoAppThread() {}
		export async function detachRovoAppRun() {}
		export async function fetchRovoAppAITitle() { return null; }
		export async function fetchRovoAppSuggestedQuestions() { return []; }
		export async function getRovoAppThread() { return null; }
		export async function listRovoAppThreads() { return []; }
		export async function updateRovoAppThread(id, patch) { return { id, ...patch }; }
	`,
	"@/components/projects/sidebar-chat/page": `
		import { useEffect } from "react";
		import { useRovoChat } from "@/app/contexts/context-rovo-chat";
		import { useChatSubmit } from "@/components/projects/sidebar-chat/hooks/use-chat-submit";
		export default function ChatPanel({ chatHistory }) {
			const { selectedAgent, uiMessages } = useRovoChat();
			const { abort } = useChatSubmit();
			useEffect(() => () => abort(), [abort]);
			return <>
				<output data-agent>{selectedAgent.id}</output>
				<output data-history-session>{chatHistory.activeThreadId ?? "none"}</output>
				<output data-messages>{uiMessages.flatMap(message => message.parts.filter(part => part.type === "text").map(part => part.text)).join("|")}</output>
				<button onClick={chatHistory.onNewChat}>New chat</button>
				<button onClick={() => void chatHistory.selectThread(chatHistory.threads[0].id)}>Select history session</button>
				{chatHistory.getThreadActions(chatHistory.threads[0])}
			</>;
		}
	`,
	"@/components/blocks/product-sidebar/variants/jira": `
		export function JiraSessionDescription() { return null; }
		export function JiraSessionLabel() { return null; }
		export function JiraSessionLifecycle() { return null; }
		export function JiraSessionRowActions({ onTogglePin }) {
			return <button onClick={onTogglePin}>Toggle pin</button>;
		}
	`,
};

async function loadHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import { useEffect, useRef, useState } from "react";
				import { RovoChatProvider, useRovoChat } from "@/app/contexts/context-rovo-chat";
				import { RovoStage } from "@/components/projects/jira-golden-journeys-v1/components/rovo-stage";
				import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journeys-v1/data/agent-chat-data";
				function Controls() {
					const { sendPrompt, applyLocalTurn, activeThreadId, queueCount } = useRovoChat();
					const controller = useRef(null);
					return <>
						<button onClick={() => void sendPrompt("Hello after replay")}>Send</button>
						<button onClick={() => {
							controller.current = new AbortController();
							void applyLocalTurn({ promptText: "Local pending", assistantParts: [], signal: controller.current.signal })
								.then(result => window.dispatchEvent(new CustomEvent("test-local-turn-finished", { detail: result })));
						}}>Start local</button>
						<button onClick={() => controller.current.abort()}>Abort local</button>
						<output data-active-thread>{activeThreadId ?? "none"}</output><output>{queueCount}</output>
					</>;
				}
				export function Harness() { return <RovoChatProvider><Controls /></RovoChatProvider>; }
				function ColdMountControls({ operation }) {
					const { activateSession, applyLocalTurn, activeThreadId, uiMessages } = useRovoChat();
					useEffect(() => {
						const pending = operation === "activateSession"
							? activateSession({
								threadId: "cold-mount-session",
								messages: [{ id: "restored-assistant", role: "assistant", parts: [{ type: "text", text: "Restored on mount" }] }],
							})
							: applyLocalTurn({ promptText: "Local on mount", assistantParts: [{ type: "text", text: "Local reply" }] });
						void pending.then(result => window.dispatchEvent(new CustomEvent("test-mount-turn-finished", { detail: result })));
					}, [activateSession, applyLocalTurn, operation]);
					return <>
						<output data-active-thread>{activeThreadId ?? "none"}</output>
						<output data-messages>{uiMessages.flatMap(message => message.parts.filter(part => part.type === "text").map(part => part.text)).join("|")}</output>
					</>;
				}
				export function ColdMountHarness({ operation }) {
					return <RovoChatProvider><ColdMountControls operation={operation} /></RovoChatProvider>;
				}
				function ResetOnEntry({ shown }) {
					const { resetAgentToRovo, resetChat } = useRovoChat();
					useEffect(() => {
						if (!shown) return;
						resetAgentToRovo();
						resetChat();
					}, [shown, resetAgentToRovo, resetChat]);
					return null;
				}
				export function JiraRovoHarness({ initial }) {
					const [shown, setShown] = useState(initial);
					return <RovoChatProvider agentProfiles={JGP_CHAT_AGENT_PROFILES}>
						<ResetOnEntry shown={shown} />
						<button onClick={() => setShown(true)}>Enter Rovo</button>
						{shown ? <RovoStage /> : null}
					</RovoChatProvider>;
				}
			`,
			loader: "tsx", resolveDir: process.cwd(), sourcefile: "rovo-chat-lifecycle-harness.tsx",
		},
		bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false,
		external: ["react", "react-dom"], loader: { ".css": "empty" },
		plugins: [{ name: "remote-chat-adapters", setup(build) {
			build.onResolve({ filter: /.*/ }, ({ path }) => Object.hasOwn(mocks, path) ? { path, namespace: "test-adapter" } : undefined);
			build.onLoad({ filter: /.*/, namespace: "test-adapter" }, ({ path }) => ({ contents: mocks[path], loader: "tsx", resolveDir: process.cwd() }));
		} }],
	});
	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("Jira Rovo initialization survives chat cleanup replay and preserves successful history choices", async () => {
	const { JiraRovoHarness } = await loadHarness();
	for (const initial of [false, true]) {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		const button = (name) => Array.from(container.querySelectorAll("button")).find((element) => element.textContent === name);
		const text = (selector) => container.querySelector(selector).textContent;
		try {
			await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(JiraRovoHarness, { initial }))));
			if (!initial) await React.act(async () => button("Enter Rovo").click());
			assert.equal(text("[data-agent]"), "cursor");
			assert.equal(text("[data-history-session]"), "jgp-251-persistence-question");
			const restored = text("[data-messages]");
			assert.equal(restored.includes("Implement saved assignee focus for this board."), true);
			await React.act(async () => button("Toggle pin").click());
			assert.equal(text("[data-messages]"), restored);
			await React.act(async () => button("New chat").click());
			await React.act(async () => button("Toggle pin").click());
			assert.equal(text("[data-history-session]"), "none");
			assert.equal(text("[data-messages]"), "");
			await React.act(async () => button("Select history session").click());
			await React.act(async () => button("Toggle pin").click());
			assert.equal(text("[data-history-session]"), "jgp-251-persistence-question");
			assert.equal(text("[data-messages]"), restored);
		} finally {
			await React.act(async () => root.unmount());
			container.remove();
		}
	}
});

for (const operation of ["activateSession", "applyLocalTurn"]) {
	test(`${operation} from a descendant cold-mount effect applies the transcript through StrictMode replay`, async () => {
		const { ColdMountHarness } = await loadHarness();
		for (const strict of [false, true]) {
			const finished = [];
			const created = [];
			const observe = (event) => finished.push(event.detail);
			window.addEventListener("test-mount-turn-finished", observe);
			window.testThreadCreation = async (thread) => { created.push(thread); return thread; };
			const container = document.createElement("div");
			document.body.append(container);
			const root = createRoot(container);
			try {
				await React.act(async () => {
					const harness = React.createElement(ColdMountHarness, { operation });
					root.render(strict ? React.createElement(React.StrictMode, null, harness) : harness);
				});
				assert.deepEqual(finished, strict ? [false, true] : [true]);
				if (operation === "activateSession") {
					assert.equal(container.querySelector("[data-active-thread]").textContent, "cold-mount-session");
					assert.equal(container.querySelector("[data-messages]").textContent, "Restored on mount");
					assert.equal(created.length, 0);
				} else {
					assert.equal(created.length, 1);
					assert.equal(container.querySelector("[data-active-thread]").textContent, created[0].id);
					assert.equal(container.querySelector("[data-messages]").textContent, "Local on mount|Local reply");
				}
			} finally {
				await React.act(async () => root.unmount());
				container.remove();
				window.removeEventListener("test-mount-turn-finished", observe);
				delete window.testThreadCreation;
			}
		}
	});
}

test("root StrictMode replay leaves the mounted provider able to dispatch a queued prompt", async () => {
	const { Harness } = await loadHarness();
	const sent = [];
	const observe = (event) => sent.push(event.detail);
	window.addEventListener("test-rovo-dispatch", observe);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	try {
		await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))));
		await React.act(async () => {
			container.querySelector("button").click();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		assert.deepEqual(sent, ["Hello after replay"]);
	} finally {
		await React.act(async () => root.unmount());
		container.remove();
		window.removeEventListener("test-rovo-dispatch", observe);
	}
});

test("cancelled pending thread creation releases the mounted provider queue and rejects late completions", async () => {
	const { Harness } = await loadHarness();
	for (const lateOutcome of ["resolve", "reject"]) {
		const created = [];
		const sent = [];
		const finished = [];
		let resolveOld;
		let rejectOld;
		window.testThreadCreation = (thread) => {
			created.push(thread);
			return created.length === 1 ? new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject; }) : Promise.resolve(thread);
		};
		const observeSend = (event) => sent.push(event.detail);
		const observeFinish = (event) => finished.push(event.detail);
		window.addEventListener("test-rovo-dispatch", observeSend);
		window.addEventListener("test-local-turn-finished", observeFinish);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		const button = (name) => Array.from(container.querySelectorAll("button")).find((element) => element.textContent === name);
		try {
			await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))));
			await React.act(async () => { button("Start local").click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
			assert.equal(created.length, 1);
			assert.equal(created[0].signal.aborted, false);
			await React.act(async () => { button("Abort local").click(); await Promise.resolve(); });
			assert.deepEqual(finished, [false]);
			assert.equal(created[0].signal.aborted, true);
			await React.act(async () => { button("Send").click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
			assert.deepEqual(sent, ["Hello after replay"]);
			assert.equal(created.length, 2);
			assert.equal(container.querySelector("[data-active-thread]").textContent, created[1].id);
			await React.act(async () => {
				if (lateOutcome === "resolve") resolveOld(created[0]);
				else rejectOld(new Error("Old network request failed late"));
				await Promise.resolve();
			});
			assert.equal(container.querySelector("[data-active-thread]").textContent, created[1].id);
			assert.deepEqual(finished, [false]);
		} finally {
			await React.act(async () => root.unmount());
			container.remove();
			delete window.testThreadCreation;
			window.removeEventListener("test-rovo-dispatch", observeSend);
			window.removeEventListener("test-local-turn-finished", observeFinish);
		}
	}
});
