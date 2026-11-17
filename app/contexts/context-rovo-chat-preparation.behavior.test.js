const assert = require("node:assert/strict");
const test = require("node:test");
const {
	React, RETRY_DELAY_MS, chatState, describeMessages, holdDetach, mountChat,
	send, settle, startAction, waitFor, withCommitsHeld, waitForUncommitted,
} = require("./rovo-chat-turn-test-harness.js");

const creationCalls = () => window.testApi.calls.filter((call) => call.startsWith("createThread:"));
function gate() {
	let open;
	const promise = new Promise((resolve) => { open = resolve; });
	return { promise, release: () => open(), open: () => React.act(async () => { open(); }) };
}
function thread(id = "stored") {
	return { id, title: id, createdAt: 1, updatedAt: 1, messages: [{ id: "u", role: "user", parts: [{ type: "text", text: "Stored" }] }], realtimeMessages: [], visibility: "private", activeDocumentId: null };
}
async function seed(chat) {
	window.testApi.threads.set("stored", thread());
	await (await startAction(() => chat().selectThread("stored")))();
}

for (const creationFirst of [false, true]) {
	test(`Stop ends a first prompt during thread creation when ${creationFirst ? "creation resolves before Stop settles" : "Stop settles before creation resolves"}`, async (t) => {
		const { server, chat } = await mountChat(t);
		const creation = gate();
		window.testApi.createThreadGate = creation.promise;
		await send(chat, "First prompt");
		await waitFor("creation", () => creationCalls().length === 1);
		if (creationFirst) {
			const stop = gate();
			window.testApi.stopGate = stop.promise;
			await withCommitsHeld(async () => {
				let stopped = false;
				const stopping = chat().stopStreaming().then(() => { stopped = true; });
				creation.release();
				await waitForUncommitted("the saved thread", () => window.testApi.threads.size === 1);
				assert.equal(stopped, false);
				stop.release();
				await stopping;
			});
		} else {
			await (await startAction(() => chat().stopStreaming()))();
			await creation.open();
		}
		await waitFor("the prompt to settle", () => chat().activePrompt === null);
		assert.equal(server.turns.length, 0);
		assert.equal(chat().isSubmitPending, false);
		assert.equal(creationCalls().length, 1);
	});
}

for (const cutoff of ["failed selection", "superseded selection", "Activity hide", "unrelated delete", "second submit after local cancellation"]) {
	test(`a creation cut off by ${cutoff} is adopted once for the same transcript`, async (t) => {
		const { server, chat, setHidden } = await mountChat(t);
		const creation = gate();
		window.testApi.createThreadGate = creation.promise;
		window.testApi.failingThreadIds = new Set(["broken"]);
		if (cutoff === "second submit after local cancellation") {
			const applying = await startAction(() => chat().applyLocalTurn({ promptText: "Local", assistantParts: [] }));
			await waitFor("local creation", () => creationCalls().length === 1);
			await send(chat, "First prompt");
			await applying();
		} else {
			await send(chat, "First prompt");
			await waitFor("creation", () => creationCalls().length === 1);
		}
		if (cutoff === "failed selection") {
			await assert.rejects((await startAction(() => chat().selectThread("broken")))(), /Thread fetch failed/);
		} else if (cutoff === "superseded selection") {
			const fetching = gate();
			window.testApi.threadFetchGate = fetching.promise;
			const selecting = await startAction(() => chat().selectThread("missing"));
			const failing = await startAction(() => chat().selectThread("broken"));
			await fetching.open();
			await assert.rejects(failing(), /Thread fetch failed/);
			await selecting();
		} else if (cutoff === "Activity hide") {
			await setHidden(true);
		} else if (cutoff === "unrelated delete") {
			await (await startAction(() => chat().deleteThread("other")))();
		} else {
			await send(chat, "Second prompt");
		}
		await creation.open();
		if (cutoff === "Activity hide") await setHidden(false);
		await waitFor("the prompt", () => server.turns.length === 1);
		assert.equal(creationCalls().length, 1, "reuse the saved thread instead of creating another");
		assert.equal(window.testApi.threads.size, 1);
		assert.equal(server.turns[0].body.id, [...window.testApi.threads.keys()][0]);
	});
}

