import { useEffect, useState } from "react";
import { DEFAULT_AGENT_VERSION_OPTIONS } from "../data/chat-panel-defaults";
import type { ChatPanelAgentVersionOption } from "../lib/chat-panel-types";

interface UseAgentVersionSelectionOptions {
	agentVersionOptions: readonly ChatPanelAgentVersionOption[];
	onAgentVersionChange?: (versionId: string) => void;
	selectedAgentVersionId?: string;
}

export interface AgentVersionSelection {
	selectAgentVersion: (versionId: string) => void;
	selectedAgentVersion: ChatPanelAgentVersionOption;
}

/**
 * Agent Test version picker state: controlled when the host passes
 * `selectedAgentVersionId`, otherwise local. An unknown selection falls back to
 * the first option and reports that fallback to the host.
 */
export function useAgentVersionSelection({
	agentVersionOptions,
	onAgentVersionChange,
	selectedAgentVersionId,
}: Readonly<UseAgentVersionSelectionOptions>): AgentVersionSelection {
	const [uncontrolledAgentVersionId, setUncontrolledAgentVersionId] = useState<string>(agentVersionOptions[0]?.id ?? "draft");
	const fallbackAgentVersionId = agentVersionOptions[0]?.id ?? DEFAULT_AGENT_VERSION_OPTIONS[0].id;
	const resolvedUncontrolledAgentVersionId = agentVersionOptions.some((version) => version.id === uncontrolledAgentVersionId)
		? uncontrolledAgentVersionId
		: fallbackAgentVersionId;
	const resolvedAgentVersionId = selectedAgentVersionId ?? resolvedUncontrolledAgentVersionId;
	const selectedAgentVersion =
		agentVersionOptions.find((version) => version.id === resolvedAgentVersionId) ??
		agentVersionOptions[0] ??
		DEFAULT_AGENT_VERSION_OPTIONS[0];

	useEffect(() => {
		if (agentVersionOptions.some((version) => version.id === resolvedAgentVersionId)) {
			return;
		}

		onAgentVersionChange?.(fallbackAgentVersionId);
	}, [agentVersionOptions, fallbackAgentVersionId, onAgentVersionChange, resolvedAgentVersionId]);

	const selectAgentVersion = (versionId: string) => {
		if (selectedAgentVersionId === undefined) {
			setUncontrolledAgentVersionId(versionId);
		}
		onAgentVersionChange?.(versionId);
	};

	return { selectAgentVersion, selectedAgentVersion };
}
