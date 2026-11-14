const assert = require("node:assert/strict");
const test = require("node:test");

const {
	RUN_TERMINAL_STATUSES,
	isTerminalRunStatus,
	runReducer,
} = require("./rovo-app-run-machine");

test("runReducer moves a queued run to streaming or background on start", () => {
	assert.equal(runReducer("queued", { type: "start", streaming: true }), "streaming");
	assert.equal(runReducer("queued", { type: "start", streaming: false }), "background");
});

test("runReducer follows subscribers between streaming and background, and a queued run waits", () => {
	assert.equal(runReducer("background", { type: "attach" }), "streaming");
	assert.equal(runReducer("streaming", { type: "detach" }), "background");
	assert.equal(runReducer("queued", { type: "attach" }), "queued");
	assert.equal(runReducer("queued", { type: "detach" }), "queued");
	assert.equal(runReducer("streaming", { type: "attach" }), "streaming");
});

test("runReducer settles any live run to a terminal status and ignores unknown outcomes", () => {
	for (const status of ["queued", "streaming", "background"]) {
		for (const outcome of RUN_TERMINAL_STATUSES) {
			assert.equal(runReducer(status, { type: "settle", outcome }), outcome);
		}
		assert.equal(runReducer(status, { type: "settle", outcome: "paused" }), status);
	}
});

test("a terminal status never changes", () => {
	for (const status of RUN_TERMINAL_STATUSES) {
		assert.equal(isTerminalRunStatus(status), true);
		for (const event of [
			{ type: "start", streaming: true },
			{ type: "attach" },
			{ type: "detach" },
			{ type: "settle", outcome: "completed" },
			{ type: "settle", outcome: "cancelled" },
		]) {
			assert.equal(runReducer(status, event), status);
		}
	}
	assert.equal(isTerminalRunStatus("streaming"), false);
	assert.equal(isTerminalRunStatus(undefined), false);
});
