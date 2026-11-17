const assert = require("node:assert/strict");
const test = require("node:test");
const {
	React, holdDetach, mountChat, send, settle, startAction, waitFor,
} = require("./rovo-chat-turn-test-harness.js");

function gate() {
	let release;
	const promise = new Promise((resolve) => { release = resolve; });
	return { promise, open: () => React.act(async () => { release(); }) };
}
function thread(id) {
	return { id, title: id, createdAt: 1, updatedAt: 1, messages: [{ id: "u", role: "user", parts: [{ type: "text", text: id }] }], realtimeMessages: [], visibility: "private", activeDocumentId: null };
}
async function seed(chat) {
	window.testApi.threads.set("current", thread("current"));
	window.testApi.threads.set("target", thread("target"));
	await (await startAction(() => chat().selectThread("current")))();
}

// Change this effect's dependencies to exercise React's actual cleanup/setup on
// the same mounted provider, as Fast Refresh does when it ignores dependencies.
function insertionLifecycle(t) {
	const original = React.useInsertionEffect;
	const calls = { setups: 0, cleanups: 0 };
	let revision = 0;
	React.useInsertionEffect = (setup, dependencies) => original(() => {
		calls.setups += 1;
		const cleanup = setup();
		return () => { calls.cleanups += 1; cleanup?.(); };
	}, [...dependencies, revision]);
	t.after(() => { React.useInsertionEffect = original; });
	return { calls, replay: async (render) => { revision += 1; await render(false); } };
}

test("replaying the disposal effect without unmounting leaves the provider able to send", async (t) => {
	const lifecycle = insertionLifecycle(t);
	const { server, chat, setHidden } = await mountChat(t);
	await lifecycle.replay(setHidden);
	assert.deepEqual(lifecycle.calls, { setups: 2, cleanups: 1 });
	await send(chat, "After refresh");
	await waitFor("a prompt after effect replay", () => server.turns.length === 1);
	assert.equal(server.turns[0].body.messages.at(-1).parts[0].text, "After refresh");
});

for (const mode of ["StrictMode", "Activity"]) {
	test(`${mode} leaves the insertion disposal effect connected and prompts send`, async (t) => {
		const lifecycle = insertionLifecycle(t);
		const { server, chat, setHidden } = await mountChat(t, { strict: mode === "StrictMode" });
		if (mode === "Activity") {
			await setHidden(true);
			await setHidden(false);
		}
		assert.deepEqual(lifecycle.calls, { setups: 1, cleanups: 0 });
		await send(chat, `After ${mode}`);
		await waitFor("a prompt", () => server.turns.length === 1);
	});
}

test("preparation released by disposal stays cancelled after effect setup runs again", async (t) => {
	const lifecycle = insertionLifecycle(t);
	const { server, chat, setHidden } = await mountChat(t);
	await seed(chat);
	await send(chat, "Original");
	await waitFor("streaming", () => server.turns.length === 1 && chat().isStreaming);
	const detach = holdDetach();
	const selected = await startAction(() => chat().selectThread("missing"));
	await waitFor("detach", () => detach.reached("current"));
	let editSettled = false;
	await React.act(async () => {
		void chat().editMessage("u", "Cancelled edit").then(() => { editSettled = true; });
	});
	await lifecycle.replay(setHidden);
	await waitFor("cancelled preparation", () => editSettled);
	await detach.open();
	await selected();
	assert.equal(server.turns.length, 1);
	await send(chat, "New prompt");
	await waitFor("a new prompt", () => server.turns.length === 2);
	assert.equal(server.turns[1].body.messages.at(-1).parts[0].text, "New prompt");
});

for (const committed of [false, true]) {
	test(`deleting a selection target ${committed ? "after commit clears the active transcript" : "before its fetch resolves supersedes the selection"}`, async (t) => {
		const { chat } = await mountChat(t);
		await seed(chat);
		const fetching = gate();
		const deleting = gate();
		window.testApi.threadFetchGate = fetching.promise;
		window.testApi.deleteThreadGate = deleting.promise;
		const selected = await startAction(() => chat().selectThread("target"));
		if (committed) {
			await fetching.open();
			await selected();
			assert.equal(chat().activeThreadId, "target");
		}
		const deleted = await startAction(() => chat().deleteThread("target"));
		await waitFor("delete request", () => window.testApi.calls.includes("deleteThread:target"));
		if (!committed) {
			await fetching.open();
			await selected();
		}
		await deleting.open();
		await deleted();
		assert.equal(window.testApi.threads.has("target"), false);
		assert.equal(chat().activeThreadId, committed ? null : "current");
		assert.deepEqual(chat().uiMessages.map((message) => message.parts[0].text), committed ? [] : ["current"]);
		await settle();
	});
}

for (const supersedingSelection of [false, true]) {
	test(`local-turn gating ${supersedingSelection ? "passes to a superseding selection, which can finish before local work" : "holds an edit until the cancelled local action finishes"}`, async (t) => {
		const { server, chat } = await mountChat(t);
		const local = gate();
		const fetching = gate();
		let localFinished = false;
		const applied = await startAction(async () => {
			await chat().applyLocalTurn({ promptText: "Local", assistantParts: [], onApply: () => local.promise });
			localFinished = true;
		});
		await waitFor("the local transcript", () => chat().uiMessages.some((message) => message.role === "user"));
		let selected;
		if (supersedingSelection) {
			window.testApi.threadFetchGate = fetching.promise;
			window.testApi.failingThreadIds = new Set(["broken"]);
			selected = await startAction(() => chat().selectThread("broken"));
		}
		const userId = chat().uiMessages.find((message) => message.role === "user").id;
		const edited = await startAction(() => chat().editMessage(userId, "Edited"));
		await settle(20);
		assert.equal(server.turns.length, 0);
		if (supersedingSelection) {
			await fetching.open();
			await assert.rejects(selected(), /Thread fetch failed/);
			await waitFor("the edit before local work finishes", () => server.turns.length === 1);
			assert.equal(localFinished, false);
		}
		await local.open();
		await applied();
		await waitFor("the edit", () => server.turns.length === 1);
		await React.act(async () => {
			server.turns[0].turnComplete();
			server.turns[0].end();
		});
		await edited();
	});
}
