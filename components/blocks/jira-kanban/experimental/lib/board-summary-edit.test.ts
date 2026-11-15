import assert from "node:assert/strict";
import { test } from "node:test";

import { createBoardSummaryEditStore } from "./board-summary-edit.ts";

test("summary editing mutes other cards and ignores stale finishes", () => {
	const store = createBoardSummaryEditStore();
	let changes = 0;
	const unsubscribe = store.subscribe(() => { changes += 1; });
	assert.equal(store.isMuted("PAY-1"), false);
	store.setEditing("PAY-1", true);
	assert.equal(store.isMuted("PAY-1"), false);
	assert.equal(store.isMuted("PAY-2"), true);
	store.setEditing("PAY-2", true);
	store.setEditing("PAY-1", false);
	assert.equal(store.isMuted("PAY-2"), false);
	assert.equal(store.isMuted("PAY-1"), true);
	store.setEditing("PAY-2", false);
	assert.equal(store.isMuted("PAY-1"), false);
	assert.equal(changes, 3);
	unsubscribe();
	store.setEditing("PAY-1", true);
	assert.equal(changes, 3);
});
