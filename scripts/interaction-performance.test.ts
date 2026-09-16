import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension.
import { selectInteractionSample, summarizeInteractionSamples, type EventTimingRecord, type SampleAction } from "../tests/helpers/interaction-performance.ts";

const action: SampleAction = {
	armedAtMs: 100,
	clickedAtMs: 110,
	id: "visit-list-1",
	targetId: "list-tab",
	view: "List",
	visit: "cold",
};

function entry(overrides: Partial<EventTimingRecord> = {}): EventTimingRecord {
	return {
		actionId: action.id,
		durationMs: 24,
		interactionId: 7,
		name: "click",
		processingEndMs: 118,
		processingStartMs: 114,
		startTimeMs: 110,
		targetId: action.targetId,
		...overrides,
	};
}

function select(entries: readonly EventTimingRecord[], overrides: Partial<Parameters<typeof selectInteractionSample>[0]> = {}) {
	return selectInteractionSample({ action, entries, seenInteractionIds: new Set(), supported: true, ...overrides });
}

test("only the armed action and target contribute; late and unrelated clicks cannot inflate it", () => {
	const sample = select([
		entry(),
		entry({ actionId: "other-action", durationMs: 240, interactionId: 8 }),
		entry({ durationMs: 320, interactionId: 9, targetId: "other-tab" }),
		entry({ durationMs: 400, interactionId: 10, startTimeMs: 150 }),
	]);
	assert.equal(sample.status, "valid");
	assert.equal(sample.timing?.durationMs, 24);
	assert.equal(sample.timing?.interactionId, 7);
	assert.equal(sample.timing?.eventCount, 1);
});

test("related events and duplicate observer deliveries produce one interaction using its slowest event", () => {
	const pointer = entry({ durationMs: 32, name: "pointerdown", startTimeMs: 104, processingStartMs: 108, processingEndMs: 116 });
	const sample = select([entry(), pointer, pointer]);
	assert.equal(sample.status, "valid");
	assert.deepEqual(sample.timing, {
		durationMs: 32,
		eventCount: 2,
		inputDelayMs: 4,
		interactionId: 7,
		presentationDelayMs: 20,
		presentationRoundingAdjustmentMs: 0,
		processingDurationMs: 8,
		representativeEvent: "pointerdown",
	});
	const seenInteractionIds = new Set<number>();
	assert.equal(select([entry()], { seenInteractionIds }).status, "valid");
	assert.equal(select([entry()], { seenInteractionIds }).reason, "interaction-already-sampled");
});

test("unsupported, absent timing and absent IDs are missing, while an observed zero stays zero", () => {
	assert.equal(select([entry()], { supported: false }).reason, "event-timing-unsupported");
	assert.equal(select([]).reason, "no-attributed-event-timing");
	assert.equal(select([]).timing, null);
	assert.equal(select([entry({ interactionId: null })]).reason, "missing-interaction-id");
	assert.equal(select([entry({ interactionId: 0 })]).reason, "missing-interaction-id");
	assert.equal(select([entry({ durationMs: 0, processingStartMs: 110, processingEndMs: 110 })]).timing?.durationMs, 0);
	assert.equal(select([entry()], { action: { ...action, clickedAtMs: null } }).reason, "expected-click-not-captured");
});

test("multiple interaction IDs for one action are ambiguous rather than silently taking the largest", () => {
	assert.equal(select([entry(), entry({ interactionId: 8 })]).reason, "ambiguous-interaction-ids");
});

test("invalid phase timestamps are missing and duration rounding is explicit", () => {
	for (const invalid of [
		entry({ processingStartMs: 109 }),
		entry({ processingEndMs: 113 }),
		entry({ processingEndMs: 145 }),
		entry({ durationMs: Number.NaN }),
		entry({ processingStartMs: Number.POSITIVE_INFINITY }),
	]) {
		assert.equal(select([invalid]).reason, "invalid-event-timing");
	}
	const rounded = select([entry({ durationMs: 8, processingEndMs: 120 })]);
	assert.equal(rounded.status, "valid");
	assert.equal(rounded.timing?.presentationDelayMs, 0);
	assert.equal(rounded.timing?.presentationRoundingAdjustmentMs, 2);
});

test("summary math uses only valid samples, separates cold from warm and preserves missing counts", () => {
	const valid = [0, 8, 16, 24].map((durationMs, index) => select([
		entry({ durationMs, interactionId: index + 1, processingStartMs: 110, processingEndMs: 110 }),
	], { action: { ...action, visit: "warm" } }));
	const missing = select([], { action: { ...action, visit: "warm" } });
	const cold = select([entry()]);
	const summaries = summarizeInteractionSamples([...valid, missing, cold]);
	const warm = summaries.find((summary) => summary.visit === "warm");
	assert.equal(summaries.length, 2);
	assert.equal(warm?.totalCount, 5);
	assert.equal(warm?.validCount, 4);
	assert.equal(warm?.missingCount, 1);
	assert.deepEqual(warm?.missingReasons, { "no-attributed-event-timing": 1 });
	assert.deepEqual(warm?.durationMs, { max: 24, mean: 12, median: 12, min: 0, p95: 24, range: 24, variance: 80 });
	assert.equal(warm?.inputDelayMs?.median, 0);
	assert.equal(summaries.find((summary) => summary.visit === "cold")?.validCount, 1);
});

test("a wholly missing summary has null statistics and an empty input has no groups", () => {
	const summary = summarizeInteractionSamples([select([])])[0];
	assert.equal(summary.validCount, 0);
	assert.equal(summary.missingCount, 1);
	assert.equal(summary.durationMs, null);
	assert.equal(summary.inputDelayMs, null);
	assert.deepEqual(summarizeInteractionSamples([]), []);
});
