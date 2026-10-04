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
};

async function loadHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import { useRef } from "react";
				import { RovoChatProvider, useRovoChat } from "@/app/contexts/context-rovo-chat";
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
