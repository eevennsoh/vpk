"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadAiSdk } = require("../lib/ai-sdk-runtime");
const { createRovoAppManagedResponseConsumer } = require("../lib/rovo-app-managed-response-consumer");
const { createRovoAppRunManager } = require("../lib/rovo-app-runs");
const { createRovoAppRunStateService } = require("../lib/rovo-app-run-state");
const { createRovoAppThreadManager } = require("../lib/rovo-app-threads");
const { createDependencies, withServer } = require("./rovo-app-test-dependencies");

const QUIET_LOGGER = { error() {}, info() {}, warn() {} };
const BULK_DELETES = ["deleteAllThreads", "deleteAllVotes", "deleteAllDocuments", "deleteAllUploads"];

function deferred() {
	return Promise.withResolvers();
}

async function createHarness(t) {
	const baseDir = await mkdtemp(path.join(os.tmpdir(), "rovo-delete-all-"));
	t.after(() => rm(baseDir, { recursive: true, force: true }));
	const manager = createRovoAppRunManager({ logger: QUIET_LOGGER });
	const dependencies = createDependencies({ logger: QUIET_LOGGER, rovoAppRunManager: manager });
	const threads = createRovoAppThreadManager({ baseDir, logger: QUIET_LOGGER });
	dependencies.rovoAppThreadManager = {
		...threads,
		deleteAllThreads: async () => {
			dependencies.state.calls.push({ method: "deleteAllThreads" });
			await threads.deleteAllThreads();
		},
	};
	const service = createRovoAppRunStateService({
		activeRequests: new Map(),
		logger: QUIET_LOGGER,
		rovoAppRunManager: manager,
		rovoAppThreadManager: dependencies.rovoAppThreadManager,
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
	});
	dependencies.settleRun = service.settleRovoAppRun;
	dependencies.persistRunState = service.persistRovoAppRunState;
	return { dependencies, manager, service, threads };
}

async function deleteAll(baseUrl, headers) {
	const response = await fetch(`${baseUrl}/api/rovo/threads?all=true`, { method: "DELETE", headers });
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { deleted: true });
	return "deleted";
}

function assertNoBulkDelete(dependencies) {
	assert.equal(dependencies.state.calls.some(({ method }) => BULK_DELETES.includes(method)), false);
}

test("local delete-all waits for port cancellation and settlement before clearing any store, including threadless runs", async (t) => {
	const { dependencies, manager, service, threads } = await createHarness(t);
	const runs = [];
	for (const [threadId, status, rovoPort] of [
		["thread-streaming", "streaming", 9124],
		["thread-background", "background", null],
		["thread-queued", "queued", null],
		["thread-missing", "background", 9125],
	]) {
		if (threadId !== "thread-missing") await threads.createThread({ id: threadId });
		const run = manager.createRun({ threadId });
		if (status !== "queued") manager.markRunStarted(threadId, { status, rovoPort });
		assert.equal(run.status, status);
		runs.push(run);
	}
	const cancelEntered = deferred();
	const releaseCancel = deferred();
	const settleEntered = deferred();
	const releaseSettle = deferred();
	const cancelledPorts = [];
	dependencies.cancelChat = async (port) => {
		cancelledPorts.push(port);
		if (port === 9124) {
			cancelEntered.resolve("cancelling");
			await releaseCancel.promise;
		}
	};
	dependencies.settleRun = async (run, outcome) => {
		const settled = await service.settleRovoAppRun(run, outcome);
		if (run === runs[0]) {
			settleEntered.resolve("settling");
			await releaseSettle.promise;
		}
		return settled;
	};
	await withServer(dependencies, async (baseUrl) => {
		const deleting = deleteAll(baseUrl);
		try {
			assert.equal(await Promise.race([cancelEntered.promise, deleting]), "cancelling");
			assertNoBulkDelete(dependencies);
			assert.equal(runs[0].status, "streaming");
			releaseCancel.resolve();
			assert.equal(await Promise.race([settleEntered.promise, deleting]), "settling");
			assert.equal(runs[0].status, "cancelled");
			assertNoBulkDelete(dependencies);
		} finally {
			releaseCancel.resolve();
			releaseSettle.resolve();
			await deleting;
		}
	}, { env: {} });
	assert.deepEqual(cancelledPorts.sort(), [9124, 9125]);
	assert.deepEqual(manager.listRuns(), []);
	for (const run of runs) {
		assert.equal(run.status, "cancelled");
		assert.equal(run.abortController.signal.aborted, true);
	}
	assert.deepEqual(await threads.listThreads(), []);
	assert.deepEqual(dependencies.state.calls.filter(({ method }) => BULK_DELETES.includes(method)).map(({ method }) => method), BULK_DELETES);
});

