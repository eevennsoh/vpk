import type { JiraActivityActor, JiraActivityEntry } from "@/components/blocks/jira-activity";
import { referenceActivityEntries, PROJECT_BUTTER_REFERENCE_EPOCH } from "@/components/blocks/jira-work-item/project-butter/reference-activity";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export const PROJECT_BUTTER_ACTIVITY_EPOCH = PROJECT_BUTTER_REFERENCE_EPOCH;
export const PROJECT_BUTTER_CURRENT_USER: JiraActivityActor = { id: "butter-annie", name: "Annie Cook", kind: "person", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" };
export const PROJECT_BUTTER_SUMMARY_ID = "butter-teamwork-session-summary";

export function createProjectButterActivity(empty: boolean): readonly JiraActivityEntry[] {
	if (empty) return [{ id: "butter-empty-created", kind: "event", actor: { id: "butter-dev-rana", name: "Dev Rana", kind: "person", avatarSrc: projectButterPersonAvatar("Dev Rana") }, timestamp: "Just now", createdAtMs: PROJECT_BUTTER_ACTIVITY_EPOCH, icon: "created", segments: [{ type: "text", text: "created this work item" }] }];
	return [...referenceActivityEntries(), {
		id: PROJECT_BUTTER_SUMMARY_ID, kind: "comment", actor: { id: "butter-claude", kind: "agent", name: "Claude with Annie Cook", brandName: "claude" }, timestamp: "89 days ago", createdAtMs: Date.UTC(2026, 6, 31, 0, 5),
		body: [{ type: "text", text: "Published the Teamwork onboarding inventory evidence. The session captured all 61 call sites and owners. The separate keep-or-delete rationale remains out of scope." }], allowReply: true,
	}];
}

export function activityDateLabel(entry: JiraActivityEntry): string {
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(entry.createdAtMs ?? PROJECT_BUTTER_ACTIVITY_EPOCH));
}
