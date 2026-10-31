import assert from "node:assert/strict";
import { test } from "node:test";

import {
	formatButterDueDate,
	getButterSubtaskProgress,
	getButterSubtaskState,
} from "./project-butter-model.ts";

test("Butter subtask states keep pending work distinct from work in progress", () => {
	assert.equal(getButterSubtaskState("To Do"), "todo");
	assert.equal(getButterSubtaskState(undefined), "todo");
	assert.equal(getButterSubtaskState("In Progress"), "in-progress");
	assert.equal(getButterSubtaskState("in-progress"), "in-progress");
	assert.equal(getButterSubtaskState("Done"), "done");
});

test("Butter due dates use a stable calendar date and leave missing dates empty", () => {
	assert.equal(formatButterDueDate("2026-04-11"), "Apr 11");
	assert.equal(formatButterDueDate(undefined), null);
});

test("Butter subtask progress accounts for every status without inventing completed work", () => {
	assert.deepEqual(
		getButterSubtaskProgress([
			{ status: "To Do" },
			{ status: "In Progress" },
			{ status: "Done" },
			{ status: "done" },
		]),
		{
			completed: 2,
			total: 4,
			segments: [
				{ status: "pending", weight: 1 },
				{ status: "in-progress", weight: 1 },
				{ status: "passed", weight: 2 },
			],
		},
	);
	assert.deepEqual(getButterSubtaskProgress([]), { completed: 0, total: 0, segments: [] });
});

test("Butter progress weights unequal status groups independently", () => {
	assert.deepEqual(
		getButterSubtaskProgress([
			{ status: "To Do" },
			{ status: "To Do" },
			{ status: "In Progress" },
			{ status: "Done" },
		]),
		{
			completed: 1,
			total: 4,
			segments: [
				{ status: "pending", weight: 2 },
				{ status: "in-progress", weight: 1 },
				{ status: "passed", weight: 1 },
			],
		},
	);
});
