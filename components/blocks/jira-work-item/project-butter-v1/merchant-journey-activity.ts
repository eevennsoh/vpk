import type { JiraActivityEntry, JiraActivityReply } from "@/components/blocks/jira-activity";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter-v1/data";
import { PROJECT_BUTTER_SESSION_EPOCH } from "@/components/blocks/jira-work-item/project-butter-v1/data";
import { agentMention, projectButterSessionInvocation } from "@/components/blocks/jira-work-item/project-butter-v1/activity-feed-model";
import { applyProjectButterSuggestion, listProjectButterSuggestions, type ProjectButterSuggestion, type ProjectButterSuggestionField } from "@/components/blocks/jira-work-item/project-butter-v1/suggestion-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-content";
import type { ProjectButterDevelopmentPhase } from "@/components/blocks/jira-work-item/project-butter-v1/development-journey-model";
import { appendProjectButterAudit, PROJECT_BUTTER_SUGGESTION_AUDIT_ID, updateProjectButterSuggestionAudit } from "@/components/blocks/jira-work-item/project-butter-v1/content-audit";

export type ProjectButterJourneyPhase = "invoke" | "working" | ProjectButterDevelopmentPhase;
export type ProjectButterJourneyAuthoredField = ProjectButterSuggestionField | "assignee" | "status";
export const MERCHANT_ACKNOWLEDGMENT_DELAY_MS = 3_000;
const STAGES: readonly ProjectButterDevelopmentPhase[] = ["pr", "failed", "fixing", "passed", "merged"];
const MESSAGES = [
	{ id: "merchant-pr", at: 0, text: "I added the guided SDK v2 quickstart and opened PR #284. CI checks are running." },
	{ id: "merchant-fix", at: 2, text: "The accessibility check found that inline errors were not associated with their fields. I corrected the associations and pushed a fix to PR #284." },
	{ id: "merchant-passed", at: 3, text: "The checks passed after the fix." },
	{ id: "merchant-merged", at: 4, text: "PR #284 merged. PAY-999 is ready for the Done column." },
];
const GENERATED_IDS = new Set([...MESSAGES.map((message) => message.id), "merchant-assignment"]);

export function merchantJourneyActivity(phase: ProjectButterDevelopmentPhase, invokedAtMs = PROJECT_BUTTER_SESSION_EPOCH): JiraActivityReply[] {
	const step = STAGES.indexOf(phase);
	return MESSAGES.filter((message) => step >= message.at).map((message) => ({
		id: message.id,
		actor: { id: "merchant-claude", name: "Claude", kind: "agent" as const, brandName: "claude" as const },
		timestamp: "Just now",
		createdAtMs: invokedAtMs + (message.at + 1) * 60_000,
		body: message.text,
	}));
}

/** Apply only user changes relative to the displayed projection. */
export function merchantJourneyAuthoredUpdate<T extends object>(stored: T, shown: T, next: T): T {
	const result = { ...stored };
	for (const key in next) {
		if (JSON.stringify(shown[key]) !== JSON.stringify(next[key])) result[key] = next[key];
	}
	return result;
}

function isGeneratedEntry(id: string, session?: ProjectButterSessionItem) {
	return GENERATED_IDS.has(id) || Boolean(session && (id === `invocation-${session.id}` || id === `merchant-agent-added-${session.id}` || id === `merchant-status-${session.id}` || id === `merchant-started-${session.id}`));
}

/** Keep edits to visible records and preserve records hidden by the selected step. */
export function merchantJourneyAuthoredActivity(stored: readonly JiraActivityEntry[], shown: readonly JiraActivityEntry[], next: readonly JiraActivityEntry[], session?: ProjectButterSessionItem): JiraActivityEntry[] {
	const visibleIds = new Set(shown.map((entry) => entry.id));
	const saved = new Map(stored.map((entry) => [entry.id, entry]));
	const displayed = new Map(shown.map((entry) => [entry.id, entry]));
	return [
		...stored.filter((entry) => !visibleIds.has(entry.id)),
		...next.flatMap((entry) => {
			if (!isGeneratedEntry(entry.id, session) && entry.id !== PROJECT_BUTTER_SUGGESTION_AUDIT_ID) return [entry];
			const before = displayed.get(entry.id);
			const original = saved.get(entry.id);
			if (JSON.stringify(before) === JSON.stringify(entry)) return original ? [original] : [];
			if (entry.id === PROJECT_BUTTER_SUGGESTION_AUDIT_ID && !original) return [];
			return [original && before ? merchantJourneyAuthoredUpdate(original, before, entry) : entry];
		}),
	];
}

