const test = require("node:test");
const assert = require("node:assert/strict");

const {
	cancelActiveDeferredToolCallRecord,
	cancelPausedDeferredToolCallRecord,
} = require("./deferred-tool-cancel");

test("cancelActiveDeferredToolCallRecord waits for port readiness before resolving", async () => {
	const calls = [];
	let resolveWaitForReady;
	let resolved = false;

	const cancelPromise = cancelActiveDeferredToolCallRecord(
		{ port: 8123 },
		{
			cancelChat: async (port, options) => {
				calls.push(["cancel", port, options.timeoutMs]);
			},
			waitForReady: async (port) => {
				calls.push(["wait", port]);
				await new Promise((resolve) => {
					resolveWaitForReady = resolve;
				});
			},
		},
	).then(() => {
		resolved = true;
	});

	await Promise.resolve();
	assert.equal(resolved, false);
	assert.deepEqual(calls, [
		["cancel", 8123, 3000],
		["wait", 8123],
	]);

	resolveWaitForReady();
	await cancelPromise;
	assert.equal(resolved, true);
});

test("cancelPausedDeferredToolCallRecord waits for readiness before releasing the handle", async () => {
	const calls = [];
	let resolveWaitForReady;
	let resolved = false;

	const cancelPromise = cancelPausedDeferredToolCallRecord(
		{
			port: 8123,
			handle: {
				settleLease: (disposition, options) => {
					calls.push([disposition, options]);
					return true;
				},
			},
		},
		{
			cancelChat: async (port, options) => {
				calls.push(["cancel", port, options.timeoutMs]);
			},
			waitForReady: async (port) => {
				calls.push(["wait", port]);
				await new Promise((resolve) => {
					resolveWaitForReady = resolve;
				});
			},
		},
	).then(() => {
		resolved = true;
	});

	await Promise.resolve();
	assert.equal(resolved, false);
	assert.deepEqual(calls, [
		["cancel", 8123, 3000],
		["wait", 8123],
	]);

	resolveWaitForReady();
	await cancelPromise;
	assert.equal(resolved, true);
	assert.deepEqual(calls, [
		["cancel", 8123, 3000],
		["wait", 8123],
		["release", {}],
	]);
});

test("cancelPausedDeferredToolCallRecord marks the handle unhealthy on cancellation failure", async () => {
	const calls = [];

	await assert.rejects(
		cancelPausedDeferredToolCallRecord(
			{
				port: 8123,
				handle: {
					settleLease: (disposition, options) => {
						calls.push([disposition, options]);
						return true;
					},
				},
			},
			{
				cancelChat: async () => {
					throw new Error("cancel failed");
				},
				waitForReady: async () => {
					calls.push(["wait"]);
				},
			},
		),
		/cancel failed/,
	);

	assert.deepEqual(calls, [
		["unhealthy", { reason: "paused tool cleanup failed" }],
	]);
});
