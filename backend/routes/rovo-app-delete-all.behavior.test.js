"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { access, mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadAiSdk } = require("../lib/ai-sdk-runtime");
const { createRovoAppGeneratedFilesManager } = require("../lib/rovo-app-generated-files");
const { createRovoAppManagedResponseConsumer } = require("../lib/rovo-app-managed-response-consumer");
const { createRovoAppRunManager } = require("../lib/rovo-app-runs");
const { createRovoAppRunStateService } = require("../lib/rovo-app-run-state");
const { createRovoAppThreadManager } = require("../lib/rovo-app-threads");
const { createRovoAppMessageFilePersistence } = require("../lib/rovo-app-upload-helpers");
const { createDependencies, withServer } = require("./rovo-app-test-dependencies");

const QUIET_LOGGER = { error() {}, info() {}, warn() {} };
const BULK_DELETES = ["deleteAllThreads", "deleteAllVotes", "deleteAllDocuments", "deleteAllUploads"];

function deferred() {
	return Promise.withResolvers();
}

async function createHarness(t, { synchronizeGeneratedFiles = async () => {} } = {}) {
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
		synchronizeRovoAppThreadGeneratedFiles: synchronizeGeneratedFiles,
	});
	dependencies.settleRun = service.settleRovoAppRun;
	dependencies.persistRunState = service.persistRovoAppRunState;
	return { baseDir, dependencies, manager, service, threads };
}