function prepareContent(content: ProjectButterContent, authoredFields: ReadonlySet<ProjectButterJourneyAuthoredField>): ProjectButterContent {
	const prepared = { ...content, detailFields: { ...content.detailFields } };
	const snapshot = { ...content.detailFields, description: content.description, descriptionDraft: content.descriptionDraft, dueDate: content.dueDate, reporter: content.reporter };
	for (const suggestion of listProjectButterSuggestions(snapshot, "payments")) {
		if (authoredFields.has(suggestion.field)) continue;
		applyProjectButterSuggestion<ProjectButterContent["detailFields"]>(suggestion, {
			setDescription: (value) => { prepared.description = value; },
			setDescriptionDraft: (value) => { prepared.descriptionDraft = value; },
			setDueDate: (value) => { prepared.dueDate = value; },
			setReporter: (value) => { prepared.reporter = value; },
			setDetailFields: (update) => { prepared.detailFields = update(prepared.detailFields); },
		});
	}
	return prepared;
}

function suggestedAuditValue(suggestion: ProjectButterSuggestion): string {
	switch (suggestion.field) {
		case "dueDate": return suggestion.date.toISOString().slice(0, 10);
		case "reporter": return suggestion.person.name;
		case "labels":
		case "components": return suggestion.values.join(", ");
		default: return suggestion.text;
	}
}

