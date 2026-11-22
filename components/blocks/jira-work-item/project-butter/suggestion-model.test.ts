import assert from "node:assert/strict";
import { test } from "node:test";
import { planDescriptionReveal } from "./description-reveal-plan.ts";

import {
	applyProjectButterSuggestion,
	clearProjectButterSuggestion,
	listProjectButterSuggestions,
	revertMatchingProjectButterSuggestions,
	type ProjectButterSuggestionFieldPatch,
	type ProjectButterSuggestionSnapshot,
} from "./suggestion-model.ts";

function emptySnapshot(): ProjectButterSuggestionSnapshot {
	return {
		description: "",
		descriptionDraft: "",
		assignee: { name: "Unassigned" },
		acceptanceCriteria: [],
		dueDate: undefined,
		reporter: null,
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		storyPoints: "",
		costCenter: "",
	};
}

test("description words appear in order with overlapping fades and no jumps in cadence", () => {
	const delays = planDescriptionReveal(24);
	const gaps = delays.slice(1).map((delay, index) => delay - delays[index]);
	assert.equal(delays[0], 0);
	assert.equal(delays.length, 24);
	assert.ok(gaps.every((gap) => gap > 0 && gap < 0.1));
	assert.ok(gaps.every((gap, index) => index === 0 || Math.abs(gap - gaps[index - 1]) < 0.02));
	assert.ok(gaps[0] > gaps.at(-1)!);
});

test("long description reveals finish within the animation budget", () => {
	const delays = planDescriptionReveal(10_000);
	assert.equal(delays.length, 64);
	assert.ok((delays.at(-1) ?? Infinity) < 1.8);
	assert.deepEqual(planDescriptionReveal(0), []);
});

test("suggestion state offers every empty details field in rail order", () => {
	const suggestions = listProjectButterSuggestions(emptySnapshot());
	assert.deepEqual(suggestions.map((suggestion) => suggestion.field), [
		"description",
		"dueDate",
		"parent",
		"labels",
		"components",
		"fixVersion",
		"storyPoints",
		"reporter",
		"costCenter",
	]);
	assert.equal(suggestions.find((suggestion) => suggestion.field === "dueDate")?.preview, "Dec 15, 2026");
	assert.equal(suggestions.find((suggestion) => suggestion.field === "reporter")?.preview, "Elena Rodriguez");
});

test("description suggestions do not replace a saved description or an in-progress draft", () => {
	assert.equal(listProjectButterSuggestions({ ...emptySnapshot(), description: "Existing" }).some((suggestion) => suggestion.field === "description"), false);
	assert.equal(listProjectButterSuggestions({ ...emptySnapshot(), descriptionDraft: "Draft" }).some((suggestion) => suggestion.field === "description"), false);
});

test("payments demo suggests values relevant to merchant onboarding", () => {
	const suggestions = listProjectButterSuggestions(emptySnapshot(), "payments");
	assert.equal(suggestions.find((suggestion) => suggestion.field === "parent")?.preview, "PAY-100 Payments SDK v2 migration");
	assert.equal(suggestions.find((suggestion) => suggestion.field === "storyPoints")?.preview, "5");
});

test("accepting one suggestion writes only that field", () => {
	const fields: ProjectButterSuggestionFieldPatch = {
		acceptanceCriteria: [],
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		storyPoints: "",
		costCenter: "",
	};
	const written: { dueDate?: Date; reporter?: { name: string } | null } = {};
	const target = {
		setAssignee() {},
		setDescription() {},
		setDescriptionDraft() {},
		setDueDate(date: Date) {
			written.dueDate = date;
		},
		setReporter(person: { name: string; avatarUrl: string }) {
			written.reporter = person;
		},
		setDetailFields(update: (current: ProjectButterSuggestionFieldPatch) => ProjectButterSuggestionFieldPatch) {
			Object.assign(fields, update(fields));
		},
	};
	const dueDateSuggestion = listProjectButterSuggestions(emptySnapshot()).find((suggestion) => suggestion.field === "dueDate");
	const parentSuggestion = listProjectButterSuggestions(emptySnapshot()).find((suggestion) => suggestion.field === "parent");
	assert.ok(dueDateSuggestion && parentSuggestion);
	applyProjectButterSuggestion(parentSuggestion, target);
	assert.equal(fields.parent, "VITA-22 User Experience Overhaul");
	assert.equal(written.dueDate, undefined);
	assert.equal(written.reporter, undefined);
	applyProjectButterSuggestion(dueDateSuggestion, target);
	const dueDate = written.dueDate as Date | undefined;
	assert.equal(dueDate?.toISOString(), "2026-12-15T00:00:00.000Z");
	const remaining = listProjectButterSuggestions({ ...emptySnapshot(), dueDate, parent: fields.parent }).map((suggestion) => suggestion.field);
	assert.equal(remaining.includes("dueDate"), false);
	assert.equal(remaining.includes("parent"), false);
});

