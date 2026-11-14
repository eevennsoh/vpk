const test = require("node:test");
const assert = require("node:assert/strict");

const { clamp, slugToTitleCase, sortByUpdatedAtDesc } = require("./utils.ts");
const math = require("./math.ts");

test("sortByUpdatedAtDesc sorts newest records first without mutating input", () => {
	const oldest = { id: "oldest", updatedAt: "2026-03-09T10:00:00.000Z" };
	const newest = { id: "newest", updatedAt: "2026-03-09T10:30:00.000Z" };
	const middle = { id: "middle", updatedAt: "2026-03-09T10:10:00.000Z" };
	const items = [oldest, newest, middle];

	const sortedItems = sortByUpdatedAtDesc(items);

	assert.deepEqual(sortedItems, [newest, middle, oldest]);
	assert.deepEqual(items, [oldest, newest, middle]);
	assert.equal(sortedItems[0], newest);
	assert.equal(sortedItems[1], middle);
	assert.equal(sortedItems[2], oldest);
});

test("lib/utils re-exports the lib/math clamp", () => {
	assert.equal(clamp, math.clamp);
});

test("slugToTitleCase capitalises each hyphen-separated word and keeps empty segments", () => {
	assert.equal(slugToTitleCase("agent-chat"), "Agent Chat");
	assert.equal(slugToTitleCase("ui"), "Ui");
	assert.equal(slugToTitleCase("3d-lanyard"), "3d Lanyard");
	assert.equal(slugToTitleCase("a--b"), "A  B");
	assert.equal(slugToTitleCase(""), "");
});
