const assert = require("node:assert/strict");
const test = require("node:test");
const {
	React, RETRY_DELAY_MS, chatState, describeMessages, holdDetach, mountChat,
	send, settle, startAction, waitFor, waitForUncommitted, withCommitsHeld,
} = require("./rovo-chat-turn-test-harness.js");

function storedThread() {
	return {
		id: "stored-thread", title: "Stored", createdAt: 1, updatedAt: 1,
		messages: [{ id: "stored-user", role: "user", parts: [{ type: "text", text: "Stored question" }] }],
		realtimeMessages: [], visibility: "private", activeDocumentId: null,
	};
}

async function seedThread(chat) {
	window.testApi.threads.set("stored-thread", storedThread());
	window.testApi.failingThreadIds = new Set(["broken-thread"]);
	await (await startAction(() => chat().selectThread("stored-thread")))();
}

for (const superseded of [false, true]) {
	test(`a retry due during detach waits for the switch and ${superseded ? "resumes on the retained transcript" : "is dropped at commit"}`, async (t) => {
		const { server, chat } = await mountChat(t);
		window.testApi.threads.set("stored-thread", storedThread());
		window.testApi.failingThreadIds = new Set(["broken-thread"]);
		server.failNext(429, "Too many requests");
		await send(chat, "Retry me");
		await waitFor("the retry countdown", () => chatState().messages.at(-1)?.includes("high demand"));
		const threadId = chat().activeThreadId;
		const detach = holdDetach();
		const switching = await startAction(() => chat().selectThread("stored-thread"));
		await waitFor("detach", () => detach.reached(threadId));
		await settle(RETRY_DELAY_MS + 60);
		assert.equal(server.turns.length, 1, "no departing request starts after the stop phase");
		if (superseded) {
			await assert.rejects((await startAction(() => chat().selectThread("broken-thread")))(), /Thread fetch failed/);
		}
		await detach.open();
		await switching();
		if (superseded) {
			await waitFor("the retained retry", () => server.turns.length === 2);
			assert.equal(server.turns[1].body.id, threadId);
			assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Retry me"]);
		} else {
			await settle(RETRY_DELAY_MS + 30);
			assert.equal(server.turns.length, 1);
			assert.deepEqual(chatState().messages, ["user:Stored question"]);
		}
	});
}

test("a retry countdown survives Activity hide and show and fires when overdue", async (t) => {
	const { server, chat, setHidden } = await mountChat(t);
	server.failNext(429, "Too many requests");
	await send(chat, "Retry after showing");
	await waitFor("the countdown", () => chatState().messages.at(-1)?.includes("high demand"));
	await setHidden(true);
	await settle(RETRY_DELAY_MS + 60);
	assert.equal(server.turns.length, 1, "hidden effects are suspended");
	await setHidden(false);
	await waitFor("the overdue retry", () => server.turns.length === 2);
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Retry after showing"]);
	assert.equal(chatState().messages.some((message) => message.includes("high demand")), false);
});

test("Stop during a retry countdown drops its status and lets the next prompt send", async (t) => {
	const { server, chat } = await mountChat(t);
	server.failNext(429, "Too many requests");
	await send(chat, "Stop retrying");
	await waitFor("the countdown", () => chatState().messages.at(-1)?.includes("high demand"));
	await (await startAction(() => chat().stopStreaming()))();
	assert.equal(chatState().messages.some((message) => message.includes("high demand")), false);
	await send(chat, "Next prompt");
	await waitFor("the next prompt", () => server.turns.length === 2);
	assert.equal(server.turns[1].body.messages.at(-1).parts[0].text, "Next prompt");
	assert.equal(chatState().messages.some((message) => message.includes("high demand")), false);
});

