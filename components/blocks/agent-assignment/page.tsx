"use client";

import { useEffect, useState } from "react";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { AgentAssignment } from "@/components/blocks/agent-assignment";
import {
	DEMO_USED_AGENT_IDS,
	INITIAL_ASSIGNED_AGENT_IDS,
	getAgentAssignmentDemoAssignedAgents,
} from "@/components/blocks/agent-assignment/demo-assigned-agents";
import {
	DEFAULT_PINNED_SPACE_AGENT_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
} from "@/components/blocks/jira-work-item/lib/work-item-picker-options";
import { SONNER_TOAST_AUTO_DISMISS_MS } from "@/components/ui/sonner";

export default function AgentAssignmentPage({
	variant = "default",
}: Readonly<{
	variant?: "default" | "simple";
}>) {
	const [assignedAgentIds, setAssignedAgentIds] = useState<readonly string[]>([
		...INITIAL_ASSIGNED_AGENT_IDS,
		"figma",
		"pipeline-troubleshooter",
		"feedback-analyzer",
	]);
	const [codeReviewerFinished, setCodeReviewerFinished] = useState(false);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setCodeReviewerFinished(true);
		}, SONNER_TOAST_AUTO_DISMISS_MS + 400);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, []);

	const assignedAgents = getAgentAssignmentDemoAssignedAgents(assignedAgentIds, {
		codeReviewerFinished,
	});

	return (
		<div className="w-80 rounded-xl bg-surface-raised p-4 shadow-lg">
			<div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
				<span className="text-sm text-text-subtle">Agents</span>
				<AgentAssignment
					agents={ROVO_AGENT_SELECTOR_AGENTS}
					assignedAgents={assignedAgents}
					defaultPinnedAgentIds={DEFAULT_PINNED_SPACE_AGENT_IDS}
					onAssignedAgentIdsChange={setAssignedAgentIds}
					onAssignedAgentSelect={() => undefined}
					onBrowseAgents={() => undefined}
					onContinueExistingSession={() => undefined}
					onCreateAgent={() => undefined}
					onRenameAssignedAgent={() => undefined}
					onStartNewSession={() => undefined}
					pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
					usedAgentIds={DEMO_USED_AGENT_IDS}
					variant={variant}
				/>
			</div>
		</div>
	);
}

export { AgentAssignment } from "@/components/blocks/agent-assignment";
export type { AgentAssignmentAgent, AgentAssignmentProps } from "@/components/blocks/agent-assignment";
