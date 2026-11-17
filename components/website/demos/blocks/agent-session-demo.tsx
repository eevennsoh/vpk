"use client";

import { useState } from "react";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { AGENT_SESSION_CLOUD_ITEMS, type AgentSessionItem } from "@/components/blocks/agent-session";
import Page from "@/components/blocks/agent-session/page";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { agentSessionDemoProfiles, agentSessionDemoScenario } from "@/components/projects/shared/lib/agent-session-demo-chat";
import { renderAgentSessionDemoArtifacts } from "@/components/projects/shared/components/agent-session-demo-artifacts";

const TEAM_CHAT_PROFILES = agentSessionDemoProfiles(JGP_CHAT_AGENT_PROFILES, AGENT_SESSION_CLOUD_ITEMS);

function TeamSessionDemoContent() {
	const [viewerOwner, setViewerOwner] = useState<NonNullable<AgentSessionItem["invokedBy"]> | null>(null);
	const [answeredSessionIds, setAnsweredSessionIds] = useState<ReadonlySet<string>>(new Set());
	const { activeSessionId, chatContextBar, externalThinkingMessageId, isSwitchingSession, openAgentChat } = useJgpAgentChatDemo();
	const activeSession = AGENT_SESSION_CLOUD_ITEMS.find((item) => item.id === activeSessionId);
	const awaitingAnswer = activeSession?.state === "needs-input" && !answeredSessionIds.has(activeSession.id);
	return (
		<>
			<Page answeredSessionIds={answeredSessionIds} density="long" host="cloud" onOpenCloudSession={(session) => {
				setViewerOwner(session.role === "viewer" ? session.invokedBy ?? { name: "" } : null);
				void openAgentChat(agentSessionDemoScenario(session, TEAM_CHAT_PROFILES, AGENT_SESSION_CLOUD_ITEMS.find((item) => item.id === session.id)?.state === "needs-input"));
			}} team />
			<JgpRovoOverlay chatContextBar={chatContextBar} externalThinkingMessageId={externalThinkingMessageId} isSwitchingSession={isSwitchingSession} onQuestionAnswer={awaitingAnswer ? () => { if (activeSessionId) setAnsweredSessionIds((current) => new Set(current).add(activeSessionId)); } : undefined} readOnly={viewerOwner !== null} readOnlyOwner={viewerOwner ?? undefined} readOnlySessionState={activeSessionId && answeredSessionIds.has(activeSessionId) ? "running" : activeSession?.state} renderWidget={renderAgentSessionDemoArtifacts} />
		</>
	);
}

export function AgentSessionDemoTeam() {
	return <RovoChatProvider agentProfiles={TEAM_CHAT_PROFILES}><TeamSessionDemoContent /></RovoChatProvider>;
}

export default function AgentSessionDemo() {
	return <Page />;
}

export function AgentSessionDemoMediumDetached() {
	return <Page variant="medium-detached" />;
}

export function AgentSessionDemoMediumAttached() {
	return <Page variant="medium-attached" />;
}

export function AgentSessionDemoSmall() {
	return <Page variant="small" />;
}

export function AgentSessionDemoDrag() {
	return <Page drag />;
}

export function AgentSessionDemoUnlinked() {
	return <Page density="unlinked" host="local" />;
}

export function AgentSessionDemoLocalShort() {
	return <Page density="short" host="local" />;
}

export function AgentSessionDemoLocalLong() {
	return <Page density="long" host="local" />;
}

export function AgentSessionDemoCloudShort() {
	return <Page density="short" host="cloud" />;
}

export function AgentSessionDemoCloudLong() {
	return <Page density="long" host="cloud" />;
}
