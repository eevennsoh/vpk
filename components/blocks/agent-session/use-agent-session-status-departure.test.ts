import assert from "node:assert/strict";
import test from "node:test";

import {
	advanceAgentSessionStatusDeparture,
	completeAgentSessionStatusDeparture,
// @ts-expect-error Node's strip-types runner needs the explicit extension.
} from "./use-agent-session-status-departure.ts";

const working = { id: "session", state: "working" };
const other = { id: "other", state: "working" };
const baselineInput = {
	items: [other, working],
	stateChangeVersions: new Map([["session", 0]]),
	stateChangedItemIds: new Set<string>(),
	reduceMotion: false,
};

test("a changed card exits at its old slot before its new state enters at the top", () => {
	const baseline = advanceAgentSessionStatusDeparture(undefined, baselineInput);
	const changed = advanceAgentSessionStatusDeparture(baseline, {
		...baselineInput,
		items: [{ id: "session", state: "needs-input" }, other],
		stateChangeVersions: new Map([["session", 1]]),
		stateChangedItemIds: new Set(["session"]),
	});
	assert.deepEqual(changed.visualItems.map(({ id }) => id), ["other", "session"]);
	assert.equal(changed.visualItems[1]?.state, "working", "the old state remains only during its departure");
	assert.deepEqual([...changed.exitingItemIds], ["session"]);
	const entered = completeAgentSessionStatusDeparture(changed, "session");
	assert.deepEqual(entered.visualItems.map(({ id }) => id), ["session", "other"]);
	assert.equal(entered.visualItems[0]?.state, "needs-input");
	assert.equal(entered.exitingItemIds.size, 0);
	const settled = advanceAgentSessionStatusDeparture(entered, {
		...changed.input,
		items: [...changed.input.items],
		stateChangeVersions: new Map([["session", 1]]),
	});
	assert.equal(settled.exitingItemIds.size, 0, "a settled revision never replays on a rerender");
});

test("a first-place status revision keeps the card mounted in place", () => {
	const input = {
		...baselineInput,
		items: [working, other],
	};
	const baseline = advanceAgentSessionStatusDeparture(undefined, input);
	const changed = advanceAgentSessionStatusDeparture(baseline, {
		...input,
		items: [{ id: "session", state: "needs-input" }, other],
		stateChangeVersions: new Map([["session", 1]]),
		stateChangedItemIds: new Set(["session"]),
	});
	assert.equal(changed.exitingItemIds.size, 0);
	assert.equal(changed.visualItems[0]?.state, "needs-input");
});

test("ordinary reorders and reduced-motion status changes update immediately", () => {
	const baseline = advanceAgentSessionStatusDeparture(undefined, baselineInput);
	const reordered = advanceAgentSessionStatusDeparture(baseline, {
		...baselineInput,
		items: [working, other],
	});
	assert.deepEqual(reordered.visualItems.map(({ id }) => id), ["session", "other"]);
	assert.equal(reordered.exitingItemIds.size, 0);
	const reduced = advanceAgentSessionStatusDeparture(baseline, {
		...baselineInput,
		items: [{ id: "session", state: "finished" }, other],
		stateChangeVersions: new Map([["session", 1]]),
		stateChangedItemIds: new Set(["session"]),
		reduceMotion: true,
	});
	assert.equal(reduced.visualItems[0]?.state, "finished");
	assert.equal(reduced.exitingItemIds.size, 0);
	const transitioning = advanceAgentSessionStatusDeparture(baseline, {
		...baselineInput,
		items: [{ id: "session", state: "needs-input" }, other],
		stateChangeVersions: new Map([["session", 1]]),
		stateChangedItemIds: new Set(["session"]),
	});
	const preferenceChanged = advanceAgentSessionStatusDeparture(transitioning, {
		...transitioning.input,
		reduceMotion: true,
	});
	assert.equal(preferenceChanged.exitingItemIds.size, 0, "reduced motion must not leave the old card stuck");
	assert.equal(preferenceChanged.visualItems[0]?.state, "needs-input");
});

test("a departure releases the latest data and waits for all changed rows", () => {
	const third = { id: "third", state: "working" };
	const initial = advanceAgentSessionStatusDeparture(undefined, {
		...baselineInput,
		items: [third, other, working],
		stateChangeVersions: new Map([["session", 0], ["other", 0]]),
	});
	const changed = advanceAgentSessionStatusDeparture(initial, {
		...baselineInput,
		items: [{ id: "session", state: "needs-input" }, { id: "other", state: "finished" }, third],
		stateChangeVersions: new Map([["session", 1], ["other", 1]]),
		stateChangedItemIds: new Set(["session", "other"]),
	});
	assert.deepEqual([...changed.exitingItemIds], ["session", "other"]);
	const oneFinished = completeAgentSessionStatusDeparture(changed, "session");
	assert.deepEqual(oneFinished.visualItems.map(({ id }) => id), ["third", "other", "session"]);
	const latest = advanceAgentSessionStatusDeparture(oneFinished, {
		...changed.input,
		items: [{ id: "session", state: "finished" }, { id: "other", state: "finished" }, third],
	});
	const allFinished = completeAgentSessionStatusDeparture(latest, "other");
	assert.deepEqual(allFinished.visualItems.map(({ id }) => id), ["session", "other", "third"]);
	assert.equal(allFinished.visualItems[0]?.state, "finished");
});
