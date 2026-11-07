"use client";

import { useState } from "react";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";
import { InlineAgentSelector, type AgentSelectorAgent, type InlineAgentAction } from "@/components/blocks/agent-selector";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { Icon } from "@/components/ui/icon";

const softwareIds = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent"];
const agents = BUTTER_PICKER_AGENTS.filter((agent) => agent.id !== "rovo-cli" && agent.id !== "github-copilot");
const localLabels: Readonly<Record<string, string>> = { "claude-code": "Claude", "test-agent": "Cursor", "review-agent": "Codex" };

export function InlineAgentSelectorDemo() {
	const [feedback, setFeedback] = useState("");
	const getActions = (agent: AgentSelectorAgent): InlineAgentAction[] => {
		const simulate = (action: string) => setFeedback(`${action} · ${agent.name} (preview)`);
		return [
			...(agent.id === "test-agent" ? [{ id: "continue", label: "Continue with last session", icon: <Icon render={<AiChatIcon label="" size="small" />} />, onSelect: () => simulate("Continue session on Cloud") }] : []),
			{ id: "cloud", label: "Start a new session", icon: <Icon render={<CloudIcon label="" size="small" />} />, onSelect: () => simulate("Start on Cloud") },
			...(localLabels[agent.id] ? [{ id: "local", label: `Open in ${localLabels[agent.id]}`, icon: <Icon render={<ScreenIcon label="" size="small" />} />, onSelect: () => simulate("Open locally") }] : []),
		];
	};
	return <InlineAgentSelector agents={agents} softwareAgentIds={softwareIds} getActions={getActions} status={feedback} onBrowseAgents={() => setFeedback("Browse agents (preview)")} onCreateAgent={() => setFeedback("Create agent (preview)")} />;
}
