const assert = require("node:assert/strict");
const test = require("node:test");

const {
	PROVIDER_CONNECTION_DELAY_MS,
	PROVIDER_CONNECTION_INITIAL_STATE: IDLE,
	PROVIDER_CONNECTION_TIMERS,
	providerConnectionReducer: reduce,
} = require("./provider-connection-machine.ts");

const SLACK = { providerId: "slack" };
const JIRA = { providerId: "jira" };
const DONE = () => {};
const connecting = (target, attempt = 1, shown = true) => ({ phase: "connecting", target, onConnected: DONE, attempt, shown });

test("connect → connecting (shown) → connected → idle", () => {
	const started = reduce(IDLE, { type: "connect", target: SLACK, onConnected: DONE });
	assert.deepEqual(started, connecting(SLACK));
	assert.deepEqual(reduce(started, { type: "connected", attempt: 1 }), { phase: "idle", attempt: 1 });
});

test("a second connect takes over with a new attempt, and dismiss only hides the progress", () => {
	assert.deepEqual(reduce(connecting(SLACK), { type: "connect", target: JIRA, onConnected: DONE }), connecting(JIRA, 2));
	assert.deepEqual(reduce(connecting(SLACK), { type: "dismiss" }), connecting(SLACK, 1, false));
	assert.deepEqual(reduce(connecting(SLACK, 1, false), { type: "connected", attempt: 1 }), { phase: "idle", attempt: 1 }, "a dismissed connect still completes");
});

test("the timer table holds connecting for 1.2 s", () => {
	assert.deepEqual(PROVIDER_CONNECTION_TIMERS.connecting, { next: "connected", delayMs: PROVIDER_CONNECTION_DELAY_MS });
	assert.equal(PROVIDER_CONNECTION_DELAY_MS, 1200);
});

test("cannot happen: a stale or idle completion and a repeated dismiss return the same state", () => {
	assert.equal(reduce(IDLE, { type: "connected", attempt: 0 }), IDLE, "connected while idle");
	const second = connecting(JIRA, 2);
	assert.equal(reduce(second, { type: "connected", attempt: 1 }), second, "the replaced attempt's timer");
	assert.equal(reduce(IDLE, { type: "dismiss" }), IDLE, "dismiss while idle");
	const hidden = connecting(SLACK, 1, false);
	assert.equal(reduce(hidden, { type: "dismiss" }), hidden, "dismiss twice");
});
