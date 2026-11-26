import type { JiraActivityActor, JiraActivityEntry } from "@/components/blocks/jira-activity";
import { referenceActivityEntries, PROJECT_BUTTER_REFERENCE_EPOCH } from "@/components/blocks/jira-work-item/project-butter/reference-activity";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { PROJECT_BUTTER_REFERENCE_COMMENTS } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import { PROJECT_BUTTER_SESSION_EPOCH } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_VIEWER } from "@/components/blocks/jira-work-item/project-butter/people";

export const PROJECT_BUTTER_ACTIVITY_EPOCH = PROJECT_BUTTER_SESSION_EPOCH;
export const PROJECT_BUTTER_CURRENT_USER: JiraActivityActor = { id: PROJECT_BUTTER_VIEWER.id, name: PROJECT_BUTTER_VIEWER.name, kind: "person", avatarSrc: PROJECT_BUTTER_VIEWER.avatarSrc };

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

const TIMELINE_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kuala_Lumpur" });
const TIMELINE_TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

/** Timeline hover label, e.g. "Nov 7 · 4:25 PM". */
export function activityDateLabel(entry: JiraActivityEntry): string {
	const date = new Date(entry.createdAtMs ?? PROJECT_BUTTER_ACTIVITY_EPOCH);
	return `${TIMELINE_DAY.format(date)} · ${TIMELINE_TIME.format(date)}`;
}

export function activityDayLabel(entry: JiraActivityEntry): string {
	const format = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
	const reference = Date.parse(format.format(new Date(PROJECT_BUTTER_ACTIVITY_EPOCH)));
	const date = Date.parse(format.format(new Date(entry.createdAtMs ?? PROJECT_BUTTER_ACTIVITY_EPOCH)));
	const days = Math.max(0, Math.round((reference - date) / 86_400_000));
	return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export function activityHeaderTimeLabel(label: string): string {
	const relative = /^(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|y)(?:\s+ago)?$/iu.exec(label.trim());
	if (!relative) return label;
	const [, count, rawUnit] = relative;
	const unit = rawUnit.toLowerCase();
	if (unit === "m" || unit.startsWith("min")) return `${count} min ago`;
	if (unit.startsWith("h")) return `${count} hr ago`;
	const fullUnit = unit.startsWith("d") ? "day" : unit.startsWith("w") ? "week" : unit.startsWith("mo") ? "month" : "year";
	return `${count} ${fullUnit}${count === "1" ? "" : "s"} ago`;
}
