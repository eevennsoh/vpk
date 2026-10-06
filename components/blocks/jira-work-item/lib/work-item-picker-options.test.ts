import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorkItemPickerOptions } from "./work-item-picker-options.ts";

test("the picker uses board pins, then space pins, then the standard defaults", () => {
	const spacePinnedAgentIds = ["team-agent"];
	assert.deepEqual(
		resolveWorkItemPickerOptions(undefined, spacePinnedAgentIds),
		{ defaultPinnedAgentIds: spacePinnedAgentIds, pinnedItemsLabel: "Pinned by space" },
	);
	assert.deepEqual(
		resolveWorkItemPickerOptions({ defaultPinnedAgentIds: ["board-agent"], pinnedItemsLabel: "Pinned for this board" }, spacePinnedAgentIds),
		{ defaultPinnedAgentIds: ["board-agent"], pinnedItemsLabel: "Pinned for this board" },
	);
	assert.deepEqual(
		resolveWorkItemPickerOptions({ defaultPinnedAgentIds: [] }, spacePinnedAgentIds),
		{ defaultPinnedAgentIds: [], pinnedItemsLabel: "Pinned by space" },
	);
	assert.deepEqual(
		resolveWorkItemPickerOptions(undefined, undefined),
		{ defaultPinnedAgentIds: ["rfp-drafting-agent", "readiness-checker"], pinnedItemsLabel: "Pinned by space" },
	);
});
