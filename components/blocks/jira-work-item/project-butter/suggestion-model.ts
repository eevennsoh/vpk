import { projectButterPersonAvatar } from "./people.ts";

/** Empty work item fields the Suggestion state can fill, in review order. */
export const PROJECT_BUTTER_SUGGESTION_FIELDS = [
	"description",
	"dueDate",
	"parent",
	"labels",
	"components",
	"fixVersion",
	"acceptanceCriteria",
	"reporter",
	"costCenter",
] as const;

export type ProjectButterSuggestionField = typeof PROJECT_BUTTER_SUGGESTION_FIELDS[number];

export interface ProjectButterSuggestionSnapshot {
	description: string;
	descriptionDraft: string;
	dueDate: Date | undefined;
	reporter: { name: string } | null;
	parent: string;
	labels: readonly string[];
	components: readonly string[];
	fixVersion: string;
	acceptanceCriteria: string;
	costCenter: string;
}

interface ProjectButterSuggestionBase {
	field: ProjectButterSuggestionField;
	label: string;
	preview: string;
}

export type ProjectButterSuggestion =
	| (ProjectButterSuggestionBase & { field: "dueDate"; date: Date })
	| (ProjectButterSuggestionBase & { field: "reporter"; person: { name: string; avatarUrl: string } })
	| (ProjectButterSuggestionBase & { field: "description"; text: string })
	| (ProjectButterSuggestionBase & { field: "parent" | "fixVersion" | "acceptanceCriteria" | "costCenter"; text: string })
	| (ProjectButterSuggestionBase & { field: "labels" | "components"; values: readonly string[] });

export interface ProjectButterSuggestionFieldPatch {
	parent: string;
	labels: string[];
	components: string[];
	fixVersion: string;
	acceptanceCriteria: string;
	costCenter: string;
}

const SUGGESTED_DUE_DATE = new Date(Date.UTC(2026, 11, 15));
const PAYMENTS_DESCRIPTION = [
	"Help merchants adopt Payments SDK v2 with a clear onboarding path, from initial setup to their first test payment. Document the prerequisites, account configuration, and credentials needed before an integration begins.",
	"Provide a guided quickstart that shows how to install the SDK, initialize the client, and create a payment in the sandbox. Explain how to handle authentication challenges, declined payments, and common integration errors, with examples that developers can adapt.",
	"Include a checklist for moving from sandbox to production, links to the relevant documentation, and a way for merchants to find support when they get stuck.",
	"Validate the journey with a small group of merchants and use their feedback to clarify any confusing steps.",
].join("\n\n");
const SUGGESTED_REPORTER = {
	name: "Elena Rodriguez",
	avatarUrl: projectButterPersonAvatar("Elena Rodriguez"),
};

const LABELS: Record<ProjectButterSuggestionField, string> = {
	description: "Description",
	dueDate: "Due Date",
	parent: "Parent",
	labels: "Labels",
	components: "Components",
	fixVersion: "Fix Version",
	acceptanceCriteria: "Acceptance Criteria",
	reporter: "Reporter",
	costCenter: "Cost Center",
};

