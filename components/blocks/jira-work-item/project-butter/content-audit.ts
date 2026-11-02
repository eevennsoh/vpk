import type { JiraActivityEntry } from "@/components/blocks/jira-activity";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { PROJECT_BUTTER_CURRENT_USER } from "@/components/blocks/jira-work-item/project-butter/activity-data";

export function appendProjectButterAudit<T extends { activityEntries: readonly JiraActivityEntry[]; auditChanges: Readonly<Record<string, ProjectButterReferenceChange>> }>(state: T, change: { id: string; createdAtMs: number; label: string; before: string; after: string }): T {
	const action = `updated ${change.label.toLowerCase()}`;
	const item: ProjectButterReferenceChange = { id: change.id, actor: PROJECT_BUTTER_CURRENT_USER.name, timestamp: new Date(change.createdAtMs).toISOString(), icon: "description", action, changes: [{ label: change.label, before: change.before, after: change.after }] };
	const entry: JiraActivityEntry = { id: item.id, kind: "event", actor: PROJECT_BUTTER_CURRENT_USER, timestamp: "Just now", createdAtMs: change.createdAtMs, icon: item.icon, segments: [{ type: "text", text: action }] };
	return { ...state, activityEntries: [...state.activityEntries, entry], auditChanges: { ...state.auditChanges, [item.id]: item } };
}
