import type { JiraActivityActor, JiraActivityCommentEntry, JiraActivityEntry } from "@/components/blocks/jira-activity";
import { PROJECT_BUTTER_REFERENCE_COMMENTS, PROJECT_BUTTER_REFERENCE_HISTORY } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import type { ProjectButterReferenceComment } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export const PROJECT_BUTTER_REFERENCE_EPOCH = Date.UTC(2026, 9, 28, 9, 53);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const AGE_STOPS = [22 * MINUTE, 2 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 5 * DAY, 8 * DAY, 12 * DAY, 17 * DAY, 22 * DAY];

function actor(name: string, agent?: string, isAgent = false): JiraActivityActor {
	const identity = agent ?? name;
	return { id: `butter-actor-${identity}`, name: agent ? `${agent} with ${name}` : name, kind: agent || isAgent ? "agent" : "person", avatarSrc: agent || isAgent ? undefined : projectButterPersonAvatar(name), ...(identity === "Claude" ? { brandName: "claude" } : identity === "Cursor" ? { brandName: "cursor" } : agent || isAgent ? { vpkLogo: "rovo" } : {}) };
}

function timestamp(value: string): number {
	const parsed = Date.parse(value.replace(" at ", " "));
	return Number.isFinite(parsed) ? parsed : PROJECT_BUTTER_REFERENCE_EPOCH;
}

function commentEntry(item: ProjectButterReferenceComment): JiraActivityCommentEntry {
	return { id: item.id, kind: "comment", actor: actor(item.author, item.agent, item.isAgent), timestamp: "", createdAtMs: timestamp(item.timestamp), body: [{ type: "text", text: item.markdown.replace(/\*\*/gu, "") }], allowReply: true, replies: item.replies?.map((reply) => ({ id: reply.id, actor: actor(reply.author, reply.agent, reply.isAgent), timestamp: "", body: reply.markdown.replace(/\*\*/gu, "") })) };
}

function relativeAge(age: number): string {
	return age >= DAY ? `${Math.floor(age / DAY)} days ago` : age >= HOUR ? `${Math.floor(age / HOUR)}h` : `${Math.max(1, Math.floor(age / MINUTE))}m`;
}

export function referenceActivityEntries(): JiraActivityEntry[] {
	const events: JiraActivityEntry[] = PROJECT_BUTTER_REFERENCE_HISTORY.filter((item) => !item.pinned && item.icon !== "created").map((item) => ({ id: item.id, kind: "event", actor: actor(item.actor), timestamp: "", createdAtMs: timestamp(item.timestamp), icon: item.icon, segments: [{ type: "text", text: item.action }] }));
	const entries = [...events, ...PROJECT_BUTTER_REFERENCE_COMMENTS.map(commentEntry)].sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
	const normalized = entries.map((entry, index) => {
		const position = ((entries.length - 1 - index) / Math.max(1, entries.length - 1)) * (AGE_STOPS.length - 1);
		const lower = Math.floor(position);
		const upper = Math.ceil(position);
		const age = Math.round(AGE_STOPS[lower] + (AGE_STOPS[upper] - AGE_STOPS[lower]) * (position - lower));
		return { ...entry, createdAtMs: PROJECT_BUTTER_REFERENCE_EPOCH - age, timestamp: relativeAge(age) };
	});
	const created: JiraActivityEntry = { id: "butter-source-created", kind: "event", actor: actor("Dev Rana"), timestamp: "21d", createdAtMs: PROJECT_BUTTER_REFERENCE_EPOCH - 21 * DAY, icon: "created", segments: [{ type: "text", text: "created this work item" }] };
	const approved: JiraActivityEntry[] = PROJECT_BUTTER_REFERENCE_HISTORY.filter((item) => item.pinned).reverse().map((item, index) => ({ id: item.id, kind: "event", actor: actor(item.actor), timestamp: "22d", createdAtMs: PROJECT_BUTTER_REFERENCE_EPOCH - 22 * DAY - (10 - index * 4) * HOUR, icon: "status", segments: [{ type: "lozenge", text: "Approved", variant: "success" }] }));
	return [created, ...approved, ...normalized];
}
