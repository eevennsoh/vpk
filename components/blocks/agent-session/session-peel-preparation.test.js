const assert = require("node:assert/strict");
const test = require("node:test");
const { createSessionPeelPreparation } = require("./session-peel-preparation.ts");

test("only the latest intended row retains a prepared paper preview", () => {
	const slot = createSessionPeelPreparation();
	let notifications = 0;
	const unsubscribe = slot.subscribe(() => notifications++);
	slot.prepare("first");
	assert.equal(slot.isPrepared("first"), true);
	slot.prepare("first");
	assert.equal(notifications, 1);
	slot.prepare("second");
	assert.equal(slot.isPrepared("first"), false);
	assert.equal(slot.isPrepared("second"), true);
	slot.release("first");
	assert.equal(slot.isPrepared("second"), true);
	slot.release("second");
	assert.equal(slot.isPrepared("second"), false);
	assert.equal(notifications, 3);
	unsubscribe();
	slot.prepare("third");
	assert.equal(notifications, 3);
});
