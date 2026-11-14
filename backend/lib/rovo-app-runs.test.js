const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { createRovoAppRunManager } = require("./rovo-app-runs");

function createMockResponse() {
	const emitter = new EventEmitter();
	const headers = new Map();
	const writes = [];

	return {
		ended: false,
		headers,
		statusCode: null,
		writes,
		end() {
			this.ended = true;
		},
		emit(eventName) {
			emitter.emit(eventName);
		},
		flushHeaders() {},
		once(eventName, listener) {
			emitter.once(eventName, listener);
			return this;
		},
		setHeader(name, value) {
			headers.set(name, value);
		},
		status(code) {
			this.statusCode = code;
			return this;
		},
		write(chunk) {
			writes.push(chunk);
		},
	};
}

test("run manager replays buffered chunks to late subscribers and returns to background when detached", () => {
	const manager = createRovoAppRunManager();
	const run = manager.createRun({
		backend: "rovo",
		threadId: "thread-1",
		requestBody: { id: "thread-1", messages: [] },
	});
	assert.equal(run.backend, "rovo");

	manager.enqueueRun(run.threadId);
	manager.markRunStarted(run.threadId, {
		backend: "rovo",
		portIndex: 1,
		rovoPort: 8001,
		status: "background",
	});
	manager.appendChunk(run.threadId, "data: first\n\n");

	const firstSubscriber = createMockResponse();
	const firstSubscriberId = manager.attachSubscriber(run.threadId, firstSubscriber);
	assert.ok(firstSubscriberId);
	assert.equal(manager.getRun(run.threadId)?.backend, "rovo");
	assert.equal(manager.getRun(run.threadId)?.status, "streaming");
	assert.deepEqual(firstSubscriber.writes, ["data: first\n\n"]);

	manager.appendChunk(run.threadId, "data: second\n\n");
	assert.deepEqual(firstSubscriber.writes, [
		"data: first\n\n",
		"data: second\n\n",
	]);

	firstSubscriber.emit("close");
	assert.equal(manager.getRun(run.threadId)?.status, "background");

	const secondSubscriber = createMockResponse();
	manager.attachSubscriber(run.threadId, secondSubscriber);
	assert.deepEqual(secondSubscriber.writes, [
		"data: first\n\n",
		"data: second\n\n",
	]);
});

test("settleRun cancelled aborts the run, ends subscribers, and clears queued entries", () => {
	const manager = createRovoAppRunManager();
	const run = manager.createRun({
		threadId: "thread-2",
		requestBody: { id: "thread-2", messages: [] },
		requestedPortIndex: 2,
	});
	const response = createMockResponse();
	manager.attachSubscriber(run.threadId, response);

	manager.enqueueRun(run.threadId);
	const cancelledRun = manager.settleRun(run.threadId, { outcome: "cancelled" });
	assert.equal(cancelledRun, run);
	assert.equal(run.status, "cancelled");
	assert.equal(run.abortController.signal.aborted, true);
	assert.equal(response.ended, true);
	assert.equal(manager.getRun(run.threadId), null);
	assert.deepEqual(manager.listQueuedThreadIds(), []);
});

test("settleRun settles a run once, and only the run it names", () => {
	const manager = createRovoAppRunManager();
	const first = manager.createRun({ threadId: "thread-1" });
	manager.markRunStarted("thread-1", { status: "background" });

	assert.equal(manager.settleRun("thread-1", { outcome: "completed", runId: "another-run" }), null);
	assert.equal(manager.getRun("thread-1"), first);
	assert.equal(manager.settleRun("thread-1", { outcome: "paused" }), null);
	assert.equal(manager.settleRun("thread-1", { outcome: "failed", runId: first.id, error: new Error("boom") }), first);
	assert.equal(first.status, "failed");
	assert.equal(first.error, "boom");
	assert.equal(first.abortController.signal.aborted, false);

	const second = manager.createRun({ threadId: "thread-1" });
	assert.notEqual(second, first);
	assert.equal(manager.settleRun("thread-1", { outcome: "cancelled", runId: first.id }), null);
	assert.equal(manager.getRun("thread-1"), second);
	assert.equal(second.status, "queued");
});

test("a settled run's status no longer follows subscribers or status updates", () => {
	const manager = createRovoAppRunManager();
	const run = manager.createRun({ threadId: "thread-1" });
	manager.markRunStarted("thread-1", { status: "streaming" });
	manager.settleRun("thread-1", { outcome: "completed" });

	assert.equal(manager.setRunStatus("thread-1", "background"), null);
	assert.equal(manager.markRunStarted("thread-1", { status: "streaming" }), null);
	assert.equal(run.status, "completed");
});

test("setRunBackend records backend ownership and clears Rovo port for AI Gateway runs", () => {
	const manager = createRovoAppRunManager();
	const run = manager.createRun({
		backend: "rovo",
		threadId: "thread-3",
		requestBody: { id: "thread-3", messages: [] },
	});

	manager.markRunStarted(run.threadId, {
		backend: "rovo",
		portIndex: 0,
		rovoPort: 8000,
		status: "streaming",
	});

	const updatedRun = manager.setRunBackend(run.threadId, "ai-gateway");
	assert.equal(updatedRun?.backend, "ai-gateway");
	assert.equal(updatedRun?.assignedPortIndex, null);
	assert.equal(updatedRun?.rovoPort, null);
	assert.equal(manager.getRun(run.threadId)?.backend, "ai-gateway");
});

test("a replaced run stays superseded after its successor ends, and its chunks never reach the successor", () => {
	const manager = createRovoAppRunManager();
	const first = manager.createRun({ threadId: "thread-1" });
	assert.equal(manager.isLatestRun(first), true);
	assert.equal(manager.isCurrentRun(first), true);
	manager.settleRun("thread-1", { outcome: "cancelled", runId: first.id });
	assert.equal(manager.isLatestRun(first), true);
	assert.equal(manager.isCurrentRun(first), false);

	const second = manager.createRun({ threadId: "thread-1" });
	const response = createMockResponse();
	manager.attachSubscriber("thread-1", response);
	assert.equal(manager.appendChunk("thread-1", "old", { runId: first.id }), false);
	assert.equal(manager.setRunBackend("thread-1", "rovo", { runId: first.id }), null);
	assert.equal(manager.appendChunk("thread-1", "new", { runId: second.id }), true);
	assert.deepEqual(second.bufferedChunks, ["new"]);
	assert.deepEqual(response.writes, ["new"]);
	assert.equal(second.backend, "ai-gateway");

	manager.settleRun("thread-1", { outcome: "completed", runId: second.id });
	assert.equal(manager.isLatestRun(first), false);
	assert.equal(manager.isLatestRun(second), true);
});

test("the latest-run record is bounded and forgets only threads with no live run", () => {
	const manager = createRovoAppRunManager({ maxTrackedThreads: 2 });
	const live = manager.createRun({ threadId: "live" });
	const done = manager.createRun({ threadId: "done" });
	manager.settleRun("done", { outcome: "completed" });
	const third = manager.createRun({ threadId: "third" });

	assert.equal(manager.isLatestRun(live), true);
	assert.equal(manager.isLatestRun(third), true);
	// Forgotten: a forgotten run counts as superseded, so its late writes are dropped.
	assert.equal(manager.isLatestRun(done), false);
});
