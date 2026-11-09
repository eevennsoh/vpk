"use client";

import { useState } from "react";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { Icon } from "@/components/ui/icon";
import { ProjectButterLocalAgentMenu } from "./project-butter-local-agent-menu";
import { useProjectButterInvocationActions, useProjectButterInvocationAgents } from "./project-butter-invocation";

const SOFTWARE_IDS = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent", "rovo-cli"];
const LOCAL_LABELS: Readonly<Record<string, string>> = { "claude-code": "Open in Claude", "test-agent": "Open in Cursor", "review-agent": "Open in Codex", "release-agent": "Open in VS Code", "github-copilot": "Open in VS Code" };

export function ProjectButterInlineAgentPicker({ onAssign, onBrowseAgents, onContinueSession, onCreateAgent, sessions = [] }: Readonly<{
	onAssign: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	onContinueSession?: (session: AgentSessionItem) => void;
	onCreateAgent?: () => void;
	sessions?: readonly AgentSessionItem[];
}>) {
	const agents = useProjectButterInvocationAgents();
	const invocation = useProjectButterInvocationActions();
	const [choosingAgentId, setChoosingAgentId] = useState<string | null>(null);
	const [status, setStatus] = useState("");
	const pickerAgents = agents.filter((agent) => agent.id !== "github-copilot" || !agents.some((candidate) => candidate.id === "release-agent"));
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => {
		const matching = onContinueSession ? matchingAgentSessions(agent, sessions) : [];
		if (choosingAgentId === agent.id) return [
			{ id: "back", label: "Back", icon: <Icon render={<ArrowLeftIcon label="" size="small" />} />, onSelect: () => setChoosingAgentId(null), focusFirstActionAfterSelect: true },
			...matching.map((session) => ({ id: session.id, label: session.title, icon: <Icon render={<AiChatIcon label="" size="small" />} />, onSelect: () => onContinueSession?.(session) })),
		];
		const actions: InlineAgentAction[] = matching.length ? [{
			id: "continue", label: matching.length > 1 ? "Continue to existing session" : "Continue with last session", icon: <Icon render={<AiChatIcon label="" size="small" />} />,
			onSelect: () => { if (matching.length === 1) onContinueSession?.(matching[0]); else setChoosingAgentId(agent.id); }, focusFirstActionAfterSelect: matching.length > 1,
		}] : [];
		if (agent.id !== "rovo-cli") actions.push({ id: "cloud", label: "Start a new session", icon: <Icon render={<CloudIcon label="" />} />, onSelect: () => onAssign(agent) });
		if (LOCAL_LABELS[agent.id]) actions.push({ id: "local", label: LOCAL_LABELS[agent.id], icon: <Icon render={<ScreenIcon label="" />} />, onSelect: () => setStatus(`Open locally · ${agent.name} (preview)`) });
		return actions;
	};
	return <InlineAgentSelector agents={pickerAgents} softwareAgentIds={SOFTWARE_IDS} getActions={getActions} renderAdditionalActions={(agent) => agent.id === "rovo-cli" && choosingAgentId !== agent.id ? <ProjectButterLocalAgentMenu inline onPointerEnter={() => undefined} onPointerLeave={() => undefined} onSelectingFolderChange={() => undefined} /> : null} onActiveAgentChange={(agent) => { setChoosingAgentId(null); invocation?.preview(agent, agent ? agents.findIndex((candidate) => candidate.id === agent.id) : -1); }} onBrowseAgents={onBrowseAgents} onCreateAgent={onCreateAgent} status={status} />;
}
