const test = require("node:test")
const assert = require("node:assert/strict")

const {
	completeBrowserPreviewFrameLoad,
	createBrowserPreviewFrameQueueState,
	enqueueBrowserPreviewFrame,
} = require("./browser-preview-frame-queue.ts")

test("starts loading immediately when the queue is idle", () => {
	const result = enqueueBrowserPreviewFrame(
		createBrowserPreviewFrameQueueState(),
		"frame-a",
	)

	assert.equal(result.frameToLoad, "frame-a")
	assert.deepEqual(result.nextState, {
		inflightFrame: "frame-a",
		pendingFrame: null,
	})
})

test("keeps only the latest pending frame while a load is in flight", () => {
	const first = enqueueBrowserPreviewFrame(
		createBrowserPreviewFrameQueueState(),
		"frame-a",
	)
	const second = enqueueBrowserPreviewFrame(first.nextState, "frame-b")
	const third = enqueueBrowserPreviewFrame(second.nextState, "frame-c")

	assert.equal(second.frameToLoad, null)
	assert.equal(third.frameToLoad, null)
	assert.deepEqual(third.nextState, {
		inflightFrame: "frame-a",
		pendingFrame: "frame-c",
	})
})

test("promotes the newest queued frame after the current load settles", () => {
	const first = enqueueBrowserPreviewFrame(
		createBrowserPreviewFrameQueueState(),
		"frame-a",
	)
	const second = enqueueBrowserPreviewFrame(first.nextState, "frame-b")
	const completed = completeBrowserPreviewFrameLoad(second.nextState)

	assert.equal(completed.frameToLoad, "frame-b")
	assert.deepEqual(completed.nextState, {
		inflightFrame: "frame-b",
		pendingFrame: null,
	})
})

test("returns to idle when there is no queued replacement frame", () => {
	const first = enqueueBrowserPreviewFrame(
		createBrowserPreviewFrameQueueState(),
		"frame-a",
	)
	const completed = completeBrowserPreviewFrameLoad(first.nextState)

	assert.equal(completed.frameToLoad, null)
	assert.deepEqual(completed.nextState, {
		inflightFrame: null,
		pendingFrame: null,
	})
})

test("queues Blob payloads without dropping their identity", () => {
	const firstFrame = new Blob(["first"])
	const latestFrame = new Blob(["latest"])
	const first = enqueueBrowserPreviewFrame(createBrowserPreviewFrameQueueState(), firstFrame)
	const second = enqueueBrowserPreviewFrame(first.nextState, latestFrame)
	const completed = completeBrowserPreviewFrameLoad(second.nextState)

	assert.equal(first.frameToLoad, firstFrame)
	assert.equal(second.frameToLoad, null)
	assert.equal(completed.frameToLoad, latestFrame)
	assert.equal(completed.nextState.inflightFrame, latestFrame)
	assert.equal(completed.nextState.pendingFrame, null)
})