async function createGeneratedFilesHarness(t) {
	let persistence;
	const harness = await createHarness(t, {
		synchronizeGeneratedFiles: (...args) => persistence.synchronizeThreadGeneratedFiles(...args),
	});
	const projectRoot = path.join(harness.baseDir, "project");
	await mkdir(path.join(projectRoot, "lib"), { recursive: true });
	const files = createRovoAppGeneratedFilesManager({
		baseDir: harness.baseDir,
		projectRoot,
		logger: QUIET_LOGGER,
		// A deterministic git boundary: the temporary project has no tracked or ignored files.
		execFileImpl: (_file, _args, _options, callback) => callback(null, ""),
	});
	persistence = createRovoAppMessageFilePersistence({
		persistBrowserScreenshotBuffer: async () => null,
		rovoAppGeneratedFilesManager: files,
		rovoAppThreadManager: harness.threads,
		rovoAppUploadManager: harness.dependencies.rovoAppUploadManager,
	});
	harness.dependencies.generatedFilesManager = files;
	const generatedPath = path.join(projectRoot, "lib", "generated.js");
	const streamedMessages = [{ parts: [{
		type: "data-thinking-event",
		data: { phase: "result", toolName: "create_file", outputPreview: "Successfully created lib/generated.js." },
	}] }];
	const completeWithGeneratedFile = async (run) => {
		await writeFile(generatedPath, "module.exports = 'generated';\n");
		await harness.service.settleRovoAppRun(run, "completed", { messages: streamedMessages, streamedMessages });
		assert.equal((await files.readManifest(run.threadId)).length, 1);
	};
	return { ...harness, completeWithGeneratedFile, files, generatedPath };
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

test("local browser cleanup is sequential across many threads and waits for every run's settlement", async (t) => {
	const { dependencies, manager, service, threads } = await createHarness(t);
	const ids = Array.from({ length: 12 }, (_, index) => `thread-${index}`);
	for (const id of ids) {
		await threads.createThread({ id });
		manager.createRun({ threadId: id });
	}
	const settleEntered = deferred();
	const releaseSettle = deferred();
	const settled = new Set();
	dependencies.settleRun = async (run, outcome) => {
		await service.settleRovoAppRun(run, outcome);
		if (run.threadId === ids[0]) {
			settleEntered.resolve();
			await releaseSettle.promise;
		}
		settled.add(run.threadId);
	};
	const stages = (await threads.listThreads()).flatMap(({ id }) => [`workspace-${id}`, `mirror-${id}`]);
	const entered = new Map(stages.map((stage) => [stage, deferred()]));
	const releases = new Map(stages.map((stage) => [stage, deferred()]));
	const starts = [];
	let active = 0;
	let maximumActive = 0;
	const clean = async (stage) => {
		assert.equal(settled.size, ids.length);
		active += 1;
		maximumActive = Math.max(maximumActive, active);
		starts.push(stage);
		entered.get(stage).resolve(stage);
		await releases.get(stage).promise;
		active -= 1;
	};
	dependencies.deleteThreadBrowserWorkspace = (id) => clean(`workspace-${id}`);
	dependencies.destroyMirrorBrowser = clean;
	await withServer(dependencies, async (baseUrl) => {
		const deleting = deleteAll(baseUrl);
		try {
			await settleEntered.promise;
			assert.deepEqual(starts, []);
			releaseSettle.resolve();
			for (const [index, stage] of stages.entries()) {
				assert.equal(await Promise.race([entered.get(stage).promise, deleting]), stage);
				assert.equal(active, 1);
				assert.deepEqual(starts, stages.slice(0, index + 1));
				releases.get(stage).resolve();
			}
		} finally {
			releaseSettle.resolve();
			for (const release of releases.values()) release.resolve();
			await deleting;
		}
	}, { env: {} });
	assert.equal(maximumActive, 1);
});

test("local delete-all clears every store at the browser deadline and starts no further cleanup when the hung close resumes", async (t) => {
	const { dependencies, threads } = await createHarness(t);
	for (const id of ["thread-first", "thread-hung", "thread-unstarted"]) await threads.createThread({ id });
	dependencies.browserCleanupTimeoutMs = 10;
	const entered = deferred();
	const release = deferred();
	const starts = [];
	dependencies.deleteThreadBrowserWorkspace = async (id) => {
		starts.push(`workspace-${id}`);
		if (starts.length === 3) {
			entered.resolve();
			await release.promise;
		}
	};
	dependencies.destroyMirrorBrowser = async (id) => { starts.push(id); };
	await withServer(dependencies, async (baseUrl) => {
		const deleting = deleteAll(baseUrl);
		let watchdog;
		try {
			await entered.promise;
			assertNoBulkDelete(dependencies);
			const blocked = new Promise((resolve) => { watchdog = setTimeout(() => resolve("blocked"), 1_000); });
			assert.equal(await Promise.race([deleting, blocked]), "deleted");
			assert.equal(starts.length, 3);
			assert.deepEqual(await threads.listThreads(), []);
			assert.deepEqual(dependencies.state.calls.filter(({ method }) => BULK_DELETES.includes(method)).map(({ method }) => method), BULK_DELETES);
		} finally {
			clearTimeout(watchdog);
			release.resolve();
			await deleting;
		}
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(starts.length, 3);
	}, { env: {} });
});

test("delete-all cleans generated files after pending cancels for both local and signed-in callers", async (t) => {
	for (const local of [true, false]) {
		await t.test(local ? "local" : "signed-in", async (t) => {
			const { dependencies, manager, threads } = await createHarness(t);
			await threads.createThread({ id: "thread-live", owner: local ? "local" : "alice" });
			const run = manager.createRun({ threadId: "thread-live" });
			manager.markRunStarted(run.threadId, { status: "streaming", rovoPort: 9124 });
			const entered = deferred();
			const release = deferred();
			dependencies.cancelChat = async () => { entered.resolve(); await release.promise; };
			const cleaned = [];
			dependencies.generatedFilesManager.deleteGeneratedFilesForThreads = async (ids) => {
				cleaned.push({ ids, status: run.status });
			};
			await withServer(dependencies, async (baseUrl) => {
				const deleting = deleteAll(baseUrl, local ? undefined : { "x-slauth-subject": "alice" });
				try {
					await entered.promise;
					assert.deepEqual(cleaned, []);
				} finally {
					release.resolve();
					await deleting;
				}
			}, { env: local ? {} : { NODE_ENV: "production" } });
			assert.deepEqual(cleaned, [{ ids: [run.threadId], status: "cancelled" }]);
		});
	}
});

test("local delete-all removes files recorded during cancellation or by a late final save during browser cleanup", async (t) => {
	for (const duringCancel of [true, false]) {
		await t.test(duringCancel ? "completion during cancel" : "late completion after cancel", async (t) => {
			const { dependencies, manager, threads, completeWithGeneratedFile, generatedPath } = await createGeneratedFilesHarness(t);
			await threads.createThread({ id: "thread-live" });
			const run = manager.createRun({ threadId: "thread-live" });
			manager.markRunStarted(run.threadId, { status: "streaming", rovoPort: 9124 });
			if (duringCancel) {
				dependencies.cancelChat = async () => { await completeWithGeneratedFile(run); };
			} else {
				dependencies.deleteThreadBrowserWorkspace = async () => {
					assert.equal(run.status, "cancelled");
					await completeWithGeneratedFile(run);
				};
			}
			await withServer(dependencies, (baseUrl) => deleteAll(baseUrl), { env: {} });
			await assert.rejects(access(generatedPath), { code: "ENOENT" });
			assert.equal(await threads.getThread(run.threadId), null);
		});
	}
});

test("a final save after generated-file cleanup but before the store clear can still leave its file on disk", async (t) => {
	const { dependencies, manager, threads, completeWithGeneratedFile, generatedPath, files } = await createGeneratedFilesHarness(t);
	await threads.createThread({ id: "thread-live" });
	const run = manager.createRun({ threadId: "thread-live" });
	dependencies.generatedFilesManager = {
		...files,
		deleteGeneratedFilesForThreads: async (ids) => {
			await files.deleteGeneratedFilesForThreads(ids);
			await completeWithGeneratedFile(run);
		},
	};
	await withServer(dependencies, (baseUrl) => deleteAll(baseUrl), { env: {} });
	assert.equal(run.status, "cancelled");
	await access(generatedPath);
	assert.equal(await threads.getThread(run.threadId), null);
});

test("single-thread delete succeeds when mirror destruction rejects", async (t) => {
	const { dependencies, threads } = await createHarness(t);
	await threads.createThread({ id: "thread-live" });
	dependencies.destroyMirrorBrowser = async () => { throw new Error("mirror unavailable"); };
	await withServer(dependencies, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/rovo/threads/thread-live`, { method: "DELETE" });
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { deleted: true });
	}, { env: {} });
	assert.equal(await threads.getThread("thread-live"), null);
});

test("the cancel endpoint succeeds when cancelChat throws synchronously", async (t) => {
	const { dependencies, manager } = await createHarness(t);
	const run = manager.createRun({ threadId: "thread-live" });
	manager.markRunStarted(run.threadId, { status: "streaming", rovoPort: 9124 });
	dependencies.cancelChat = () => { throw new Error("cancel unavailable"); };
	await withServer(dependencies, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/rovo/runs/thread-live/cancel`, { method: "POST" });
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { cancelled: true });
	}, { env: {} });
	assert.equal(run.status, "cancelled");
});
