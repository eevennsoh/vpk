import assert from "node:assert/strict";
import { test } from "node:test";

import { nextRelatedKey, normalizeRelatedSummary, relatedComposerChoices, relatedItemFromRequest, relatedKeyPrefix, relatedProgressLabel, relatedStatusCounts } from "./related-model.ts";
import type { ProjectButterRelatedSearchItem } from "./related-model.ts";

const item = (key: string, summary: string, workType: ProjectButterRelatedSearchItem["workType"] = "Subtask"): ProjectButterRelatedSearchItem => ({ id: `search-${key}`, key, summary, workType, priority: "Low", assignee: "Zoe Loft", status: "In progress" });
const catalog = [
	...Array.from({ length: 8 }, (_, index) => item(`VITA-${index + 2}`, `Onboarding step ${index + 2}`)),
	item("VITA-70", "Onboarding audit"),
	item("VITA-80", "Platform epic", "Epic"),
	item("VITA-81", "Checkout story", "Story"),
];

test("an exact key match comes first even past the first six matches", () => {
	const { choices } = relatedComposerChoices({ catalog, existingKeys: new Set(), kind: "children", ownKey: "VITA-1", query: "VITA-70" });
	assert.deepEqual(choices.map((choice) => choice.id), ["VITA-70"]);
	const broad = relatedComposerChoices({ catalog, existingKeys: new Set(), kind: "children", ownKey: "VITA-1", query: "onboarding" });
	assert.equal(broad.matchCount, 6);
	assert.equal(broad.choices.at(-1)?.kind, "create");
});

test("the open work item, existing rows and wrong child types are never offered", () => {
	const own = relatedComposerChoices({ catalog, existingKeys: new Set(["VITA-3"]), kind: "children", ownKey: "VITA-2", query: "VITA-" });
	assert.equal(own.choices.some((choice) => choice.id === "VITA-2" || choice.id === "VITA-3" || choice.id === "VITA-80"), false);
	const underEpic = relatedComposerChoices({ catalog, existingKeys: new Set(), kind: "children", ownKey: "VITA-1", parentType: "Epic", query: "VITA-8" });
	assert.deepEqual(underEpic.choices.filter((choice) => choice.kind === "existing").map((choice) => choice.id), ["VITA-81"]);
	const linked = relatedComposerChoices({ catalog, existingKeys: new Set(), kind: "linked", ownKey: "VITA-1", query: "VITA-80" });
	assert.equal(linked.choices[0].id, "VITA-80");
	const alreadyAdded = relatedComposerChoices({ catalog, existingKeys: new Set(["VITA-3"]), kind: "linked", ownKey: "VITA-1", query: "VITA-3" });
	assert.equal(alreadyAdded.choices.some((choice) => choice.kind === "create"), false);
});

test("created keys use the parent's project prefix and stay unique", () => {
	assert.equal(relatedKeyPrefix("PAY-102"), "PAY");
	assert.equal(relatedKeyPrefix(undefined), "VITA");
	const values = [0.5, 0.5, 0.25];
	const key = nextRelatedKey("PAY", new Set(["PAY-5500"]), () => values.shift() ?? 0);
	assert.equal(key, "PAY-3250");
	assert.match(nextRelatedKey("VITA", new Set()), /^VITA-\d{4}$/u);
});

test("created items default to the current user while existing matches keep their fields", () => {
	const created = relatedItemFromRequest({ kind: "create", summary: "Draft rollout plan" }, { id: "a", key: "PAY-1234", kind: "children" });
	assert.deepEqual([created.assignee, created.status, created.priority, created.workType, created.relationship], ["Annie Cook", "To do", "Medium", "Subtask", undefined]);
	const link = relatedItemFromRequest({ kind: "create", summary: "Link", relationship: "Blocks" }, { id: "b", key: "PAY-2345", kind: "linked" });
	assert.deepEqual([link.workType, link.relationship], ["Task", "Blocks"]);
	const existing = relatedItemFromRequest({ kind: "existing", item: catalog[0] }, { id: "c", key: "unused", kind: "linked" });
	assert.deepEqual([existing.key, existing.assignee, existing.status, existing.priority, existing.relationship], ["VITA-2", "Zoe Loft", "In progress", "Low", "Clones"]);
});

test("progress counts cover the whole list and disappear with no children", () => {
	const counts = relatedStatusCounts([{ ...catalog[0], status: "Done" }, catalog[1], { ...catalog[2], status: "To do" }]);
	assert.equal(relatedProgressLabel(counts), "1 of 3 done, 1 in progress, 1 to do");
	assert.equal(relatedProgressLabel(relatedStatusCounts([])), undefined);
	assert.equal(normalizeRelatedSummary("  Two\n words  "), "Two words");
});