test("an edit stops and finishes a request whose streaming status has not committed before resending", async (t) => {
	const { server, chat } = await mountChat(t);
	await (await startAction(() => chat().activateSession({ threadId: null, messages: storedThread().messages })))();
	let createThread;
	window.testApi.createThreadGate = new Promise((resolve) => { createThread = resolve; });
	await send(chat, "Earlier request");
	await waitFor("thread creation", () => window.testApi.calls.includes("createThread:Earlier request"));
	let finished = false;
	let finishedBeforeResend = false;
	window.testApi.onRequestFinish = () => { finished = true; };
	server.respondNext(() => {});
	server.respondNext(() => { finishedBeforeResend = finished; });
	await withCommitsHeld(async () => {
		createThread();
		await waitForUncommitted("the earlier request", () => server.turns.length === 1);
		assert.equal(chat().isStreaming, false);
		void chat().editMessage("stored-user", "Edited question");
		await waitForUncommitted("the resend", () => server.turns.length === 2);
		assert.equal(server.turns[0].aborted, true, "the earlier request must be stopped before replacement");
		assert.equal(finishedBeforeResend, true, "the earlier onFinish must precede replacement");
	});
	await send(chat, "After edit");
	await settle(40);
	assert.equal(server.turns.length, 2, "the replacement remains in flight");
	server.turns[1].turnComplete();
	server.turns[1].end();
	await waitFor("the queued follow-up", () => server.turns.length === 3);
});