export function projectMerchantJourney({ content, sessions, phase, session, autoAssignTo, authoredFields = new Set(), showAcknowledgment = true }: Readonly<{
	content: ProjectButterContent;
	sessions: readonly ProjectButterSessionItem[];
	phase?: ProjectButterJourneyPhase;
	session?: ProjectButterSessionItem;
	autoAssignTo?: WorkItemPerson;
	authoredFields?: ReadonlySet<ProjectButterJourneyAuthoredField>;
	showAcknowledgment?: boolean;
}>) {
	if (!phase && !session) return { content, sessions };
	const prepared = phase ? prepareContent(content, authoredFields) : content;
	const active = Boolean(phase && phase !== "invoke");
	const actualSession = sessions.find((candidate) => candidate.id === session?.id) ?? session;
	const acceptedAtMs = content.activityEntries.find((entry) => entry.id === PROJECT_BUTTER_SUGGESTION_AUDIT_ID)?.createdAtMs;
	const invokedAtMs = actualSession?.invokedAtMs ?? (acceptedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH - 1) + 1;
	const projectedSession: ProjectButterSessionItem | undefined = active && actualSession ? {
		...actualSession,
		invokedAtMs,
		state: phase === "merged" ? "complete" : "running",
		message: phase === "merged" ? "PR #284 merged and checks passed." : actualSession.message,
	} : undefined;
	const projectedSessions = sessions.flatMap((candidate) => candidate.id === session?.id ? projectedSession ? [projectedSession] : [] : [candidate]);
	if (projectedSession && !sessions.some((candidate) => candidate.id === projectedSession.id)) projectedSessions.push(projectedSession);
	const entries = content.activityEntries.filter((entry) => !isGeneratedEntry(entry.id, session));
	const shouldAssign = projectedSession?.agent.name === "Claude" && autoAssignTo && !authoredFields.has("assignee") && (content.assignee.name === "Unassigned" || content.assignee.name === "Automatic");
	if (projectedSession) {
		const original = content.activityEntries.find((entry) => entry.id === `invocation-${projectedSession.id}`);
		if (projectedSession.agent.name === "Claude" && !projectedSession.prompt) {
			if (original?.kind === "comment" && original.replies?.some((reply) => reply.id !== `response-${projectedSession.id}`)) entries.push(original);
			entries.push({
				id: `merchant-agent-added-${projectedSession.id}`,
				kind: "event",
				actor: content.currentUser,
				timestamp: "Just now",
				createdAtMs: projectedSession.invokedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH,
				segments: [
					{ type: "text", text: "added " },
					agentMention(projectedSession.agent),
					{ type: "text", text: (session?.selfAssignedOnStart ?? Boolean(shouldAssign)) ? " and self-assigned the issue" : "" },
				],
			});
		} else {
			const invocation = original?.kind === "comment" ? { ...original, replies: original.replies?.map((reply) => reply.id === `response-${projectedSession.id}` ? { ...reply, sessionItem: projectedSession } : reply) } : projectButterSessionInvocation(projectedSession);
			entries.push(invocation);
		}
		if (projectedSession.agent.name === "Claude") {
			entries.push({
				id: `merchant-status-${projectedSession.id}`,
				kind: "event",
				actor: { id: "merchant-claude", name: "Claude", kind: "agent", avatarSrc: projectedSession.agent.avatarSrc, brandName: projectedSession.agent.brandName },
				timestamp: "Just now",
				createdAtMs: (projectedSession.invokedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH) + 1,
				icon: "status",
				segments: [{ type: "text", text: "changed status from To do to In progress" }],
			});
		}
		if (projectedSession.agent.name === "Claude" && showAcknowledgment) {
			const id = `merchant-started-${projectedSession.id}`;
			const previous = content.activityEntries.find((entry) => entry.id === id);
			const updates = phase && phase !== "invoke" && phase !== "working" ? merchantJourneyActivity(phase, invokedAtMs).filter((update) => update.id !== "merchant-merged") : [];
			const visibleUpdates = new Set(updates.map((reply) => reply.id));
			const replies = previous?.kind === "comment" ? [...(previous.replies ?? [])].filter((reply) => !GENERATED_IDS.has(reply.id) || visibleUpdates.has(reply.id)) : [];
			const existingReplies = new Set(replies.map((reply) => reply.id));
			for (const update of updates) {
				if (!existingReplies.has(update.id)) { replies.push(update); existingReplies.add(update.id); }
				const original = content.activityEntries.find((entry) => entry.id === update.id);
				for (const reply of original?.kind === "comment" ? original.replies ?? [] : []) {
					if (!existingReplies.has(reply.id)) { replies.push(reply); existingReplies.add(reply.id); }
				}
			}
			entries.push({
				id,
				kind: "comment",
				actor: { id: "merchant-claude", name: "Claude", kind: "agent", brandName: "claude" },
				timestamp: "Just now",
				createdAtMs: (projectedSession.invokedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH) + MERCHANT_ACKNOWLEDGMENT_DELAY_MS,
				body: [{ type: "text", text: "I'm looking into this issue now. I'll report back here with updates as I make progress." }],
				...(replies.length ? { replies } : {}),
			});
		}
		if (projectedSession.agent.name === "Claude" && phase === "merged") {
			const original = content.activityEntries.find((entry) => entry.id === "merchant-merged");
			const acknowledgment = content.activityEntries.find((entry) => entry.id === `merchant-started-${projectedSession.id}`);
			const legacy = acknowledgment?.kind === "comment" ? acknowledgment.replies?.find((reply) => reply.id === "merchant-merged") : undefined;
			const merged = legacy ?? merchantJourneyActivity(phase, invokedAtMs).find((update) => update.id === "merchant-merged");
			if (original?.kind === "comment") entries.push({ ...original, parentId: undefined });
			else if (merged) entries.push({ ...merged, kind: "comment", body: [{ type: "text", text: merged.body }] });
		}
	}
	let presented = { ...prepared, status: active && !authoredFields.has("status") ? phase === "merged" ? "Done" : "In progress" : prepared.status, activityEntries: entries };
	if (phase) {
		const snapshot = { ...content.detailFields, description: content.description, descriptionDraft: content.descriptionDraft, dueDate: content.dueDate, reporter: content.reporter };
		const suggestions = listProjectButterSuggestions(snapshot, "payments").filter((suggestion) => !authoredFields.has(suggestion.field) && (suggestion.field === "description" || (content.detailFields.order.includes(suggestion.field) && !content.detailFields.hidden.includes(suggestion.field))));
		for (const suggestion of suggestions) {
			presented = updateProjectButterSuggestionAudit(presented, { id: PROJECT_BUTTER_SUGGESTION_AUDIT_ID, createdAtMs: acceptedAtMs ?? invokedAtMs - 1, label: suggestion.label, before: "", after: suggestedAuditValue(suggestion) }, content.currentUser, "accept");
		}
	}
	return {
		content: shouldAssign && projectedSession.prompt
			? appendProjectButterAudit({ ...presented, assignee: autoAssignTo }, { id: "merchant-assignment", createdAtMs: projectedSession.invokedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH, label: "Assignee", before: "Unassigned", after: autoAssignTo.name, action: `automatically assigned this work item to ${autoAssignTo.name}` }, content.currentUser)
			: shouldAssign ? { ...presented, assignee: autoAssignTo } : presented,
		sessions: projectedSessions,
	};
}