function dueDatePreview(date: Date): string {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function isSuggestionFieldEmpty(field: ProjectButterSuggestionField, snapshot: ProjectButterSuggestionSnapshot): boolean {
	switch (field) {
		case "description":
			return !snapshot.description.trim() && !snapshot.descriptionDraft.trim();
		case "dueDate":
			return snapshot.dueDate == null;
		case "reporter":
			return snapshot.reporter == null;
		case "labels":
			return snapshot.labels.length === 0;
		case "components":
			return snapshot.components.length === 0;
		case "parent":
			return snapshot.parent.length === 0;
		case "fixVersion":
			return snapshot.fixVersion.length === 0;
		case "acceptanceCriteria":
			return snapshot.acceptanceCriteria.length === 0;
		case "costCenter":
			return snapshot.costCenter.length === 0;
		default: {
			const unreachable: never = field;
			return unreachable;
		}
	}
}

function createSuggestion(field: ProjectButterSuggestionField, profile: "default" | "payments"): ProjectButterSuggestion {
	const label = LABELS[field];
	if (profile === "payments") {
		switch (field) {
			case "description": return { field, label, preview: "Help merchants adopt Payments SDK v2, from setup to their first test payment.", text: PAYMENTS_DESCRIPTION };
			case "parent": return { field, label, preview: "PAY-100 Payments SDK v2 migration", text: "PAY-100 Payments SDK v2 migration" };
			case "labels": return { field, label, preview: "onboarding, sdk-v2", values: ["onboarding", "sdk-v2"] };
			case "components": return { field, label, preview: "Payments SDK", values: ["Payments SDK"] };
			case "acceptanceCriteria": return { field, label, preview: "Merchants can complete SDK v2 onboarding and make a test payment", text: "Merchants can complete SDK v2 onboarding and make a test payment" };
			default: break;
		}
	}
	switch (field) {
		case "description":
			return { field, label, preview: "Improve the onboarding experience so new users can get started and complete their first key task.", text: "Improve the onboarding experience so new users can get started and complete their first key task." };
		case "dueDate":
			return { field, label, preview: dueDatePreview(SUGGESTED_DUE_DATE), date: SUGGESTED_DUE_DATE };
		case "reporter":
			return { field, label, preview: SUGGESTED_REPORTER.name, person: SUGGESTED_REPORTER };
		case "parent":
			return { field, label, preview: "VITA-22 User Experience Overhaul", text: "VITA-22 User Experience Overhaul" };
		case "labels":
			return { field, label, preview: "social-media, website-traffic", values: ["social-media", "website-traffic"] };
		case "components":
			return { field, label, preview: "Frontend, Design System", values: ["Frontend", "Design System"] };
		case "fixVersion":
			return { field, label, preview: "v2.0", text: "v2.0" };
		case "acceptanceCriteria":
			return { field, label, preview: "90% of new users complete onboarding in 1 week", text: "90% of new users complete onboarding in 1 week" };
		case "costCenter":
			return { field, label, preview: "RD-100-ENGINEERING", text: "RD-100-ENGINEERING" };
		default: {
			const unreachable: never = field;
			return unreachable;
		}
	}
}

/** Pending suggestions for fields that are still empty. */
export function listProjectButterSuggestions(snapshot: ProjectButterSuggestionSnapshot, profile: "default" | "payments" = "default"): ProjectButterSuggestion[] {
	return PROJECT_BUTTER_SUGGESTION_FIELDS
		.filter((field) => isSuggestionFieldEmpty(field, snapshot))
		.map((field) => createSuggestion(field, profile));
}

/** Write one accepted suggestion into the work item. */
export function applyProjectButterSuggestion<T extends ProjectButterSuggestionFieldPatch>(
	suggestion: ProjectButterSuggestion,
	target: {
		setDescription: (description: string) => void;
		setDescriptionDraft: (description: string) => void;
		setDueDate: (date: Date) => void;
		setReporter: (person: { name: string; avatarUrl: string }) => void;
		setDetailFields: (update: (current: T) => T) => void;
	},
): void {
	switch (suggestion.field) {
		case "description":
			target.setDescription(suggestion.text);
			target.setDescriptionDraft(suggestion.text);
			return;
		case "dueDate":
			target.setDueDate(suggestion.date);
			return;
		case "reporter":
			target.setReporter(suggestion.person);
			return;
		case "parent":
		case "fixVersion":
		case "acceptanceCriteria":
		case "costCenter":
			target.setDetailFields((current) => ({ ...current, [suggestion.field]: suggestion.text }));
			return;
		case "labels":
		case "components":
			target.setDetailFields((current) => ({ ...current, [suggestion.field]: [...suggestion.values] }));
			return;
		default: {
			const unreachable: never = suggestion;
			throw new Error(`Unhandled suggestion ${JSON.stringify(unreachable)}`);
		}
	}
}

/** True when the field still holds the value this suggestion wrote. */
export function projectButterSuggestionMatches(
	suggestion: ProjectButterSuggestion,
	snapshot: ProjectButterSuggestionSnapshot,
): boolean {
	switch (suggestion.field) {
		case "description":
			return snapshot.description === suggestion.text && snapshot.descriptionDraft === suggestion.text;
		case "dueDate":
			return snapshot.dueDate?.getTime() === suggestion.date.getTime();
		case "reporter":
			return snapshot.reporter?.name === suggestion.person.name;
		case "labels":
		case "components": {
			const current = snapshot[suggestion.field];
			return current.length === suggestion.values.length
				&& current.every((value, index) => value === suggestion.values[index]);
		}
		case "parent":
		case "fixVersion":
		case "acceptanceCriteria":
		case "costCenter":
			return snapshot[suggestion.field] === suggestion.text;
		default: {
			const unreachable: never = suggestion;
			return unreachable;
		}
	}
}

/** Restore accepted fields that the user has not edited since the batch landed. */
export function revertMatchingProjectButterSuggestions<T extends ProjectButterSuggestionFieldPatch>(
	batch: readonly ProjectButterSuggestion[],
	snapshot: ProjectButterSuggestionSnapshot,
	target: {
		setDescription: (description: string) => void;
		setDescriptionDraft: (description: string) => void;
		setDueDate: (date: Date | undefined) => void;
		setReporter: (person: { name: string; avatarUrl: string } | null) => void;
		setDetailFields: (update: (current: T) => T) => void;
	},
): void {
	for (const suggestion of batch) {
		if (!projectButterSuggestionMatches(suggestion, snapshot)) continue;
		clearProjectButterSuggestion(suggestion.field, target);
	}
}

/** Restore a field that Accept all wrote, so the batch can be reverted. */
export function clearProjectButterSuggestion<T extends ProjectButterSuggestionFieldPatch>(
	field: ProjectButterSuggestionField,
	target: {
		setDescription: (description: string) => void;
		setDescriptionDraft: (description: string) => void;
		setDueDate: (date: Date | undefined) => void;
		setReporter: (person: { name: string; avatarUrl: string } | null) => void;
		setDetailFields: (update: (current: T) => T) => void;
	},
): void {
	switch (field) {
		case "description":
			target.setDescription("");
			target.setDescriptionDraft("");
			return;
		case "dueDate":
			target.setDueDate(undefined);
			return;
		case "reporter":
			target.setReporter(null);
			return;
		case "parent":
		case "fixVersion":
		case "acceptanceCriteria":
		case "costCenter":
			target.setDetailFields((current) => ({ ...current, [field]: "" }));
			return;
		case "labels":
		case "components":
			target.setDetailFields((current) => ({ ...current, [field]: [] }));
			return;
		default: {
			const unreachable: never = field;
			throw new Error(`Unhandled suggestion field ${JSON.stringify(unreachable)}`);
		}
	}
}