for (const superseded of [false, true]) {
	test(`an edit waiting for stream status ${superseded ? "resumes after a superseded switch" : "is dropped by a committed switch"}`, async (t) => {
		const { server, chat } = await mountChat(t);
		await seedThread(chat);
		await send(chat, "Live request");
		await waitFor("streaming", () => server.turns.length === 1 && chat().isStreaming);
		const detach = holdDetach();
		let edited = false;
		let switched = false;
		await withCommitsHeld(async () => {
			void chat().editMessage("stored-user", "Edited question").then(() => { edited = true; });
			await waitForUncommitted("the abort", () => server.turns[0].aborted);
			assert.equal(chat().isStreaming, true);
			void chat().selectThread("missing-thread").then(() => { switched = true; });
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		await waitFor("detach", () => detach.reached("stored-thread"));
		await settle(60);
		assert.equal(server.turns.length, 1, "the resend waits while the stop phase detaches");
		if (superseded) {
			await assert.rejects((await startAction(() => chat().selectThread("broken-thread")))(), /Thread fetch failed/);
		}
		await detach.open();
		await waitFor("the switch", () => switched);
		if (superseded) {
			await waitFor("the retained edit", () => server.turns.length === 2);
			assert.equal(server.turns[1].body.id, "stored-thread");
			assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Edited question"]);
			server.turns[1].turnComplete();
			server.turns[1].end();
		} else {
			await settle(60);
			assert.equal(server.turns.length, 1);
			assert.deepEqual(chatState().messages, []);
		}
		await waitFor("the edit action", () => edited);
	});
}

test("a first prompt awaiting thread creation survives a superseded selection", async (t) => {
	const { server, chat } = await mountChat(t);
	window.testApi.threads.set("stored-thread", storedThread());
	window.testApi.failingThreadIds = new Set(["broken-thread"]);
	let createThread;
	window.testApi.createThreadGate = new Promise((resolve) => { createThread = resolve; });
	await send(chat, "Keep my first prompt");
	await waitFor("thread creation", () => window.testApi.calls.includes("createThread:Keep my first prompt"));
	let fetchThread;
	window.testApi.threadFetchGate = new Promise((resolve) => { fetchThread = resolve; });
	const switching = await startAction(() => chat().selectThread("stored-thread"));
	const superseding = await startAction(() => chat().selectThread("broken-thread"));
	await React.act(async () => { fetchThread(); });
	await assert.rejects(superseding(), /Thread fetch failed/);
	await switching();
	await React.act(async () => { createThread(); });
	await waitFor("the retained first prompt", () => server.turns.length === 1);
	assert.deepEqual(describeMessages(server.turns[0].body.messages), ["user:Keep my first prompt"]);
	assert.equal(chat().activePrompt?.text, "Keep my first prompt");
});

test("a first prompt whose creation finishes while hidden through Activity waits for reveal before recreating and sending", async (t) => {
	const { server, chat, setHidden } = await mountChat(t);
	let createThread;
	window.testApi.createThreadGate = new Promise((resolve) => { createThread = resolve; });
	await send(chat, "First prompt");
	await waitFor("creation", () => window.testApi.calls.includes("createThread:First prompt"));
	await setHidden(true);
	await React.act(async () => { createThread(); });
	await settle(40);
	assert.equal(server.turns.length, 0, "hidden preparation must not start another request");
	await setHidden(false);
	await waitFor("the retained prompt", () => server.turns.length === 1);
	assert.deepEqual(describeMessages(server.turns[0].body.messages), ["user:First prompt"]);
	assert.equal(chat().activePrompt?.text, "First prompt");
});

for (const superseded of [false, true]) {
	test(`an edit requested during detach ${superseded ? "resumes on the retained thread" : "is dropped with the departing transcript"}`, async (t) => {
		const { server, chat } = await mountChat(t);
		await seedThread(chat);
		await send(chat, "Live request");
		await waitFor("streaming", () => server.turns.length === 1 && chat().isStreaming);
		const detach = holdDetach();
		const switching = await startAction(() => chat().selectThread("missing-thread"));
		await waitFor("detach", () => detach.reached("stored-thread"));
		const editing = await startAction(() => chat().editMessage("stored-user", "Edit during detach"));
		await settle(40);
		assert.equal(server.turns.length, 1);
		if (superseded) await assert.rejects((await startAction(() => chat().selectThread("broken-thread")))(), /Thread fetch failed/);
		await detach.open();
		await switching();
		if (superseded) {
			await waitFor("the edit", () => server.turns.length === 2);
			assert.equal(server.turns[1].body.id, "stored-thread");
			assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Edit during detach"]);
			server.turns[1].turnComplete();
			server.turns[1].end();
		} else {
			assert.equal(server.turns.length, 1);
			assert.deepEqual(chatState().messages, []);
		}
		await editing();
	});

	test(`thread creation resolving during a selection ${superseded ? "restarts for the retained first prompt" : "never sends the departing first prompt"}`, async (t) => {
		const { server, chat } = await mountChat(t);
		window.testApi.threads.set("stored-thread", storedThread());
		window.testApi.failingThreadIds = new Set(["broken-thread"]);
		let createThread;
		window.testApi.createThreadGate = new Promise((resolve) => { createThread = resolve; });
		await send(chat, "First prompt");
		await waitFor("creation", () => window.testApi.calls.includes("createThread:First prompt"));
		let fetchThread;
		window.testApi.threadFetchGate = new Promise((resolve) => { fetchThread = resolve; });
		const switching = await startAction(() => chat().selectThread("stored-thread"));
		await React.act(async () => { createThread(); });
		await settle(40);
		assert.equal(server.turns.length, 0, "creation cannot dispatch through a pending selection");
		if (superseded) {
			const superseding = await startAction(() => chat().selectThread("broken-thread"));
			await React.act(async () => { fetchThread(); });
			await assert.rejects(superseding(), /Thread fetch failed/);
		} else {
			await React.act(async () => { fetchThread(); });
		}
		await switching();
		if (superseded) {
			await waitFor("the retained prompt", () => server.turns.length === 1);
			assert.equal(window.testApi.calls.filter((call) => call === "createThread:First prompt").length, 2);
			assert.deepEqual(describeMessages(server.turns[0].body.messages), ["user:First prompt"]);
		} else {
			await settle(40);
			assert.equal(server.turns.length, 0);
			assert.equal(chat().activePrompt, null);
			assert.deepEqual(chatState().messages, ["user:Stored question"]);
		}
	});
}
