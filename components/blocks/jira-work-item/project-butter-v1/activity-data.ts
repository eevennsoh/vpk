import type { JiraActivityActor, JiraActivityEntry } from "@/components/blocks/jira-activity";
import { referenceActivityEntries, PROJECT_BUTTER_REFERENCE_EPOCH } from "@/components/blocks/jira-work-item/project-butter-v1/reference-activity";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter-v1/people";
import { PROJECT_BUTTER_REFERENCE_COMMENTS } from "@/components/blocks/jira-work-item/project-butter-v1/reference-data";
import { PROJECT_BUTTER_SESSION_EPOCH } from "@/components/blocks/jira-work-item/project-butter-v1/data";

export const PROJECT_BUTTER_ACTIVITY_EPOCH = PROJECT_BUTTER_SESSION_EPOCH;
export const PROJECT_BUTTER_CURRENT_USER: JiraActivityActor = { id: "butter-annie", name: "Annie Cook", kind: "person", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" };

export function createProjectButterActivity(empty: boolean): readonly JiraActivityEntry[] {
	if (empty) return [{ id: "butter-empty-created", kind: "event", actor: { id: "butter-dev-rana", name: "Dev Rana", kind: "person", avatarSrc: projectButterPersonAvatar("Dev Rana") }, timestamp: "Just now", createdAtMs: PROJECT_BUTTER_ACTIVITY_EPOCH, icon: "created", segments: [{ type: "text", text: "created this work item" }] }];
	const ages: Readonly<Record<string, { age: number; label: string }>> = {
		"butter-source-comment-1": { age: 45 * 60_000, label: "45 minutes ago" },
		"comment-budget-breakdown": { age: 70 * 60_000, label: "1 hour ago" },
		"comment-nurture-copy-review": { age: 86_400_000, label: "1 day ago" },
		"butter-source-comment-6": { age: 2 * 86_400_000, label: "2 days ago" },
		"butter-source-comment-0": { age: 18 * 86_400_000, label: "2 weeks ago" },
		"butter-source-comment-2": { age: 19 * 86_400_000, label: "2 weeks ago" },
		"butter-source-comment-7": { age: 20 * 86_400_000, label: "2 weeks ago" },
	};
	const entries = referenceActivityEntries().filter((entry) => entry.id !== "comment-teamwork-graph-onboarding-context").map((entry): JiraActivityEntry => {
		if (entry.kind !== "comment") return { ...entry, createdAtMs: (entry.createdAtMs ?? PROJECT_BUTTER_REFERENCE_EPOCH) + PROJECT_BUTTER_ACTIVITY_EPOCH - PROJECT_BUTTER_REFERENCE_EPOCH };
		const age = ages[entry.id];
		const source = PROJECT_BUTTER_REFERENCE_COMMENTS.find((comment) => comment.id === entry.id);
		return { ...entry, body: [{ type: "text", text: source?.markdown ?? "" }], timestamp: age?.label ?? entry.timestamp, createdAtMs: age ? PROJECT_BUTTER_ACTIVITY_EPOCH - age.age : entry.createdAtMs, defaultRepliesExpanded: false, replyPreviewCount: 1, replies: entry.replies?.map((reply, index) => ({
			...reply,
			body: source?.replies?.find((candidate) => candidate.id === reply.id)?.markdown ?? reply.body,
			timestamp: age?.label ?? entry.timestamp,
			createdAtMs: (age ? PROJECT_BUTTER_ACTIVITY_EPOCH - age.age : entry.createdAtMs ?? PROJECT_BUTTER_ACTIVITY_EPOCH) + (index + 1) * 60_000,
		})) };
	});
	return entries.sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
}

export function activityDateLabel(entry: JiraActivityEntry): string {
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(entry.createdAtMs ?? PROJECT_BUTTER_ACTIVITY_EPOCH));
}

export function activityDayLabel(entry: JiraActivityEntry): string {
	const format = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
	const reference = Date.parse(format.format(new Date(PROJECT_BUTTER_ACTIVITY_EPOCH)));
	const date = Date.parse(format.format(new Date(entry.createdAtMs ?? PROJECT_BUTTER_ACTIVITY_EPOCH)));
	const days = Math.max(0, Math.round((reference - date) / 86_400_000));
	return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}
