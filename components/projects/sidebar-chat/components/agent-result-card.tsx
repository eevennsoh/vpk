"use client";

import type { ReactNode } from "react";
import { RFP_DRAFTING_AGENT_AVATAR_SRC } from "@/components/projects/jira/lib/rfp-demo-state";
import { AgentProfileCard } from "@/components/blocks/agent-profile-card";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import { cn } from "@/lib/utils";

export const ROVO_AGENT_RESULT_SELECT_EVENT = "rovo:select-agent-result";

export type AgentResult = RovoDataParts["agent-result"];

export interface AgentResultCreator {
	name: string;
	avatarSrc: string;
}

interface AgentResultCardProps {
	agent: AgentResult;
	creator?: AgentResultCreator;
	className?: string;
	onSelectAgent?: (agent: AgentResult) => void;
}

const RFP_DRAFTING_AGENT_ID = "rfp-drafting-agent";
// Generated agents are authored by the person in the studio, so the card attributes
// them to the studio owner (a person) rather than the Atlassian company. Mirrors the
// owner identity used by the studio session storage and custom-agents table.
const AGENT_CREATOR_NAME = "Venn Soh";
const AGENT_CREATOR_AVATAR_SRC = "/avatar-user/venn/venn.png";
const DEFAULT_AGENT_CREATOR: AgentResultCreator = {
	name: AGENT_CREATOR_NAME,
	avatarSrc: AGENT_CREATOR_AVATAR_SRC,
};

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function isGeneratedAgentResult(
	agent: AgentResult | null | undefined,
): agent is AgentResult {
	return agent?.action === "create";
}

function getAgentDisplayName(agent: AgentResult): string {
	return agent.agentId === RFP_DRAFTING_AGENT_ID ? "RFP Drafter" : agent.name;
}

function getAgentDescription(agent: AgentResult): string {
	if (agent.agentId === RFP_DRAFTING_AGENT_ID) {
		return "RFP Drafter monitors Drafting work items, reads Jira context, uses Teamwork Graph knowledge, and generates and attaches a response PDF.";
	}

	return agent.summary?.trim() || agent.description?.trim() || "Generated agent";
}

function getAgentAvatarSrc(agent: AgentResult): string {
	if (agent.agentId === RFP_DRAFTING_AGENT_ID) {
		return RFP_DRAFTING_AGENT_AVATAR_SRC;
	}

	// When the result carries no avatar, derive one deterministically from the
	// agent's identity — the same seed and helper the persisted session entry
	// uses (see createSessionAgentEntryFromResult) — so this card and the final
	// generated agent render the identical avatar and banner color.
	return (
		agent.avatarSrc?.trim() ||
		getDeterministicAgentAvatarSrc(agent.agentId?.trim() || agent.name)
	);
}

export function AgentResultCard({
	agent,
	creator = DEFAULT_AGENT_CREATOR,
	className,
	onSelectAgent,
}: Readonly<AgentResultCardProps>): ReactNode {
	if (!isGeneratedAgentResult(agent)) {
		return null;
	}

	const displayName = getAgentDisplayName(agent);
	const description = getAgentDescription(agent);
	const avatarSrc = getAgentAvatarSrc(agent);
	const handleSelectAgent = () => {
		onSelectAgent?.(agent);
		window.dispatchEvent(new CustomEvent(ROVO_AGENT_RESULT_SELECT_EVENT, {
			detail: {
				agentId: agent.agentId,
				source: "agent-result-card",
			},
		}));
	};

	return (
		<div className={cn("pb-2", className)} data-testid="rovo-agent-result-card">
			<AgentProfileCard
				attributionKind="person"
				avatarSrc={avatarSrc}
				className="w-full"
				coverSrc={avatarSrc}
				description={description}
				name={displayName}
				editActionLabel={`Edit ${displayName}`}
				onEditAction={handleSelectAgent}
				onPreviewAction={handleSelectAgent}
				onSwapAction={handleSelectAgent}
				partnerLogoSrc={creator.avatarSrc}
				partnerName={creator.name}
				previewActionLabel={`View ${displayName}`}
				swapActionLabel="Chat with agent"
				variant="preview"
				verified={false}
			/>
		</div>
	);
}