test("local delete-all settles runs even when Rovo cancellation rejects or throws", async (t) => {
	for (const synchronous of [false, true]) {
		await t.test(synchronous ? "synchronous cancel failure" : "rejected cancel", async (t) => {
			const { dependencies, manager, threads } = await createHarness(t);
			await threads.createThread({ id: "thread-live" });
			const run = manager.createRun({ threadId: "thread-live" });
			manager.markRunStarted(run.threadId, { status: "streaming", rovoPort: 9124 });
			const orphan = manager.createRun({ threadId: "thread-missing" });
			dependencies.cancelChat = synchronous
				? () => { throw new Error("cancel unavailable"); }
				: async () => { throw new Error("cancel unavailable"); };
			await withServer(dependencies, (baseUrl) => deleteAll(baseUrl), { env: {} });
			assert.equal(run.status, "cancelled");
			assert.equal(orphan.status, "cancelled");
			assert.deepEqual(manager.listRuns(), []);
			assert.deepEqual(await threads.listThreads(), []);
		});
	}
});

test("local delete-all awaits workspace and mirror cleanup for every stored thread and tolerates their failures", async (t) => {
	const { dependencies, threads } = await createHarness(t);
	// The bulk delete also removes records created under another identity mode.
	await threads.createThread({ id: "thread-foreign", owner: "alice" });
	await threads.createThread({ id: "thread-idle" });
	const workspaceEntered = deferred();
	const releaseWorkspace = deferred();
	const mirrorEntered = deferred();
	const releaseMirror = deferred();
	const workspaces = [];
	const mirrors = [];
	dependencies.deleteThreadBrowserWorkspace = async (threadId) => {
		workspaces.push(threadId);
		if (threadId === "thread-idle") {
			workspaceEntered.resolve("workspace");
			await releaseWorkspace.promise;
		}
		throw new Error("workspace already gone");
	};
	dependencies.destroyMirrorBrowser = async (mirrorId) => {
		mirrors.push(mirrorId);
		if (mirrorId === "mirror-thread-idle") {
			mirrorEntered.resolve("mirror");
			await releaseMirror.promise;
		}
		throw new Error("mirror already gone");
	};
	await withServer(dependencies, async (baseUrl) => {
		const deleting = deleteAll(baseUrl);
		try {
			assert.equal(await Promise.race([workspaceEntered.promise, deleting]), "workspace");
			assertNoBulkDelete(dependencies);
			releaseWorkspace.resolve();
			assert.equal(await Promise.race([mirrorEntered.promise, deleting]), "mirror");
			assertNoBulkDelete(dependencies);
		} finally {
			releaseWorkspace.resolve();
			releaseMirror.resolve();
			await deleting;
		}
	}, { env: {} });
	assert.deepEqual(workspaces.sort(), ["thread-foreign", "thread-idle"]);
	assert.deepEqual(mirrors.sort(), ["mirror-thread-foreign", "mirror-thread-idle"]);
	assert.deepEqual(await threads.listThreads(), []);
});

