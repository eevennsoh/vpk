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
import { AgentSessionShowcase, ButterSessionPermissionControls, type ButterSessionPermission } from "@/components/projects/shared/components/agent-session-showcase";
import { HeaderLanyards } from "@/components/projects/shared/components/eu26-header-lanyards";

const TEAM_CHAT_PROFILES = agentSessionDemoProfiles(JGP_CHAT_AGENT_PROFILES, AGENT_SESSION_CLOUD_ITEMS);

export function AgentSessionDemoComparison() {
	const [permission, setPermission] = useState<ButterSessionPermission>("mine");
	const [chatActive, setChatActive] = useState(false);
	return (
		<div className="flex w-full min-w-0 flex-col items-center gap-4 bg-surface p-4">
			<ButterSessionPermissionControls onPermissionChange={setPermission} permission={permission} />
			<AgentSessionShowcase active={chatActive} className="w-full" onSessionOpen={() => setChatActive(true)} permission={permission} profiles={JGP_CHAT_AGENT_PROFILES} />
		</div>
	);
}

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
	return <RovoChatProvider agentProfiles={TEAM_CHAT_PROFILES}><HeaderLanyards><TeamSessionDemoContent /></HeaderLanyards></RovoChatProvider>;
}

function DemoPage(props: React.ComponentProps<typeof Page>) {
	return <RovoChatProvider agentProfiles={TEAM_CHAT_PROFILES}><HeaderLanyards><Page {...props} /></HeaderLanyards></RovoChatProvider>;
}

export default function AgentSessionDemo() {
	return <DemoPage />;
}

export function AgentSessionDemoMediumDetached() {
	return <DemoPage variant="medium-detached" />;
}

export function AgentSessionDemoMediumAttached() {
	return <DemoPage variant="medium-attached" />;
}

export function AgentSessionDemoSmall() {
	return <DemoPage variant="small" />;
}

export function AgentSessionDemoDrag() {
	return <DemoPage drag />;
}

export function AgentSessionDemoUnlinked() {
	return <DemoPage density="unlinked" host="local" />;
}

export function AgentSessionDemoLocalShort() {
	return <DemoPage density="short" host="local" />;
}

export function AgentSessionDemoLocalLong() {
	return <DemoPage density="long" host="local" />;
}

export function AgentSessionDemoCloudShort() {
	return <DemoPage density="short" host="cloud" />;
}

export function AgentSessionDemoCloudLong() {
	return <DemoPage density="long" host="cloud" />;
}
