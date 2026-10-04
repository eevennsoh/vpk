const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("../../scripts/lib/esbuild-cjs-loader.js");
const compiled = esbuild.buildSync({
	entryPoints: ["app/contexts/rovo-chat-transcript.ts"], bundle: true,
	platform: "node", format: "cjs", write: false,
});
const { createRovoChatTranscript } = loadCjsModuleFromText(compiled.outputFiles[0].text);
const { RovoChatTransitionCoordinator } = require("./rovo-chat-transition-coordinator.ts");
const text = (value) => [{ type: "text", text: value, state: "done" }];
const deferred = () => { let resolve; const promise = new Promise((complete) => { resolve = complete; }); return { promise, resolve }; };

function harness(overrides = {}) {
	const coordinator = new RovoChatTransitionCoordinator();
	const calls = [];
	let controller;
	let messages = [{ id: "old", role: "assistant", parts: text("Existing history") }];
	let selectedAgent = "kept-agent";
	let snapshot;
	const owner = {
		begin(kind) {
			controller?.abort();
			controller = new AbortController();
			return { token: coordinator.begin(kind), signal: controller.signal };
		},
		isCurrent: (token) => coordinator.isCurrent(token),
		finish: (token) => { if (coordinator.isCurrent(token)) calls.push("finish"); },
		async stop() { calls.push("stop"); },
		async ensureThread(seed, signal) { assert.equal(signal.aborted, false); calls.push(["ensure", seed]); return "new-thread"; },
		readMessages: () => messages,
		resetPending: () => calls.push("reset"),
		writeMessages(next) { messages = next; calls.push("messages"); },
		writeSnapshot(next) { snapshot = next; messages = next.messages; calls.push("snapshot"); },
		selectAgent(id) { selectedAgent = id; calls.push(["agent", id]); },
		...overrides,
	};
	return { calls, owner, operations: createRovoChatTranscript(owner), read: () => ({ messages, selectedAgent, snapshot }) };
}

test("session activation awaits stop before atomically selecting and applying snapshot", async () => {
	const pending = deferred();
	const view = harness({ stop: () => pending.promise });
	const snapshot = { agentId: "target", threadId: "thread-a", markPersisted: true, messages: [] };
	const activation = view.operations.activateSession(snapshot);
	assert.equal(view.read().snapshot, undefined);
	pending.resolve();
	assert.equal(await activation, true);
	assert.deepEqual(view.calls, ["reset", ["agent", "target"], "snapshot", "finish"]);
	assert.equal(view.read().selectedAgent, "target");
	await view.operations.activateSession({ threadId: null, messages: [] });
	assert.equal(view.read().selectedAgent, "target");
});

test("local turns await stop and ensure thread, preserve agent/history, and apply stages in order", async () => {
	const view = harness();
	await view.operations.applyLocalTurn({
		promptText: "Prompt", assistantParts: text("Pending"),
		assistantPartStages: [
			{ delayMs: 0, getAssistantParts: () => text("First"), onApply: () => view.calls.push("first apply") },
			{ delayMs: 0, startsNewAssistantMessage: true, getAssistantParts: () => text("Second") },
		],
		onApplyAfterResponse: () => view.calls.push("after response"),
	});
	assert.deepEqual(view.calls.slice(0, 4), ["stop", "reset", ["ensure", "Prompt"], "messages"]);
	assert.equal(view.calls.indexOf("first apply") < view.calls.lastIndexOf("messages"), true);
	assert.equal(view.calls.indexOf("after response") > view.calls.lastIndexOf("messages"), true);
	const { messages, selectedAgent } = view.read();
	assert.equal(messages.length, 4);
	assert.equal(messages[0].id, "old");
	assert.equal(messages[1].role, "user");
	assert.equal(messages[2].parts[0].text, "First");
	assert.equal(messages[3].parts[0].text, "Second");
	assert.notEqual(messages[2].id, messages[3].id);
	assert.equal(selectedAgent, "kept-agent");
});

