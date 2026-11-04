import type { JiraActivityActor, JiraActivityEntry } from "@/components/blocks/jira-activity";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { PROJECT_BUTTER_CURRENT_USER } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { PROJECT_BUTTER_DETAIL_FIELDS, type ProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";

export function appendProjectButterAudit<T extends { activityEntries: readonly JiraActivityEntry[]; auditChanges: Readonly<Record<string, ProjectButterReferenceChange>> }>(state: T, change: { id: string; createdAtMs: number; label: string; before: string; after: string; action?: string }, actor: JiraActivityActor = PROJECT_BUTTER_CURRENT_USER): T {
	const action = change.action ?? `updated ${change.label.toLowerCase()}`;
	const item: ProjectButterReferenceChange = { id: change.id, actor: actor.name, timestamp: new Date(change.createdAtMs).toISOString(), icon: "description", action, changes: [{ label: change.label, before: change.before, after: change.after }] };
	const entry: JiraActivityEntry = { id: item.id, kind: "event", actor, timestamp: "Just now", createdAtMs: change.createdAtMs, icon: item.icon, segments: [{ type: "text", text: action }] };
	return { ...state, activityEntries: [...state.activityEntries, entry], auditChanges: { ...state.auditChanges, [item.id]: item } };
}

const SUGGESTION_AUDIT_ID = "butter-accepted-suggestions";

export function updateProjectButterSuggestionAudit<T extends { activityEntries: readonly JiraActivityEntry[]; auditChanges: Readonly<Record<string, ProjectButterReferenceChange>> }>(state: T, change: { id: string; createdAtMs: number; label: string; before: string; after: string }, actor: JiraActivityActor, mode: "accept" | "undo"): T {
	const previous = state.auditChanges[SUGGESTION_AUDIT_ID];
	if (mode === "undo" && !previous?.changes.some((item) => item.label === change.label)) return appendProjectButterAudit(state, change, actor);
	const changes = (previous?.changes ?? []).filter((item) => item.label !== change.label);
	if (mode === "accept") {
		const original = previous?.changes.find((item) => item.label === change.label);
		changes.push({ label: change.label, before: original?.before ?? change.before, after: change.after });
	}
	const entries = state.activityEntries.filter((entry) => entry.id !== SUGGESTION_AUDIT_ID);
	const { [SUGGESTION_AUDIT_ID]: _removed, ...otherChanges } = state.auditChanges;
	if (!changes.length) return { ...state, activityEntries: entries, auditChanges: otherChanges };
	const action = `updated ${new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(changes.map((item) => item.label.toLowerCase()))}`;
	const item: ProjectButterReferenceChange = { id: SUGGESTION_AUDIT_ID, actor: actor.name, timestamp: new Date(change.createdAtMs).toISOString(), icon: "edit", action, changes };
	const entry: JiraActivityEntry = { id: item.id, kind: "event", actor, timestamp: "Just now", createdAtMs: change.createdAtMs, icon: item.icon, segments: [{ type: "text", text: action }] };
	return { ...state, activityEntries: [...entries, entry], auditChanges: { ...otherChanges, [item.id]: item } };
}

const AUDITED_DETAIL_FIELDS = ["parent", "labels", "components", "fixVersion", "storyPoints", "costCenter", "campaignGoal", "campaignBudget", "targetPlatforms", "estimatedReach", "audienceSegment", "campaignRegion", "assetObject"] as const satisfies readonly (keyof ProjectButterDetailFields)[];

function describeDetail(value: ProjectButterDetailFields[typeof AUDITED_DETAIL_FIELDS[number]]): string {
	return typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : [value.region, value.market].filter(Boolean).join(", ");
}

export function projectButterDetailChanges(before: ProjectButterDetailFields, after: ProjectButterDetailFields) {
	return AUDITED_DETAIL_FIELDS.flatMap((field) => {
		const previous = describeDetail(before[field]);
		const next = describeDetail(after[field]);
		return previous === next ? [] : [{ label: PROJECT_BUTTER_DETAIL_FIELDS[field], before: previous, after: next }];
	});
}
