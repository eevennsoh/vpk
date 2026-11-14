const assert = require("node:assert/strict");
const test = require("node:test");

const {
	IDLE_RESPONSE,
	SESSION_STATE,
	responseReducer,
	sessionReducer,
} = require("./openai-realtime-session-machine");

const S = SESSION_STATE;

test("a session connects, becomes ready, refreshes and closes", () => {
	let state = S.NOT_INITIALIZED;
	state = sessionReducer(state, { type: "connect" });
	assert.equal(state, S.CONNECTING);
	state = sessionReducer(state, { type: "session-created" });
	assert.equal(state, S.READY);
	assert.equal(sessionReducer(state, { type: "connect" }), S.READY);
	state = sessionReducer(state, { type: "refresh" });
	assert.equal(state, S.REFRESHING);
	assert.equal(sessionReducer(state, { type: "session-created" }), S.REFRESHING);
	state = sessionReducer(state, { type: "close" });
	assert.equal(state, S.CLOSED);
});

test("closed is terminal, and any state can close", () => {
	for (const state of [S.NOT_INITIALIZED, S.CONNECTING, S.READY, S.REFRESHING]) {
		assert.equal(sessionReducer(state, { type: "close" }), S.CLOSED);
	}
	for (const type of ["connect", "session-created", "refresh", "close"]) {
		assert.equal(sessionReducer(S.CLOSED, { type }), S.CLOSED);
	}
	assert.equal(sessionReducer(S.NOT_INITIALIZED, { type: "refresh" }), S.NOT_INITIALIZED);
});

test("a request during an active response waits, forced if any waiting request was", () => {
	let response = responseReducer(IDLE_RESPONSE, { type: "request" });
	assert.equal(response, IDLE_RESPONSE);

	response = responseReducer(response, { type: "created", id: "response-1" });
	assert.deepEqual(response, { phase: "active", id: "response-1", pending: null });
	response = responseReducer(response, { type: "request", force: true });
	response = responseReducer(response, { type: "request" });
	assert.deepEqual(response.pending, { force: true });

	response = responseReducer(response, { type: "done" });
	assert.deepEqual(response, { phase: "idle", id: null, pending: { force: true } });
	response = responseReducer(response, { type: "take-pending" });
	assert.deepEqual(response, IDLE_RESPONSE);
});

test("a response without an id does not hold back requests; reset and drop clear state", () => {
	assert.equal(responseReducer(IDLE_RESPONSE, { type: "created", id: null }).phase, "idle");
	const active = responseReducer(responseReducer(IDLE_RESPONSE, { type: "created", id: "r" }), { type: "request" });
	assert.deepEqual(responseReducer(active, { type: "drop-pending" }), { phase: "active", id: "r", pending: null });
	assert.equal(responseReducer(active, { type: "reset" }), IDLE_RESPONSE);
});
