import type { JiraActivityCommentEntry, JiraActivityEntry, JiraActivitySegment } from "@/components/blocks/jira-activity";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_SESSIONS, PROJECT_BUTTER_SESSION_EPOCH } from "@/components/blocks/jira-work-item/project-butter/data";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { toActivityMentionSegments } from "@/components/blocks/jira-work-item/experimental-v3/lib/activity-mention-segments";

export type ProjectButterActivityView = "Activity" | "Audit";
export type ProjectButterActivitySort = "newest" | "oldest" | "agents" | "comments";

function agentMention(agent: ProjectButterSessionItem["agent"]): JiraActivitySegment {
	return { type: "agent-mention", text: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo };
}

export function projectButterSessionInvocation(session: ProjectButterSessionItem): JiraActivityCommentEntry {
	const createdAtMs = session.invokedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH;
	const name = session.invokedBy?.name ?? "Annie Cook";
	return {
		id: `invocation-${session.id}`, kind: "comment", actor: { id: `butter-invoker-${name}`, name, kind: "person", avatarSrc: session.invokedBy?.avatarSrc ?? projectButterPersonAvatar(name) },
		timestamp: session.id === "butter-scoping" ? "14 hours ago" : "Just now", createdAtMs,
		body: session.prompt ? toActivityMentionSegments(session.prompt, [session.agent]) : session.id === "butter-scoping"
			? [agentMention(session.agent), { type: "text", text: ", " }, agentMention(PROJECT_BUTTER_SESSIONS[0].agent), { type: "text", text: " please review the readiness of this ticket." }]
			: [agentMention(session.agent), { type: "text", text: ` please help with ${session.title}.` }],
		replies: [{ id: `response-${session.id}`, actor: { id: session.id, name: session.agent.name, kind: "agent", avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName }, body: session.state === "complete" ? session.message : "Working", timestamp: "", createdAtMs, sessionItem: session }],
		allowReply: true, defaultRepliesExpanded: false, replyPreviewCount: 1,
	};
}

export function selectProjectButterActivity(entries: readonly JiraActivityEntry[], view: ProjectButterActivityView, sort: ProjectButterActivitySort, showAuditInActivity = false) {
	const visible = entries.filter((entry) => view === "Activity" ? showAuditInActivity || entry.kind === "comment" : entry.kind !== "comment");
	return [...visible].sort((a, b) => {
		if (sort === "agents" || sort === "comments") {
			const aAgent = a.actor.kind === "agent" || a.kind === "comment" && a.replies?.some((reply) => reply.sessionItem);
			const bAgent = b.actor.kind === "agent" || b.kind === "comment" && b.replies?.some((reply) => reply.sessionItem);
			if (Boolean(aAgent) !== Boolean(bAgent)) return (aAgent ? -1 : 1) * (sort === "agents" ? 1 : -1);
		}
		return ((a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)) * (sort === "oldest" ? 1 : -1);
	});
}
