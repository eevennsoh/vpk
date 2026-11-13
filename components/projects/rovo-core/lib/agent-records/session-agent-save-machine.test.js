const assert = require("node:assert/strict");
const test = require("node:test");

const {
	SESSION_AGENT_SAVE_INITIAL_STATE: IDLE,
	selectSessionAgentSavedAt,
	selectSessionAgentSaveStatus,
	sessionAgentSaveReducer: reduce,
} = require("./session-agent-save-machine.ts");

const shown = (state) => `${selectSessionAgentSaveStatus(state)}@${selectSessionAgentSavedAt(state)}`;
const SAVING = reduce(IDLE, { type: "changed", silent: false });
const SAVED = reduce(SAVING, { type: "persisted", ok: true, at: 42 });

test("a visible change shows saving, then saved with its time or error", () => {
	assert.equal(shown(SAVING), "saving@null");
	assert.equal(shown(SAVED), "saved@42");
	assert.equal(shown(reduce(SAVING, { type: "persisted", ok: false, at: 42 })), "error@null");
	assert.equal(shown(reduce(SAVED, { type: "changed", silent: false })), "saving@null", "the next edit shows progress again");
});

test("a silent change keeps the indicator as it was, through success or failure", () => {
	for (const before of [IDLE, SAVED, reduce(SAVING, { type: "persisted", ok: false, at: 1 })]) {
		const silent = reduce(before, { type: "changed", silent: true });
		assert.equal(shown(silent), shown(before));
		assert.equal(reduce(silent, { type: "persisted", ok: true, at: 99 }), before);
		assert.equal(reduce(silent, { type: "persisted", ok: false, at: 99 }), before);
	}
});

test("a visible change during a silent write makes the write visible", () => {
	const silent = reduce(SAVED, { type: "changed", silent: true });
	const visible = reduce(silent, { type: "changed", silent: false });
	assert.equal(shown(visible), "saving@null");
	assert.equal(shown(reduce(visible, { type: "persisted", ok: true, at: 7 })), "saved@7");
});

test("a silent change during a visible write keeps it visible, so its result shows", () => {
	assert.equal(reduce(SAVING, { type: "changed", silent: true }), SAVING);
	assert.equal(shown(reduce(reduce(SAVING, { type: "changed", silent: true }), { type: "persisted", ok: true, at: 5 })), "saved@5");
	assert.equal(shown(reduce(reduce(SAVING, { type: "changed", silent: true }), { type: "persisted", ok: false, at: 5 })), "error@null");
});

test("cannot happen: repeats and a write with nothing pending return the same state", () => {
	assert.equal(reduce(SAVING, { type: "changed", silent: false }), SAVING, "a second visible change while saving");
	const silent = reduce(IDLE, { type: "changed", silent: true });
	assert.equal(reduce(silent, { type: "changed", silent: true }), silent, "a second silent change");
	for (const settled of [IDLE, SAVED, { phase: "error" }]) {
		assert.equal(reduce(settled, { type: "persisted", ok: true, at: 1 }), settled, `persisted while ${settled.phase}`);
	}
});
