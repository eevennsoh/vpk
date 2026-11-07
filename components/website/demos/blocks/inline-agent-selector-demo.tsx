"use client";

import { useState } from "react";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { Icon } from "@/components/ui/icon";

const softwareIds = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent"];
const agents = BUTTER_PICKER_AGENTS.filter((agent) => agent.id !== "rovo-cli" && agent.id !== "github-copilot");
const localLabels: Readonly<Record<string, string>> = { "claude-code": "Claude", "test-agent": "Cursor", "review-agent": "Codex" };

export function InlineAgentSelectorDemo({ sessions = [], onContinueSession, onStartSession, onBrowseAgents, onCreateAgent, status, favoriteAgentIds, onFavoriteAgentIdsChange }: Readonly<{
	sessions?: readonly AgentSessionItem[];
	onContinueSession?: (session: AgentSessionItem) => void;
	onStartSession?: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	status?: string;
	favoriteAgentIds?: readonly string[];
	onFavoriteAgentIdsChange?: (ids: readonly string[]) => void;
}> = {}) {
	const [feedback, setFeedback] = useState("");
	const [choosingAgentId, setChoosingAgentId] = useState<string | null>(null);
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => {
		const simulate = (action: string) => setFeedback(`${action} · ${agent.name} (preview)`);
		const matching = onContinueSession ? matchingAgentSessions(agent, sessions) : [];
		if (choosingAgentId === agent.id) return [
			{ id: "back", label: "Back", icon: <Icon render={<ArrowLeftIcon label="" size="small" />} />, onSelect: () => setChoosingAgentId(null), focusFirstActionAfterSelect: true },
			...matching.map((session) => ({ id: session.id, label: session.title, icon: <Icon render={<AiChatIcon label="" size="small" />} />, onSelect: () => onContinueSession?.(session) })),
		];
		const continueActions: InlineAgentAction[] = [];
		if (matching.length > 0) {
			continueActions.push({
				id: "continue",
				label: matching.length > 1 ? `Continue to existing session (${matching.length})` : "Continue with last session",
				icon: <Icon render={<AiChatIcon label="" size="small" />} />,
				onSelect: () => { if (matching.length === 1) onContinueSession?.(matching[0]); else setChoosingAgentId(agent.id); },
				focusFirstActionAfterSelect: matching.length > 1,
			});
		} else if (!onContinueSession && agent.id === "test-agent") {
			continueActions.push({ id: "continue", label: "Continue with last session", icon: <Icon render={<AiChatIcon label="" size="small" />} />, onSelect: () => simulate("Continue session on Cloud") });
		}
		return [
			...continueActions,
			{ id: "cloud", label: "Start a new session", icon: <Icon render={<CloudIcon label="" size="small" />} />, onSelect: () => { if (onStartSession) onStartSession(agent); else simulate("Start on Cloud"); } },
			...(localLabels[agent.id] ? [{ id: "local", label: `Open in ${localLabels[agent.id]}`, icon: <Icon render={<ScreenIcon label="" size="small" />} />, onSelect: () => simulate("Open locally") }] : []),
		];
	};
	const favoriteProps = favoriteAgentIds && onFavoriteAgentIdsChange ? { favoriteAgentIds, onFavoriteAgentIdsChange } : { favoriteAgentIds: undefined, onFavoriteAgentIdsChange: undefined };
	return <InlineAgentSelector agents={agents} softwareAgentIds={softwareIds} getActions={getActions} onActiveAgentChange={() => setChoosingAgentId(null)} status={status ?? feedback} onBrowseAgents={onBrowseAgents ?? (() => setFeedback("Browse agents (preview)"))} onCreateAgent={onCreateAgent ?? (() => setFeedback("Create agent (preview)"))} {...favoriteProps} />;
}
