import { projectButterPersonAvatar } from "./people.ts";

/** Empty Details fields the Suggestion state can fill, in rail order. */
export const PROJECT_BUTTER_SUGGESTION_FIELDS = [
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
const SUGGESTED_REPORTER = {
	name: "Elena Rodriguez",
	avatarUrl: projectButterPersonAvatar("Elena Rodriguez"),
};

const LABELS: Record<ProjectButterSuggestionField, string> = {
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

function createSuggestion(field: ProjectButterSuggestionField): ProjectButterSuggestion {
	const label = LABELS[field];
	switch (field) {
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
export function listProjectButterSuggestions(snapshot: ProjectButterSuggestionSnapshot): ProjectButterSuggestion[] {
	return PROJECT_BUTTER_SUGGESTION_FIELDS
		.filter((field) => isSuggestionFieldEmpty(field, snapshot))
		.map((field) => createSuggestion(field));
}

/** Write one accepted suggestion into the work item. */
export function applyProjectButterSuggestion<T extends ProjectButterSuggestionFieldPatch>(
	suggestion: ProjectButterSuggestion,
	target: {
		setDueDate: (date: Date) => void;
		setReporter: (person: { name: string; avatarUrl: string }) => void;
		setDetailFields: (update: (current: T) => T) => void;
	},
): void {
	switch (suggestion.field) {
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

/** Restore a field that Accept all wrote, so the batch can be reverted. */
export function clearProjectButterSuggestion<T extends ProjectButterSuggestionFieldPatch>(
	field: ProjectButterSuggestionField,
	target: {
		setDueDate: (date: Date | undefined) => void;
		setReporter: (person: { name: string; avatarUrl: string } | null) => void;
		setDetailFields: (update: (current: T) => T) => void;
	},
): void {
	switch (field) {
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