test("a creation from a replaced transcript is never adopted by its replacement", async (t) => {
	const { server, chat } = await mountChat(t);
	const creations = new Map();
	window.testApi.createThreadGate = (title) => {
		const creation = gate();
		creations.set(title, creation);
		return creation.promise;
	};
	await send(chat, "Departing");
	await waitFor("departing creation", () => creations.has("Departing"));
	await (await startAction(() => chat().selectThread("missing")))();
	await send(chat, "Replacement");
	await waitFor("replacement creation", () => creations.has("Replacement"));
	await creations.get("Departing").open();
	await settle(30);
	assert.equal(chat().activeThreadId, null);
	assert.equal(server.turns.length, 0);
	await creations.get("Replacement").open();
	await waitFor("replacement request", () => server.turns.length === 1);
	assert.deepEqual(describeMessages(server.turns[0].body.messages), ["user:Replacement"]);
	assert.equal(window.testApi.threads.get(server.turns[0].body.id).title, "Replacement");
});

test("queued prompts keep dispatching while the provider is hidden through Activity", async (t) => {
	const { server, chat, setHidden } = await mountChat(t);
	const creation = gate();
	window.testApi.createThreadGate = creation.promise;
	server.failNext(400, "First request failed");
	await send(chat, "First");
	await waitFor("creation", () => creationCalls().length === 1);
	await send(chat, "Queued");
	await setHidden(true);
	await withCommitsHeld(async () => {
		creation.release();
		await waitForUncommitted("both requests while hidden", () => server.turns.length === 2);
	});
	assert.equal(server.turns[1].body.messages.at(-1).parts[0].text, "Queued");
});

for (const kind of ["retry", "edit"]) {
	test(`deleting another thread does not gate a ${kind}`, async (t) => {
		const { server, chat } = await mountChat(t);
		await seed(chat);
		if (kind === "retry") server.failNext(429, "Too many requests");
		await send(chat, "Question");
		await waitFor("request", () => server.turns.length === 1);
		if (kind === "retry") await waitFor("countdown", () => chatState().messages.at(-1)?.includes("high demand"));
		const deleting = gate();
		window.testApi.deleteThreadGate = deleting.promise;
		const deleted = await startAction(() => chat().deleteThread("other"));
		let edited;
		if (kind === "edit") edited = await startAction(() => chat().editMessage("u", "Edited"));
		await waitFor("request before unrelated deletion finishes", () => server.turns.length === 2);
		assert.equal(server.turns[1].body.id, "stored");
		await deleting.open();
		await deleted();
		await React.act(async () => {
			server.turns[1].turnComplete();
			server.turns[1].end();
		});
		if (edited) await edited();
	});
}

test("a fired retry waiting for detach shows no countdown", async (t) => {
	const { server, chat } = await mountChat(t);
	await seed(chat);
	server.failNext(429, "Too many requests");
	await send(chat, "Question");
	await waitFor("countdown", () => chatState().messages.at(-1)?.includes("high demand"));
	const detach = holdDetach();
	const selecting = await startAction(() => chat().selectThread("missing"));
	await waitFor("detach", () => detach.reached("stored"));
	await settle(RETRY_DELAY_MS + 50);
	assert.equal(server.turns.length, 1);
	assert.equal(chatState().messages.some((message) => message.includes("high demand")), false);
	await detach.open();
	await selecting();
});

for (const action of ["Stop", "reset"]) {
	test(`a stale retry countdown tick cannot reappear after ${action} before React commits`, async (t) => {
		const { server, chat } = await mountChat(t);
		await seed(chat);
		const interval = globalThis.setInterval;
		let tick;
		globalThis.setInterval = (callback, delay, ...args) => {
			if (delay === 1000) tick = callback;
			return interval(callback, delay, ...args);
		};
		t.after(() => { globalThis.setInterval = interval; });
		server.failNext(429, "Too many requests");
		await send(chat, "Question");
		await waitFor("countdown", () => tick && chatState().messages.at(-1)?.includes("high demand"));
		const detach = holdDetach();
		await withCommitsHeld(async () => {
			if (action === "Stop") await chat().stopStreaming();
			else chat().resetChat();
			tick();
		});
		assert.equal(chatState().messages.some((message) => message.includes("high demand")), false);
		await detach.open();
	});
}

