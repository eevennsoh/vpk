const test = require("node:test");
const assert = require("node:assert/strict");

const { clamp, lerp, slugToTitleCase, sortByUpdatedAtDesc } = require("./utils.ts");

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

test("clamp keeps values in range, lets min win an inverted range, and passes NaN through", () => {
	assert.equal(clamp(5, 0, 10), 5);
	assert.equal(clamp(-1, 0, 10), 0);
	assert.equal(clamp(11, 0, 10), 10);
	assert.equal(clamp(5, 10, 0), 10);
	assert.ok(Number.isNaN(clamp(Number.NaN, 0, 1)));
});

test("lerp reaches its ends at 0 and 1 and extrapolates outside them", () => {
	assert.equal(lerp(2, 10, 0), 2);
	assert.equal(lerp(2, 10, 1), 10);
	assert.equal(lerp(2, 10, 0.25), 4);
	assert.equal(lerp(2, 10, 1.5), 14);
	assert.equal(lerp(10, 2, 0.5), 6);
});

test("slugToTitleCase capitalises each hyphen-separated word and keeps empty segments", () => {
	assert.equal(slugToTitleCase("agent-chat"), "Agent Chat");
	assert.equal(slugToTitleCase("ui"), "Ui");
	assert.equal(slugToTitleCase("3d-lanyard"), "3d Lanyard");
	assert.equal(slugToTitleCase("a--b"), "A  B");
	assert.equal(slugToTitleCase(""), "");
});
