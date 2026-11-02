import assert from "node:assert/strict";
import { test } from "node:test";

import {
	applyProjectButterSuggestion,
	clearProjectButterSuggestion,
	listProjectButterSuggestions,
	type ProjectButterSuggestionFieldPatch,
	type ProjectButterSuggestionSnapshot,
} from "./suggestion-model.ts";

function emptySnapshot(): ProjectButterSuggestionSnapshot {
	return {
		dueDate: undefined,
		reporter: null,
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		acceptanceCriteria: "",
		costCenter: "",
	};
}

test("suggestion state offers every empty details field in rail order", () => {
	const suggestions = listProjectButterSuggestions(emptySnapshot());
	assert.deepEqual(suggestions.map((suggestion) => suggestion.field), [
		"dueDate",
		"parent",
		"labels",
		"components",
		"fixVersion",
		"acceptanceCriteria",
		"reporter",
		"costCenter",
	]);
	assert.equal(suggestions[0]?.preview, "Dec 15, 2026");
	assert.equal(suggestions.find((suggestion) => suggestion.field === "reporter")?.preview, "Elena Rodriguez");
});

test("accepting one suggestion writes only that field", () => {
	const fields: ProjectButterSuggestionFieldPatch = {
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		acceptanceCriteria: "",
		costCenter: "",
	};
	const written: { dueDate?: Date; reporter?: { name: string } | null } = {};
	const target = {
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
	const [dueDateSuggestion, parentSuggestion] = listProjectButterSuggestions(emptySnapshot());
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
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		acceptanceCriteria: "",
		costCenter: "",
	};
	const written: { dueDate?: Date; reporter?: { name: string; avatarUrl: string } | null } = {};
	const target = {
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
		parent: "",
		labels: [],
		components: [],
		fixVersion: "",
		acceptanceCriteria: "",
		costCenter: "",
	});
	assert.equal(listProjectButterSuggestions({
		dueDate: written.dueDate,
		reporter: written.reporter ?? null,
		...fields,
	}).length, 8);
});

test("filled details produce no suggestions", () => {
	const suggestions = listProjectButterSuggestions({
		dueDate: new Date(Date.UTC(2026, 11, 15)),
		reporter: { name: "Elena Rodriguez" },
		parent: "VITA-22 User Experience Overhaul",
		labels: ["social-media"],
		components: ["Frontend"],
		fixVersion: "v2.0",
		acceptanceCriteria: "Done",
		costCenter: "RD-100-ENGINEERING",
	});
	assert.deepEqual(suggestions, []);
});
