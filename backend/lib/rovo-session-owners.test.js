"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoSessionOwnerIndex, getRovoSessionOwnerIndex } = require("./rovo-session-owners");

const ALICE = Object.freeze({ owner: "alice", local: false });
const BOB = Object.freeze({ owner: "bob", local: false });
const LOCAL = Object.freeze({ owner: "local", local: true });

function threadManager(threads) {
	let lists = 0;
	return {
		get lists() {
			return lists;
		},
		listThreads: async ({ filter } = {}) => {
			lists += 1;
			return threads.filter((thread) => !filter || filter(thread));
		},
	};
}

test("stored threads bind their sessions to their owner, once", async () => {
	const manager = threadManager([
		{ id: "a", owner: "alice", sessionId: "s-alice" },
		{ id: "run", owner: "alice", activeRun: { sessionId: "s-run" } },
		{ id: "legacy", owner: null, sessionId: "s-legacy" },
		{ id: "b1", owner: "bob", sessionId: "s-shared" },
		{ id: "a2", owner: "alice", sessionId: "s-shared" },
	]);
	const index = createRovoSessionOwnerIndex(manager);
	assert.equal(await index.owns(ALICE, "s-alice"), true);
	assert.equal(await index.owns(ALICE, "s-run"), true);
	assert.equal(await index.owns(BOB, "s-alice"), false);
	// No owner: only a local caller. Two owners: nobody but a local caller.
	assert.equal(await index.owns(ALICE, "s-legacy"), false);
	assert.equal(await index.owns(BOB, "s-shared"), false);
	assert.equal(await index.owns(ALICE, "s-shared"), false);
	assert.equal(await index.owns(ALICE, "s-unbound"), false);
	assert.equal(await index.owns(LOCAL, "s-alice"), true);
	assert.equal(await index.owns(null, "s-alice"), false);
	assert.equal(manager.lists, 1);
});

test("an unclaimed session becomes the first claimer's, and nobody else can claim it", async () => {
	const index = createRovoSessionOwnerIndex(threadManager([{ id: "legacy", owner: null, sessionId: "s-legacy" }]));
	assert.equal(await index.claim(BOB, "s-new"), true);
	assert.equal(await index.claim(BOB, "s-new"), true);
	assert.equal(await index.claim(ALICE, "s-new"), false);
	assert.equal(await index.owns(BOB, "s-new"), true);
	assert.equal(await index.claim(ALICE, "s-legacy"), false);
	assert.equal(await index.claim(LOCAL, "s-new"), true);
	assert.equal(await index.claim(null, "s-other"), false);
});

test("one index per thread store", () => {
	const manager = threadManager([]);
	assert.equal(getRovoSessionOwnerIndex(manager), getRovoSessionOwnerIndex(manager));
	assert.notEqual(getRovoSessionOwnerIndex(manager), getRovoSessionOwnerIndex(threadManager([])));
});
