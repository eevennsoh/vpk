"use client";

import { useMemo } from "react";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraWorkItemPreset } from "@/components/blocks/jira-work-item/data/session-state";
import { createProjectButterSessions, PROJECT_BUTTER_SESSIONS, type ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter-v1/data";
import { useProjectButterItemState } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-item-state";

interface ProjectButterSessionState {
	sessions: ProjectButterSessionItem[];
	activeSessionId: string | null;
	drafts: Record<string, string>;
	replies: Record<string, string[]>;
}

export function useProjectButterSessions(preset: JiraWorkItemPreset, itemKey = "reference", initialSessions?: readonly ProjectButterSessionItem[], currentUser?: WorkItemPerson) {
	const initialState = useMemo<ProjectButterSessionState>(() => {
		const activeSessionId: string | null = null;
		const drafts: Record<string, string> = {};
		const replies: Record<string, string[]> = {};
		return { sessions: initialSessions ? [...initialSessions] : itemKey === "reference" ? createProjectButterSessions(preset) : [], activeSessionId, drafts, replies };
	}, [initialSessions, itemKey, preset]);
	const { state: { sessions, activeSessionId, drafts, replies }, fieldSetter } = useProjectButterItemState(itemKey, initialState);
	const { setSessions, setActiveSessionId, setDrafts, setReplies } = useMemo(() => ({
		setSessions: fieldSetter("sessions"), setActiveSessionId: fieldSetter("activeSessionId"),
		setDrafts: fieldSetter("drafts"), setReplies: fieldSetter("replies"),
	}), [fieldSetter]);
	const activeSession = sessions.find((session) => session.id === activeSessionId);
	function startAgent(agent: AgentSessionItem["agent"], summary: string, prompt?: string) {
		const session: ProjectButterSessionItem = { id: `${itemKey}:${crypto.randomUUID()}`, agent, title: `Work on ${summary}`, host: "cloud", state: "running", timeLabel: "Just now", invokedAtMs: Date.now(), invokedBy: currentUser ? { name: currentUser.name, avatarSrc: currentUser.avatarUrl } : { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" }, message: `Ready to work on ${summary}.`, prompt };
		setSessions((current) => [...current, session]);
		setActiveSessionId(session.id);
		return session;
	}

	function startCoding() {
		const referenceSession = PROJECT_BUTTER_SESSIONS[0];
		const template = itemKey === "reference" ? referenceSession : {
			...referenceSession,
			id: `${itemKey}:coding`,
			title: `Work on ${itemKey}`,
			branch: undefined,
			message: `Ready to work on ${itemKey}.`,
		};
		const codingSession = currentUser ? { ...template, invokedBy: { name: currentUser.name, avatarSrc: currentUser.avatarUrl }, invokedAtMs: Date.now(), timeLabel: "Just now" } : template;
		setSessions((current) => current.some((session) => session.id === codingSession.id)
			? current
			: [...current, { ...codingSession, state: "running" }]);
		setActiveSessionId(codingSession.id);
		return sessions.find((session) => session.id === codingSession.id) ?? { ...codingSession, state: "running" as const };
	}

	function replyToSession(session: AgentSessionItem) {
		const reply = drafts[session.id]?.trim();
		if (!reply) return;
		setReplies((current) => ({ ...current, [session.id]: [...(current[session.id] ?? []), reply] }));
		setDrafts((current) => ({ ...current, [session.id]: "" }));
		setSessions((current) => current.map((candidate) => candidate.id === session.id
			? { ...candidate, state: "running", message: "Your reply has been added to this session." }
			: candidate));
	}

	return { activeSession, activeSessionId, drafts, replies, replyToSession, sessions, setActiveSessionId, setDrafts, setSessions, startCoding, startAgent };
}