test("local delete-all aborts a mid-stream run, ends its subscriber, and late stream completion cannot restore its thread", async (t) => {
	await loadAiSdk();
	const { dependencies, manager, service, threads } = await createHarness(t);
	await threads.createThread({ id: "thread-live" });
	const run = manager.createRun({ threadId: "thread-live" });
	const subscriber = Object.assign(new EventEmitter(), {
		ended: false,
		writes: [],
		end() { this.ended = true; },
		write(chunk) { this.writes.push(chunk); },
	});
	manager.attachSubscriber(run.threadId, subscriber);
	manager.markRunStarted(run.threadId, { status: "streaming", rovoPort: 9124 });
	const firstChunk = deferred();
	const encoder = new TextEncoder();
	let streamController;
	const enqueue = (events) => streamController.enqueue(encoder.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")));
	const response = new Response(new ReadableStream({
		start(controller) {
			streamController = controller;
		},
	}), { headers: { "content-type": "text/event-stream" } });
	const { consumeRovoAppManagedResponse } = createRovoAppManagedResponseConsumer({
		...service,
		logger: QUIET_LOGGER,
		rovoAppRunManager: {
			...manager,
			appendChunk: (...args) => {
				const appended = manager.appendChunk(...args);
				firstChunk.resolve();
				return appended;
			},
		},
		rovoAppThreadManager: threads,
		syncRovoAppThreadSession: async () => null,
	});
	const consuming = consumeRovoAppManagedResponse({
		initialMessages: [], response, run, stageTrace: { mark() {} }, threadId: run.threadId,
	});
	enqueue([
		{ type: "start", messageId: "assistant-1" },
		{ type: "text-start", id: "text-1" },
		{ type: "text-delta", id: "text-1", delta: "Partial" },
	]);
	await firstChunk.promise;
	assert.ok(subscriber.writes.length > 0);
	try {
		await withServer(dependencies, async (baseUrl) => {
			await deleteAll(baseUrl);
			assert.equal(run.status, "cancelled");
			assert.equal(run.abortController.signal.aborted, true);
			assert.equal(subscriber.ended, true);
			assert.equal(manager.getRun(run.threadId), null);
			assert.equal(await threads.getThread(run.threadId), null);
		}, { env: {} });
	} finally {
		// Buffered data may arrive after abort. Let the real consumer try its final save.
		enqueue([{ type: "text-end", id: "text-1" }, { type: "finish", finishReason: "stop" }]);
		streamController.close();
		await consuming;
	}
	assert.equal(run.status, "cancelled");
	assert.equal(await threads.getThread(run.threadId), null);
	assert.deepEqual(await threads.listThreads(), []);
});

test("a run created after local delete-all snapshots runs survives even though the bulk clear removes its thread", async (t) => {
	const { dependencies, manager, threads } = await createHarness(t);
	await threads.createThread({ id: "thread-original" });
	const original = manager.createRun({ threadId: "thread-original" });
	manager.markRunStarted(original.threadId, { status: "streaming", rovoPort: 9124 });
	const cancelEntered = deferred();
	const releaseCancel = deferred();
	dependencies.cancelChat = async () => {
		cancelEntered.resolve("cancelling");
		await releaseCancel.promise;
	};
	await withServer(dependencies, async (baseUrl) => {
		const deleting = deleteAll(baseUrl);
		try {
			assert.equal(await Promise.race([cancelEntered.promise, deleting]), "cancelling");
			await threads.createThread({ id: "thread-new" });
			const newcomer = manager.createRun({ threadId: "thread-new" });
			manager.markRunStarted(newcomer.threadId, { status: "streaming" });
			releaseCancel.resolve();
			await deleting;
			assert.equal(original.status, "cancelled");
			assert.equal(manager.getRun(newcomer.threadId), newcomer);
			assert.equal(newcomer.status, "streaming");
			assert.equal(newcomer.abortController.signal.aborted, false);
			assert.equal(await threads.getThread(newcomer.threadId), null);
		} finally {
			releaseCancel.resolve();
			await deleting;
		}
	}, { env: {} });
});

test("non-local delete-all cancels only the caller's runs and leaves foreign and threadless live runs streaming", async (t) => {
	const { dependencies, manager, threads } = await createHarness(t);
	await threads.createThread({ id: "thread-alice", owner: "alice" });
	await threads.createThread({ id: "thread-bob", owner: "bob" });
	const runs = ["thread-alice", "thread-bob", "thread-missing"].map((threadId, index) => {
		const run = manager.createRun({ threadId });
		manager.markRunStarted(threadId, { status: "streaming", rovoPort: 9124 + index });
		return run;
	});
	await withServer(dependencies, (baseUrl) => deleteAll(baseUrl, { "x-slauth-subject": "alice" }), { env: { NODE_ENV: "production" } });
	assert.equal(runs[0].status, "cancelled");
	for (const run of runs.slice(1)) {
		assert.equal(manager.getRun(run.threadId), run);
		assert.equal(run.status, "streaming");
		assert.equal(run.abortController.signal.aborted, false);
	}
	assert.deepEqual((await threads.listThreads()).map(({ id }) => id), ["thread-bob"]);
	assertNoBulkDelete(dependencies);
	assert.deepEqual(dependencies.state.calls.filter(({ method }) => method === "cancelChat").map(({ port }) => port), [9124]);
	assert.deepEqual(dependencies.state.calls.filter(({ method }) => method === "deleteThreadBrowserWorkspace").map(({ threadId }) => threadId), ["thread-alice"]);
	assert.deepEqual(dependencies.state.calls.filter(({ method }) => method === "destroyMirrorBrowser").map(({ mirrorId }) => mirrorId), ["mirror-thread-alice"]);
});
