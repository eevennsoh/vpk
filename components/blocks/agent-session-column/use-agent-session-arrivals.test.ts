import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types runner needs the explicit extension.
import { advanceAgentSessionArrivals } from "./use-agent-session-arrivals.ts";

const initialInput = {
	items: [{ id: "first" }],
	newItemIds: new Set(["first"]),
	presentation: "circle",
	reduceMotion: false,
};

for (const presentation of ["circle", "expanded:large:short"]) {
	test(`first appearance in ${presentation} does not replay after an interrupted mode switch`, () => {
		const first = advanceAgentSessionArrivals(undefined, { ...initialInput, presentation });
		assert.deepEqual([...first.arriving], ["first"]);
		const next = advanceAgentSessionArrivals(first, { ...initialInput, presentation: "line" });
		const returned = advanceAgentSessionArrivals(next, { ...initialInput, presentation });
		assert.equal(returned.arriving.size, 0);
		assert.deepEqual([...first.arriving], ["first"], "updates must not mutate a previous render");
	});
}

test("rerenders keep the active target and newly added sessions still enter", () => {
	const first = advanceAgentSessionArrivals(undefined, initialInput);
	const next = advanceAgentSessionArrivals(first, {
		...initialInput,
		items: [{ id: "second" }, ...initialInput.items],
		newItemIds: new Set(["first", "second"]),
	});
	assert.deepEqual([...next.arriving], ["second", "first"]);
	const completed = { ...next, arriving: new Set<string>() };
	assert.equal(advanceAgentSessionArrivals(completed, next.input).arriving.size, 0);
});

test("filtering and unread changes do not erase first-appearance history", () => {
	const first = advanceAgentSessionArrivals(undefined, initialInput);
	const hidden = advanceAgentSessionArrivals(first, { ...initialInput, items: [], newItemIds: new Set() });
	assert.equal(advanceAgentSessionArrivals(hidden, initialInput).arriving.size, 0);
});

test("reduced motion consumes the entrance without animation", () => {
	const reduced = advanceAgentSessionArrivals(undefined, { ...initialInput, reduceMotion: true });
	assert.equal(reduced.arriving.size, 0);
	assert.equal(advanceAgentSessionArrivals(reduced, initialInput).arriving.size, 0);
});