test("clearing an accepted batch restores the empty fields", () => {
	const fields: ProjectButterSuggestionFieldPatch = {
		acceptanceCriteria: [],
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		storyPoints: "",
		costCenter: "",
	};
	const written: { dueDate?: Date; reporter?: { name: string; avatarUrl: string } | null } = {};
	const target = {
		setAssignee() {},
		setDescription() {},
		setDescriptionDraft() {},
		setDueDate(date: Date | undefined) {
			written.dueDate = date;
		},
		setReporter(person: { name: string; avatarUrl: string } | null) {
			written.reporter = person;
		},
		setDetailFields(update: (current: ProjectButterSuggestionFieldPatch) => ProjectButterSuggestionFieldPatch) {
			Object.assign(fields, update(fields));
		},
	};
	const suggestions = listProjectButterSuggestions(emptySnapshot());
	for (const suggestion of suggestions) applyProjectButterSuggestion(suggestion, target);
	assert.equal(fields.parent, "VITA-22 User Experience Overhaul");
	assert.equal(fields.labels.length, 2);
	for (const suggestion of suggestions) clearProjectButterSuggestion(suggestion.field, target);
	assert.equal(written.dueDate, undefined);
	assert.equal(written.reporter, null);
	assert.deepEqual(fields, {
		acceptanceCriteria: [],
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		storyPoints: "",
		costCenter: "",
	});
	assert.equal(listProjectButterSuggestions({
		...emptySnapshot(),
		description: "",
		descriptionDraft: "",
		dueDate: written.dueDate,
		reporter: written.reporter ?? null,
		...fields,
	}).length, 9);
});

test("undo restores only fields that still match the accepted suggestion", () => {
	const fields: ProjectButterSuggestionFieldPatch = {
		acceptanceCriteria: [],
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		storyPoints: "",
		costCenter: "",
	};
	const written: { dueDate?: Date; reporter?: { name: string; avatarUrl: string } | null } = {};
	const target = {
		setAssignee() {},
		setDescription() {},
		setDescriptionDraft() {},
		setDueDate(date: Date | undefined) {
			written.dueDate = date;
		},
		setReporter(person: { name: string; avatarUrl: string } | null) {
			written.reporter = person;
		},
		setDetailFields(update: (current: ProjectButterSuggestionFieldPatch) => ProjectButterSuggestionFieldPatch) {
			Object.assign(fields, update(fields));
		},
	};
	const suggestions = listProjectButterSuggestions(emptySnapshot());
	for (const suggestion of suggestions) applyProjectButterSuggestion(suggestion, target);
	fields.parent = "Edited after accept";
	const snapshot: ProjectButterSuggestionSnapshot = {
		...emptySnapshot(),
		description: "",
		descriptionDraft: "",
		dueDate: written.dueDate,
		reporter: written.reporter ?? null,
		...fields,
	};
	revertMatchingProjectButterSuggestions(suggestions, snapshot, target);
	assert.equal(fields.parent, "Edited after accept");
	assert.equal(written.dueDate, undefined);
	assert.equal(written.reporter, null);
	assert.deepEqual(fields.labels, []);
});

test("filled details produce no suggestions", () => {
	const suggestions = listProjectButterSuggestions({
		...emptySnapshot(),
		description: "A description",
		descriptionDraft: "A description",
		dueDate: new Date(Date.UTC(2026, 11, 15)),
		reporter: { name: "Elena Rodriguez" },
		parent: "VITA-22 User Experience Overhaul",
		labels: ["social-media"],
		components: ["Frontend"],
		fixVersion: "v2.0",
		storyPoints: "3",
		costCenter: "RD-100-ENGINEERING",
	});
	assert.deepEqual(suggestions, []);
});
