"use client";

import { AgentState, type AgentStateState } from "@/components/blocks/agent-state";

import type { JiraSidebarSessionItem, JiraSidebarSessionStatus } from "./jira";

// The composer payload of the shared session flyout. It renders the Agent State card, whose prompt
// composer brings the Tiptap runtime, so jira-session-flyout loads this module only for surfaces
// that pass content="composer".

/** Queue lifecycle mapped onto the compact, property-free agent card states. */
function toAgentStateState(status: JiraSidebarSessionStatus): AgentStateState {
	if (status === "awaiting-input") return "awaiting-input";
	if (status === "running") return "working";
	return "completed";
}

/** Copy for terminal states that cannot use the successful completion default. */
function toAgentStateMessage(status: JiraSidebarSessionStatus): string | undefined {
	if (status !== "stopped") return undefined;
	return "This session was stopped before the requested work was completed.";
}

export function JiraSessionComposerFlyout({
	onSubmitPrompt,
	session,
}: Readonly<{
	onSubmitPrompt?: (session: JiraSidebarSessionItem, prompt: string) => void;
	session: JiraSidebarSessionItem;
}>) {
	return (
		<AgentState
			agent={{
				avatarSrc: session.agentAvatarSrc,
				brandName: session.brandName,
				id: session.id,
				name: session.agentName,
			}}
			className="w-[320px] max-w-[calc(100vw-48px)] rounded-none shadow-none"
			completedAtMs={session.completedAtMs}
			completedSecondsAgo={session.completedSecondsAgo}
			initialElapsedSeconds={session.initialElapsedSeconds}
			message={toAgentStateMessage(session.status)}
			onSubmit={onSubmitPrompt ? (prompt) => onSubmitPrompt(session, prompt) : undefined}
			startedAtMs={session.startedAtMs}
			state={toAgentStateState(session.status)}
		/>
	);
}