const CHANGES = [
	{ name: "resetChat", run: (chat) => chat().resetChat() },
	{ name: "deleteAllThreads", run: (chat) => chat().deleteAllThreads() },
	{ name: "deleteThread(active)", run: (chat) => chat().deleteThread("stored") },
];
for (const change of CHANGES) {
	for (const kind of ["retry", "edit"]) {
		test(`${kind} due while ${change.name} detaches never reaches the departing or replacement transcript`, async (t) => {
			const { server, chat } = await mountChat(t);
			await seed(chat);
			if (kind === "retry") server.failNext(429, "Too many requests");
			await send(chat, "Question");
			await waitFor("request", () => server.turns.length === 1 && (kind === "retry" ? !chat().isStreaming : chat().isStreaming));
			const detach = holdDetach();
			let changing;
			if (kind === "edit") {
				await withCommitsHeld(async () => {
					void chat().editMessage("u", "Edited");
					await waitForUncommitted("abort", () => server.turns[0].aborted);
					changing = change.run(chat);
					await new Promise((resolve) => setTimeout(resolve, 10));
				});
			} else {
				const finished = await startAction(() => change.run(chat));
				changing = finished;
			}
			await waitFor("detach", () => detach.reached("stored"));
			await settle(RETRY_DELAY_MS + 40);
			assert.equal(server.turns.length, 1);
			await detach.open();
			if (typeof changing === "function") await changing();
			else await changing;
			await settle(30);
			assert.equal(server.turns.length, 1);
		});
	}
}

test("Stop while an edit waits at the gate preserves today's behavior: the edit resends", async (t) => {
	const { server, chat } = await mountChat(t);
	await seed(chat);
	await send(chat, "Question");
	await waitFor("streaming", () => server.turns.length === 1 && chat().isStreaming);
	const detach = holdDetach();
	const selecting = await startAction(() => chat().selectThread("missing"));
	await waitFor("detach", () => detach.reached("stored"));
	const editing = await startAction(() => chat().editMessage("u", "Edited"));
	await (await startAction(() => chat().stopStreaming()))();
	await waitFor("edit after Stop", () => server.turns.length === 2);
	assert.equal(server.turns[1].body.id, "stored");
	assert.deepEqual(describeMessages(server.turns[1].body.messages), ["user:Edited"]);
	await detach.open();
	await selecting();
	server.turns[1].turnComplete();
	server.turns[1].end();
	await editing();
});

test("unmount releases a gated preparation without sending, setting state, or rejecting", async (t) => {
	const original = React.useState;
	let unmounted = false;
	let updates = 0;
	React.useState = (...args) => {
		const [state, setState] = original(...args);
		return [state, (...next) => { if (unmounted) updates += 1; return setState(...next); }];
	};
	t.after(() => { React.useState = original; });
	const { server, chat, unmount } = await mountChat(t);
	await seed(chat);
	await send(chat, "Question");
	await waitFor("streaming", () => server.turns.length === 1 && chat().isStreaming);
	const detach = holdDetach();
	const selecting = await startAction(() => chat().selectThread("missing"));
	await waitFor("detach", () => detach.reached("stored"));
	let editSettled = false;
	let editError = null;
	let editing;
	await React.act(async () => {
		editing = chat().editMessage("u", "Edited").then(
			() => { editSettled = true; },
			(error) => { editSettled = true; editError = error; },
		);
	});
	await unmount();
	unmounted = true;
	await waitForUncommitted("the gated edit to exit on unmount", () => editSettled);
	await detach.open();
	await selecting();
	await editing;
	assert.equal(server.turns.length, 1);
	assert.equal(updates, 0);
	assert.equal(editError, null);
});
