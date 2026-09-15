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

test("a top lifecycle revision animates only its icon", () => {
	const input = {
		items: [{ id: "session" }],
		presentation: "expanded:large:short",
		reduceMotion: false,
		stateChangeVersions: new Map([["session", 0]]),
	};
	const working = advanceAgentSessionArrivals(undefined, input);
	assert.equal(working.arriving.size, 0, "a loaded working session is not a state change");
	const needsInput = advanceAgentSessionArrivals(working, {
		...input,
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.equal(needsInput.arriving.size, 0, "a first-place card must stay mounted");
	assert.deepEqual([...needsInput.stateChanged], ["session"]);
	const settledNeedsInput = {
		...needsInput,
		stateChanged: new Set<string>(),
	};
	const unchanged = advanceAgentSessionArrivals(settledNeedsInput, {
		...needsInput.input,
		items: [...input.items],
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.equal(unchanged.arriving.size, 0);
	assert.equal(unchanged.stateChanged.size, 0);
	const finished = advanceAgentSessionArrivals(unchanged, {
		...input,
		stateChangeVersions: new Map([["session", 2]]),
	});
	assert.equal(finished.arriving.size, 0);
	assert.deepEqual([...finished.stateChanged], ["session"]);
});

test("a lower session still exits and reintroduces at the top", () => {
	const input = {
		items: [{ id: "other" }, { id: "session" }],
		presentation: "expanded:large:short",
		reduceMotion: false,
		stateChangeVersions: new Map([["session", 0]]),
	};
	const working = advanceAgentSessionArrivals(undefined, input);
	const changed = advanceAgentSessionArrivals(working, {
		...input,
		items: [{ id: "session" }, { id: "other" }],
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.deepEqual([...changed.arriving], ["session"]);
	assert.deepEqual([...changed.stateChanged], ["session"]);
});

test("a top collapsed status revision still introduces its question or check glyph", () => {
	const input = {
		items: [{ id: "session" }],
		presentation: "circle",
		reduceMotion: false,
		stateChangeVersions: new Map([["session", 0]]),
	};
	const working = advanceAgentSessionArrivals(undefined, input);
	const changed = advanceAgentSessionArrivals(working, {
		...input,
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.deepEqual([...changed.arriving], ["session"]);
	assert.equal(changed.stateChanged.size, 0);
});

test("collapse interrupts a status beat without replaying it on expansion", () => {
	const input = {
		items: [{ id: "session" }],
		presentation: "expanded:large:short",
		reduceMotion: false,
		stateChangeVersions: new Map([["session", 0]]),
	};
	const baseline = advanceAgentSessionArrivals(undefined, input);
	const changed = advanceAgentSessionArrivals(baseline, {
		...input,
		stateChangeVersions: new Map([["session", 1]]),
	});
	const collapsed = advanceAgentSessionArrivals(changed, { ...changed.input, presentation: "circle" });
	assert.equal(collapsed.arriving.size, 0);
	assert.equal(collapsed.stateChanged.size, 0);
	const expanded = advanceAgentSessionArrivals(collapsed, changed.input);
	assert.equal(expanded.arriving.size, 0);
	assert.equal(expanded.stateChanged.size, 0);
});

test("a changed session filtered out at transition does not replay its icon when revealed", () => {
	const input = {
		items: [{ id: "session" }],
		presentation: "expanded:large:short",
		reduceMotion: false,
		stateChangeVersions: new Map([["session", 0]]),
	};
	const baseline = advanceAgentSessionArrivals(undefined, input);
	const hidden = advanceAgentSessionArrivals(baseline, {
		...input,
		items: [],
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.equal(hidden.arriving.size, 0);
	assert.equal(advanceAgentSessionArrivals(hidden, { ...input, stateChangeVersions: hidden.input.stateChangeVersions }).stateChanged.size, 0);
});

test("reduced motion consumes lifecycle revisions and the next session still gets its first arrival", () => {
	const input = {
		items: [{ id: "session" }],
		presentation: "expanded:large:short",
		reduceMotion: false,
		stateChangeVersions: new Map([["session", 0]]),
	};
	const baseline = advanceAgentSessionArrivals(undefined, input);
	const reduced = advanceAgentSessionArrivals(baseline, {
		...input,
		reduceMotion: true,
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.equal(reduced.arriving.size, 0);
	assert.equal(reduced.stateChanged.size, 0);
	assert.equal(advanceAgentSessionArrivals(reduced, { ...input, stateChangeVersions: reduced.input.stateChangeVersions }).arriving.size, 0);
	const nextSession = advanceAgentSessionArrivals(reduced, {
		...input,
		items: [{ id: "new" }, ...input.items],
		newItemIds: new Set(["new"]),
		stateChangeVersions: new Map([["session", 1], ["new", 0]]),
	});
	assert.deepEqual([...nextSession.arriving], ["new"]);
	assert.equal(nextSession.stateChanged.size, 0);
});