test("replace playback preserves supplied message identities and ordered final callbacks", async () => {
	const view = harness();
	const user = { id: "playback-user", role: "user", parts: text("Play") };
	await view.operations.applyLocalTurn({ promptText: "Play", userMessage: user, history: "replace", assistantMessageId: "reply", assistantParts: text("Done") });
	assert.deepEqual(view.read().messages.map((message) => message.id), ["playback-user", "reply"]);
});

test("superseded stop and ensure completion cannot overwrite an activated session", async () => {
	for (const phase of ["stop", "ensureThread"]) {
		const pending = deferred();
		let first = true;
		const view = harness({ [phase]: () => { if (first) { first = false; return pending.promise; } return Promise.resolve("new-thread"); } });
		const stale = view.operations.applyLocalTurn({ promptText: "Old", assistantParts: text("Old reply") });
		await Promise.resolve();
		await Promise.resolve();
		const latest = { threadId: "chosen", messages: [{ id: "chosen", role: "assistant", parts: text("Chosen") }] };
		assert.equal(await view.operations.activateSession(latest), true);
		pending.resolve("stale-thread");
		assert.equal(await stale, false);
		assert.deepEqual(view.read().messages.map((message) => message.id), ["chosen"]);
	}
});

test("abort cancels delayed stages and prevents their effects and final callback", async () => {
	const view = harness();
	const controller = new AbortController();
	let stageRan = false;
	let afterRan = false;
	const turn = view.operations.applyLocalTurn({
		promptText: "Cancelable", assistantParts: text("Pending"), signal: controller.signal,
		assistantPartStages: [{ delayMs: 60000, getAssistantParts: () => text("Late"), onApply: () => { stageRan = true; } }],
		onApplyAfterResponse: () => { afterRan = true; },
	});
	await Promise.resolve();
	await Promise.resolve();
	controller.abort();
	assert.equal(await turn, false);
	assert.equal(stageRan, false);
	assert.equal(afterRan, false);
});

test("reset or destroy invalidates delayed local work through the same transition owner", async () => {
	for (const kind of ["reset-chat", "stop-streaming", "destroy"]) {
		const view = harness();
		const turn = view.operations.applyLocalTurn({ promptText: "Pending", assistantParts: text("Pending"), assistantPartStages: [{ delayMs: 60000, getAssistantParts: () => text("Stale") }] });
		await Promise.resolve();
		await Promise.resolve();
		view.owner.begin(kind);
		assert.equal(await turn, false);
		assert.equal(view.read().messages.some((message) => message.parts[0]?.text === "Stale"), false);
	}
});

test("external abort promptly finishes a turn whose thread ensure never settles", async () => {
	let enteredEnsure;
	const entered = new Promise((resolve) => { enteredEnsure = resolve; });
	const view = harness({ ensureThread: () => { enteredEnsure(); return new Promise(() => {}); } });
	const controller = new AbortController();
	const turn = view.operations.applyLocalTurn({ promptText: "Pending creation", assistantParts: [], signal: controller.signal });
	await entered;
	controller.abort();
	const outcome = await Promise.race([turn, new Promise((resolve) => setImmediate(() => resolve("still pending")))]);
	assert.equal(outcome, false);
	assert.equal(view.calls.at(-1), "finish");
	assert.equal(view.calls.includes("messages"), false);
});

test("cancellation continues awaiting the shared SDK stop before releasing turn ownership", async () => {
	const stopping = deferred();
	const view = harness({ stop: () => stopping.promise });
	const controller = new AbortController();
	const turn = view.operations.applyLocalTurn({ promptText: "Stop first", assistantParts: [], signal: controller.signal });
	controller.abort();
	assert.equal(await Promise.race([turn, new Promise((resolve) => setImmediate(() => resolve("still stopping")))]), "still stopping");
	assert.equal(view.calls.includes("finish"), false);
	stopping.resolve();
	assert.equal(await turn, false);
	assert.equal(view.calls.at(-1), "finish");
	assert.equal(view.calls.some((call) => Array.isArray(call) && call[0] === "ensure"), false);
});
